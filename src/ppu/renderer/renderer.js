import Layer from './layer'

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
    this.background = new Layer(256*2, 240*2)
    this.sprites = new Layer(256*2, 240*2)
    this._pixels = new Layer(256, 240)
    this.pointer = 0
  }

  connect(parts) {
    parts.vram ? (this.vram = parts.vram) : null
    parts.oam ? (this.oam = parts.oam) : null
    parts.registers ? (this.registers = parts.registers) : null
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
      const palette = this.selectBackgroundPalettes(paletteId)
      const x = (i % this.tileWidth) * 8
      const y = ((i - (i % this.tileWidth)) / this.tileWidth) * 8

      const tile = this.tiles[tileId]
      this.background.writeTile(tile, palette, x, y)
      this.background.writeTile(tile, palette, x+256, y)
    }
  }

  renderSprites() {
    const attrs = this.oam.attrs()

    this.sprites.reset()

    for(let i=0;i<attrs.length;i++) {
      const attr = attrs[i]

      const tileId = attr.tileId + 256
      const paletteId = attr.paletteId
      const palette = this.selectSpritePalettes(paletteId)

      const tile = this.tiles[tileId]
      const x = attr.x
      const y = attr.y
      const isHflip = attr.isHorizontalFlip
      const isVflip = attr.isVerticalFlip

      this.sprites.writeTile(tile, palette, x, y, isHflip, isVflip)
    }
  }

  /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
  selectBackgroundPalettes(number) {
    const palette = []

    const start = 0x3f01 + number * 4
    const end = 0x3f01 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    palette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
  }

  /* $3F10-$3F1Fからスプライトパレットを取得する */
  selectSpritePalettes(number) {
    const palette = []

    const start = 0x3f11 + number * 4
    const end = 0x3f11 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    palette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
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

  extractTiles() {
    for (let i = 0; i < 0x1fff; i+=16) {
      // タイルの下位ビット
      const tile = []
      for (let h = 0; h < 8; h++) {
        let lByte = this.vram.read(i+h)
        let uByte = this.vram.read(8+i+h)

        const line = []
        for (let j = 0; j < 8; j++) {
          const lBit = lByte & 0x01
          const uBit = (uByte & 0x01) << 1
          line.unshift(lBit | uBit)
          lByte = lByte >> 1
          uByte = uByte >> 1
        }

        tile.push(line)
      }

      this.tiles.push(tile)
    }
  }

  dumpTile(tileId) {
    const tile = this.tiles[tileId]
    let output = ''
    for(let h=0;h<8;h++) {
      for(let w=0;w<8;w++) {
        output += tile[h][w]
      }
      output += '\n'
    }
    console.log('---' + tileId + '---') // eslint-disable-line
    console.log(output) // eslint-disable-line
  }
}
