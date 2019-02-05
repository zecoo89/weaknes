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
    this.sprites = new Layer(256*2, 240*2)
    this._pixels = new Layer(256, 240)
    this.bgPalette = new Palette(0x3f00)
    this.spritesPalette = new Palette(0x3f10)
    this.position = 0
    this.mainScreenNumber = 0
    this.secondScreenAddr = 0x2800
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
    parts.vram && (this.bgPalette.connect(parts))
    parts.vram && (this.spritesPalette.connect(parts))
    parts.vram && (this.tiles.connect(parts))
    parts.oam && (this.oam = parts.oam)
    parts.registers && (this.registers = parts.registers)
  }

  get pixels() {
    return this._pixels
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
    const scrollX = this.registers[0x2005].horizontalScrollPosition
    let scrollY = this.registers[0x2005].verticalScrollPosition

    /* y is 0 ~ 239 */
    if(scrollY >= 240) {
      scrollY = 0
    }

    const x = this.position & (this.width - 1)
    const y = (this.position - (this.position & (this.width - 1))) / this.width

    this.incrementPixelPosition()

    this.renderPixel(x, y, scrollX, scrollY)
  }

  renderPixel(x, y, scrollX, scrollY) {
    const dx = (x + scrollX) & (this.endX - 1) // faster than % operator
    const dy = (y + scrollY) % this.endY

    this.pixels.setPixel(x, y, this.background.getPixel(dx, dy))

    const pixel = this.sprites.getPixel(x, y)
    if(pixel.alpha() !== 0) {
      this.pixels.setPixel(x, y, this.sprites.getPixel(x, y))
    }
  }

  /* load backgrounds and sprites to each layer */
  loadAllOnEachLayer() {
    this.loadBackground()
    this.loadSprites()
  }

  loadBackground() {
    const screenNum = this.registers[0x2000].mainScreenNumber()
    const mainScreenStartAddr = 0x2000 + screenNum * 0x400
    const secondScreenStartAddr = screenNum ? 0x2000 : this.secondScreenStartAddr

    this.loadScreen(mainScreenStartAddr, 0, 0)
    this.loadScreen(secondScreenStartAddr, this.offsetX, this.offsetY)
  }

  loadScreen(screenStartAddr, offsetX, offsetY) {
    for (let i = 0x000; i <= 0x3bf; i++) {
      let addr = screenStartAddr + i
      let tileId = this.vram.read(addr)
      let paletteId = this.loadPalette(screenStartAddr, i)
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8

      let tile = this.tiles.select(tileId)
      this.background.writeTile(tile, this.bgPalette, paletteId, x+offsetX, y+offsetY)
    }
  }

  loadSprites() {
    const attrs = this.oam.attrs()

    this.sprites.reset()

    for(let i=0;i<attrs.length;i++) {
      const attr = attrs[i]

      const tileId = attr.tileId + 256
      const paletteId = attr.paletteId

      const tile = this.tiles.select(tileId)
      const x = attr.x
      const y = attr.y
      const isHflip = attr.isHorizontalFlip
      const isVflip = attr.isVerticalFlip

      this.sprites.writeTile(tile, this.spritesPalette, paletteId, x, y, isHflip, isVflip)
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
