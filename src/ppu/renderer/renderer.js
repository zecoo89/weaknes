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
    const dx = (x + scrollX) & (this.width * 2 - 1) // faster than % operator
    const dy = (y + scrollY) % (this.height * 2)

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
    for (let i = 0x000; i <= 0x3bf; i++) {
      let addr = 0x2000 + i + screenNum * 0x400
      let tileId = this.vram.read(addr)
      let paletteId = this.selectPalette(addr)
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8

      let tile = this.tiles.select(tileId)
      this.background.writeTile(tile, this.bgPalette, paletteId, x, y)
      this.background.writeTile(tile, this.bgPalette, paletteId, x+256, y)

      addr = screenNum ? 0x2000 + i : this.secondScreenAddr + i
      tileId = this.vram.read(addr)
      paletteId = this.selectPalette(addr)

      tile = this.tiles.select(tileId)
      this.background.writeTile(tile, this.bgPalette, paletteId, x, y+240)
      this.background.writeTile(tile, this.bgPalette, paletteId, x+256, y+240)
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
  selectPalette(n) {
    const start = 0x23c0
    const blockPosition = this.blockPosition(n)
    const bitPosition = this.bitPosition(n)

    const block = this.vram.read(start + blockPosition * 2)
    const bit = block >> (bitPosition * 2)

    return bit
  }

  blockPosition(n) {
    const x = n & (31)
    const y = (((n - (n & (31))) / 32 - (((n - (n & (31))) / 32) & 1)) * 16) / 2
    const blockPosition = y + (x - (x & 1)) / 2

    return blockPosition
  }

  bitPosition(n) {
    const x = n & 1
    const y = ((n - (n & 31)) / 32) & 1
    const bitPosition = y * 2 + x

    return bitPosition
  }
}
