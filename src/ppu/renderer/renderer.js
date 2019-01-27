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
    this.tiles = []
    this.tiles = new Tiles()
    this.background = new Layer(256*2, 240*2)
    this.sprites = new Layer(256*2, 240*2)
    this._pixels = new Layer(256, 240)
    this.bgPalette = new Palette(0x3f00)
    this.spritesPalette = new Palette(0x3f10)
    this.pointer = 0
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

  /* Call from ppu */
  render() {
    const scrollX = this.registers[0x2005].horizontalScrollPosition
    const scrollY = this.registers[0x2005].verticalScrollPosition
    const x = this.pointer % this.width
    const y = (this.pointer - (this.pointer % this.width)) / this.width

    this.pointer++
    if(this.pointer >= this.width * this.height) {
      this.pointer = 0
    }

    this.renderPixel(x, y, scrollX, scrollY)
  }

  renderPixel(x, y, scrollX, scrollY) {
    const dx = x + scrollX
    const dy = y + scrollY

    this.pixels.setPixel(x, y, this.background.getPixel(dx, dy))

    if(this.sprites.getPixel(x, y).alpha() !== 0) {
      this.pixels.setPixel(x, y, this.sprites.getPixel(x, y))
    }
    //TODO 0番スプライトとの衝突判断
  }

  /* Render backgrounds and sprites to each layer */
  renderAllOnEachLayer() {
    this.renderBackground()
    this.renderSprites()
  }

  renderBackground() {
    for (let i = 0x000; i <= 0x3bf; i++) {
      const addr = 0x2000 + i
      const tileId = this.vram.read(addr)
      const paletteId = this.selectPalette(addr)
      const x = (i % this.tileWidth) * 8
      const y = ((i - (i % this.tileWidth)) / this.tileWidth) * 8

      const tile = this.tiles.select(tileId)
      this.background.writeTile(tile, this.bgPalette, paletteId, x, y)
      this.background.writeTile(tile, this.bgPalette, paletteId, x+256, y)
    }
  }

  renderSprites() {
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
    const x = n % 32
    const y = (((n - (n % 32)) / 32 - (((n - (n % 32)) / 32) % 2)) * 16) / 2
    const blockPosition = y + (x - (x % 2)) / 2

    return blockPosition
  }

  bitPosition(n) {
    const x = n % 2
    const y = ((n - (n % 32)) / 32) % 2
    const bitPosition = y * 2 + x

    return bitPosition
  }
}
