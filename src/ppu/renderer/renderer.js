import Layer from './layer'
import Palette from './palette'
import Tiles from './tiles'

export default class Renderer {
  constructor() {
    this.init()
  }

  init() {
    this.width = 256
    this.height = 240
    this.tileWidth = 32
    this.tileHeight = 30
    this.tiles = new Tiles()
    this.background = new Layer(256*2, 240*2)
    this.sprites = new Layer(256, 240)
    this.pixels = new Layer(256, 240).raw
    this.bgPalette = new Palette(0x3f00)
    this.spritesPalette = new Palette(0x3f10)
    this.position = 0
    this.x = 0
    this.y = 0
    this.scrollX = 0
    this.scrollY = 0
    this.offsetX = 0
    this.offsetY = 0
    this.mainScreenNumber = 0
    this.mainScreenAddr = 0x2000
    this.secondScreenAddr = 0x2800
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
    parts.vram && this.bgPalette.connect(parts)
    parts.vram && this.spritesPalette.connect(parts)
    parts.vram && this.tiles.connect(parts)
    parts.oam && (this.oam = parts.oam)
    parts.registers && (this.registers = parts.registers)
    parts.screen && (this.pixels = parts.screen.image.data)
  }

  initPixelPosition() {
    this.position = 0
  }

  incrementPixelPosition() {
    this.position++
  }

  isVblankStart() {
    return this.position === this.width * 240
  }

  isVblankEnd() {
    return this.position === this.width * 262
  }

  /* Call from ppu */
  render() {
    this.scrollX = this.registers[0x2005].horizontalScrollPosition

    const x = this.position & (this.width - 1)
    const y = (this.position - (this.position & (this.width - 1))) / this.width
    this.offsetX = (this.registers[0x2000].mainScreenNumber() & 0b1) * this._offsetX
    this.offsetY = ((this.registers[0x2000].mainScreenNumber() & 0b10) >> 1) * this._offsetY

    this.incrementPixelPosition()

    this.renderPixel(x, y, this.scrollX, this.scrollY, this.offsetX, this.offsetY)
  }

  renderPixel(x, y, scrollX, scrollY, offsetX, offsetY) {
    /* y is 0 ~ 239 */
    if(scrollY >= 240) {
      scrollY = 0
    }

    const dx = (x + scrollX + offsetX) & (this.endX - 1) // faster than % operator
    const dy = (y + scrollY + offsetY) % this.endY

    const bgPixel = this.background.getPixel(dx, dy)
    const bgRgb = bgPixel.rgb()
    const bgAlpha = bgPixel.alpha()
    const spPixel = this.sprites.getPixel(x, y)
    const spRgb = spPixel.rgb()
    const spAlpha = spPixel.alpha()
    const spPriority = spPixel.priority()

    !bgAlpha && this.setPixel(x, y, bgRgb, 255)
    spPriority && spAlpha && this.setPixel(x, y, spRgb, spAlpha)
    bgAlpha && this.setPixel(x, y, bgRgb, bgAlpha)
    !spPriority && spAlpha && this.setPixel(x, y, spRgb, spAlpha)
  }

  setPixel(x, y, rgb, alpha) {
    const i = (x + y * this.width) * 4
    this.pixels[i] = rgb[0]
    this.pixels[i+1] = rgb[1]
    this.pixels[i+2] = rgb[2]
    this.pixels[i+3] = alpha
  }

  /* load backgrounds and sprites to each layer */
  loadAllOnEachLayer() {
    //this.scrollX = this.registers[0x2005].horizontalScrollPosition
    this.scrollY = this.registers[0x2005].verticalScrollPosition
    this.mainScreenNumber = this.registers[0x2000].mainScreenNumber()
    this.loadBackground()
    this.loadSprites()
  }

  loadBackground() {
    this.loadScreen(this.mainScreenAddr, 0, 0)
    this.loadScreen(this.secondScreenAddr, this._offsetX, this._offsetY)
  }

  loadScreen(screenStartAddr, offsetX, offsetY) {
    const tileIdOffset = this.registers[0x2000].isBackgroundChrBehind() ? 256 : 0

    for (let i = 0x000; i <= 0x3bf; i++) {
      let addr = screenStartAddr + i
      let tileId = this.vram.read(addr) + tileIdOffset
      let paletteId = this.loadPalette(screenStartAddr, i)
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8

      let tile = this.tiles.select(tileId)
      this.background.writeBgTile(tile, this.bgPalette, paletteId, x+offsetX, y+offsetY)
    }
  }

  loadSprites() {
    const isSprite = true
    const attrs = this.oam.attrs()

    this.sprites.reset()

    const tileIdOffset = this.registers[0x2000].isSpriteChrBehind() ? 256 : 0
    const isSpriteSizeTwice = this.registers[0x2000].isSpriteSizeTwice()

    for(let i=0;i<attrs.length;i++) {
      const attr = attrs[i]

      const tileId = attr.tileId + tileIdOffset
      const paletteId = attr.paletteId

      const tile = this.tiles.select(tileId)
      const x = attr.x
      const y = attr.y
      const priority = attr.priority

      if(attr.y >= 240) continue

      const isHflip = attr.isHorizontalFlip
      const isVflip = attr.isVerticalFlip

      this.sprites.writeSpTile(tile, this.spritesPalette, paletteId, x, y, isHflip, isVflip, isSprite, priority)

      /* case of 8x16 pixels*/
      if(isSpriteSizeTwice) {
        const secondTile = this.tiles.select(tileId+1)
        this.sprites.writeSpTile(secondTile, this.spritesPalette, paletteId, x, y+8, isHflip, isVflip, isSprite, priority)
      }
    }
  }

  /* 属性テーブルから該当パレットの番号を取得する */
  loadPalette(nameTableStartAddr, i) {
    const attrTableStartAddr = nameTableStartAddr + 0x3c0

    const byteOffset = this.byteOffset(i)
    const byte = this.vram.read(attrTableStartAddr + byteOffset)

    const blockOffset = this.blockOffset(i)
    const block = (byte >> (blockOffset*2)) & 0b11

    return block
  }

  byteOffset(i) {
    const x = (i >> 2) & 0b111
    const y = (i >> 7)
    return x + (y << 3)
  }

  blockOffset(i) {
    const x = (i >> 1) & 0b1
    const y = (i >> 6) & 0b1

    return x + (y << 1)
  }
}
