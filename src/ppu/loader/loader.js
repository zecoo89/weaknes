import Tiles from './tiles'

export default class Loader {
  constructor() {
    this.tiles = new Tiles()
    this.tileWidth = 32
    this.prepareTileIndex()
    this.mainScreenAddr = 0x2000
    this.secondScreenAddr = 0x2800
  }

  connect(parts) {
    if(parts.layers) {
      this.bgLayer = parts.layers.background
      this.spLayer = parts.layers.sprites
    }

    if(parts.vram) {
      this.vram = parts.vram
      this.tiles.connect({ vram: this.vram })
    }

    parts.registers && (this.registers = parts.registers)
    parts.oam && (this.oam = parts.oam)
  }

  loadBgTile() {}
  loadSpTile() {}

  /* load backgrounds and sprites to each layer */
  loadAllOnEachLayer() {
    this.tileIdOffset = this.registers[0x2000].isBackgroundChrBehind() ? 256 : 0
    this.loadBackground()
    this.loadSprites()
  }

  loadBackground() {
    this.loadScreen(this.mainScreenAddr, 0, 0)
    this.loadScreen(this.secondScreenAddr, this.offsetX, this.offsetY)
  }

  loadScreen(screenStartAddr, offsetX, offsetY) {
    for (let i = 0x000; i <= 0x3bf; i++) {
      let addr = screenStartAddr + i
      let tileId = this.vram.read(addr) + this.tileIdOffset
      let paletteId = this.loadPalette(screenStartAddr, i)
      const tileIndex = this.tileIndex[i]
      const x = tileIndex[0] + offsetX
      const y = tileIndex[1] + offsetY

      let tile = this.tiles.select(tileId)
      this.bgLayer.writeTile(tile, paletteId, x, y)
    }
  }

  loadSprites() {
    const attrs = this.oam.attrs()

    this.spLayer.reset()

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

        this.spLayer.writeTile(tile, paletteId, x, y, isHflip, isVflip, priority)

        /* case of 8x16 pixels*/
        if(isSpriteSizeTwice) {
          const secondTile = this.tiles.select(tileId+1)
          this.spLayer.writeTile(secondTile, paletteId, x, y+8, isHflip, isVflip, priority)
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

  prepareTileIndex() {
    this.tileIndex = new Array()

    for(let i=0;i<=0x3bf;i++) {
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8
      this.tileIndex[i] = [x, y]
    }
  }
}
