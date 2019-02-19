import Layer from './layer'
import Palette from './palette'
import Tiles from './tiles'
import modules from './modules'

export default class Renderer {
  constructor() {
    this.init()
    this.bindModules()
    this.prepareTileIndex()
    this.preparePixelIndex()
    this.prepareTileIdOffsetIndex()
    this.prepareByteOffsetIndex()
    this.prepareBlockOffsetIndex()
    this.preparePaletteIdOfPaletteAddrIndex()
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
    this.scrollX = 0
    this.scrollY = 0
    this.offsetX = 0
    this.offsetY = 0
    this.mainScreenAddr = 0x2000
    this.secondScreenAddr = 0x2800
  }

  bindModules() {
    for(let key of Object.keys(modules))
      this[key] = modules[key]
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

  loadTile(offset, value, startAddr, offsetX, offsetY) {
    const isBgChrBehind = this.registers[0x2000].isBackgroundChrBehind()
    let tileId = value + this.tileIdOffsetIndex[isBgChrBehind]
    const tileIndex = this.tileIndex[offset]
    const x = tileIndex[0] + offsetX
    const y = tileIndex[1] + offsetY

    let tile = this.tiles.select(tileId)

		let paletteId = this.loadPalette(startAddr, offset)
    this.background.writeBgTile(tile, this.bgPalette, paletteId, x, y)
	}

	loadTileWithAttr(addr, startAddr, offsetX, offsetY) {
    const nametableAddrs = this.nametableBelongingToAttr(addr, startAddr)

    for(let i=0;i<nametableAddrs.length;i++) {
      //for(let a of nametableAddrs) {
      const a = nametableAddrs[i]
      if(a >= 0x3c0) break
      const tileId = this.vram.readFastly(startAddr + a)
      const offset = (startAddr + a) % 0x400

      this.loadTile(offset, tileId, startAddr, offsetX, offsetY)
    }
  }

  loadTileWithColor(addr) {
    const paletteId = this.paletteIdOfPaletteAddrIndex[addr]

    const startAddr = 0x2000
    for(let i=0x23c0;i<=0x23ff;i++) {
      const pids = this.vram.readFastly(i)
      for(let j=0;j<4;j++) {
        const pid = (pids >> (j*2)) & 0b11
        if(paletteId === 0 || paletteId === pid) {
          const nametableAddrs = this.nametableBelongingToAttr(i, startAddr)

          for(let k=0;k<4;k++) {
            const a = nametableAddrs[j*4+k]

            if(a >= 0x3c0) break

            const tileId = this.vram.readFastly(startAddr + a)
            const offset = (startAddr + a) % 0x400

            this.loadTile(offset, tileId, startAddr, 0, 0)
          }
        }
      }
    }
  }

  /* Call from ppu */
  render() {
    //const scrollX = this.registers[0x2005].horizontalScrollPosition
    const pixelIndex = this.pixelIndex[this.position]
    const x = pixelIndex[0]
    const y = pixelIndex[1]

    this.renderPixel(this.position, x, y, this.scrollX, this.scrollY, this.offsetX, this.offsetY)

    this.position++
      if(this.position === this.width * this.height) {
      this.position = 0
    }
  }

  renderPixel(position, x, y, scrollX, scrollY, offsetX, offsetY) {
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
    spAlpha && spPriority && this.setPixel(x, y, spRgb, spAlpha)
    bgAlpha && this.setPixel(x, y, bgRgb, bgAlpha)
    spAlpha && !spPriority && this.setPixel(x, y, spRgb, spAlpha)
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
    //this.scrollY = this.registers[0x2005].verticalScrollPosition
    const isChrBehind = this.registers[0x2000].isBackgroundChrBehind()
    this.tileIdOffset = this.tileIdOffsetIndex[isChrBehind]
    //this.loadBackground()
    this.loadSprites()
  }

  loadBackground() {
    this.loadScreen(this.mainScreenAddr, 0, 0)
    this.loadScreen(this.secondScreenAddr, this._offsetX, this._offsetY)
  }

  loadScreen(screenStartAddr, offsetX, offsetY) {
    for (let i = 0x000; i <= 0x3bf; i++) {
      let addr = screenStartAddr + i
      let tileId = this.vram.readFastly(addr) + this.tileIdOffset
      let paletteId = this.loadPalette(screenStartAddr, i)
      const tileIndex = this.tileIndex[i]
      const x = tileIndex[0] + offsetX
      const y = tileIndex[1] + offsetY

      let tile = this.tiles.select(tileId)
      this.background.writeBgTile(tile, this.bgPalette, paletteId, x, y)
    }
  }

  loadSprites() {
    const attrs = this.oam.attrs()

    this.sprites.reset()

    const isChrBehind = this.registers[0x2000].isSpriteChrBehind()
    let tileIdOffset = this.tileIdOffsetIndex[isChrBehind]
    const isSpriteSizeTwice = this.registers[0x2000].isSpriteSizeTwice()

    for(let i=0;i<attrs.length;i++) {
      const attr = attrs[i]

      let tileId
      if(isSpriteSizeTwice) {
        tileIdOffset = this.tileIdOffsetIndex[attr.tileId & 0b1]
        tileId = (attr.tileId & 0xfe) + tileIdOffset
      } else {
        tileId = attr.tileId + tileIdOffset
      }
      const paletteId = attr.paletteId

      const tile = this.tiles.select(tileId)
      const x = attr.x
      const y = attr.y
      const priority = attr.priority

      if(attr.y >= 240) continue

        const isHflip = attr.isHorizontalFlip
        const isVflip = attr.isVerticalFlip

        this.sprites.writeSpTile(tile, this.spritesPalette, paletteId, x, y, isHflip, isVflip, priority)

        /* case of 8x16 pixels*/
        if(isSpriteSizeTwice) {
          const secondTile = this.tiles.select(tileId+1)
          this.sprites.writeSpTile(secondTile, this.spritesPalette, paletteId, x, y+8, isHflip, isVflip, priority)
        }
    }
  }

  /* 属性テーブルから該当パレットの番号を取得する */
  loadPalette(nameTableStartAddr, i) {
    const attrTableStartAddr = nameTableStartAddr + 0x3c0

    const byteOffset = this.byteOffsetIndex[i]
    //const byteOffset = this.byteOffset(i)
    const byte = this.vram.readFastly(attrTableStartAddr + byteOffset)

    const blockOffset = this.blockOffsetIndex[i]
    //const blockOffset = this.blockOffset(i)
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

  nametableBelongingToAttr(addr, startAddr) {
    const i = addr - 0x3c0 - startAddr
    const x = i % 0x8
    const y = (i - x) / 0x8

    return [
      y * 0x80 + x * 4,
      y * 0x80 + x * 4 + 1,
      y * 0x80 + 0x20 + x * 4,
      y * 0x80 + 0x20 + x * 4 + 1,

      y * 0x80 + x * 4 + 2,
      y * 0x80 + x * 4 + 3,
      y * 0x80 + 0x20 + x * 4 + 2,
      y * 0x80 + 0x20 + x * 4 + 3,

      y * 0x80 + 0x40 + x * 4,
      y * 0x80 + 0x40 + x * 4 + 1,
      y * 0x80 + 0x60 + x * 4,
      y * 0x80 + 0x60 + x * 4 + 1,

      y * 0x80 + 0x40 + x * 4 + 2,
      y * 0x80 + 0x40 + x * 4 + 3,
      y * 0x80 + 0x60 + x * 4 + 2,
      y * 0x80 + 0x60 + x * 4 + 3,
    ]
  }
}
