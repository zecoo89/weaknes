import colors from './colors'

export default class Renderer {
  constructor() {
    this.init()
  }

  init() {
    this.tiles = []
    this.backgroundPalette = []
    this.spritePalette = []
    this.backgrounds = []
    this.sprites = []
    this.layerOfBackground = []
    this.layerOfSprite = []
    this.pixels = []
  }

  connect(parts) {
    parts.vram ? (this.vram = parts.vram) : null
    parts.oam ? (this.oam = parts.oam) : null
    parts.registers ? (this.registers = parts.registers) : null
  }

  pixels() {
    return this.pixels
  }

  renderOnePixel() {}

  render() {
    //TODO
    //use generator?
    //loop
    //render 256 * 240 pixels
  }

  renderBackground() {
    this.backgrounds.forEach(data => {
      const image = this.generateTileImage(data.tile, data.palette)
      this.backgroundContext.putImageData(image, data.x, data.y)
      this.backgroundContext.putImageData(image, data.x + 256, data.y)
    })

    const x = this.registers[0x2005].horizontalScrollPosition
    const y = this.registers[0x2005].verticalScrollPosition

    const width = 256
    const height = 240
    const image = this.backgroundContext.getImageData(x, y, width, height)
    this.context.putImageData(image, 0, 0)
  }

  renderSprites() {
    this.sprites.forEach(data => {
      const image = this.generateTileImage(
        data.tile,
        data.palette,
        data.isHorizontalFlip,
        data.isVerticalFlip
      )
      this.renderSprite(image, data.x, data.y)
    })
  }

  renderSprite(image, x, y) {
    this.context.putImageData(image, x, y)
  }

  generateTileImage(tile, palette, isHorizontalFlip, isVerticalFlip) {
    const image = this.context.createImageData(8, 8)

    let jSign = 1
    let jOffset = 0
    if (isHorizontalFlip) {
      jSign = -1
      jOffset = 7
    }

    let iSign = 1
    let iOffset = 0
    if (isVerticalFlip) {
      iSign = -1
      iOffset = 7
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const k = i * 8 + j
        const l = (i * iSign + iOffset) * 8 + j * jSign + jOffset
        const bit = tile[k]
        const paletteId = palette[bit]
        const color = colors[paletteId]

        image.data[l * 4] = color[0]
        image.data[l * 4 + 1] = color[1]
        image.data[l * 4 + 2] = color[2]
        image.data[l * 4 + 3] = 255 // 透明度
      }
    }
    return image
  }

  generateBackgrounds() {
    this.pointer = 0
    this.backgrounds.length = 0
    /* Prepare tile(8x8) * (32*30) */
    for (let i = 0x2000; i <= 0x23bf; i++) {
      const tileId = this.vram.read(i)
      const tile = this.tiles[tileId]
      const paletteId = this.selectPalette(i)
      const palette = this.selectBackgroundPalettes(paletteId)
      const x = (this.pointer % this.width) * 8
      const y = ((this.pointer - (this.pointer % this.width)) / this.width) * 8
      this.pointer++

      this.backgrounds.push({
        tile,
        palette,
        x,
        y
      })
    }
  }

  generateSprites() {
    this.sprites.length = 0
    const attrs = this.oam.attrs()

    attrs.forEach(attr => {
      const tileId = attr.tileId + 256
      const tile = this.tiles[tileId]
      const paletteId = attr.paletteId
      const palette = this.selectSpritePalettes(paletteId)

      this.sprites.push({
        tile,
        palette,
        x: attr.x,
        y: attr.y,
        isHorizontalFlip: attr.isHorizontalFlip,
        isVerticalFlip: attr.isVerticalFlip
      })
    })
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

  /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
  selectBackgroundPalettes(number) {
    this.backgroundPalette.length = 0

    const start = 0x3f01 + number * 4
    const end = 0x3f01 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    this.backgroundPalette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      this.backgroundPalette.push(this.vram.read(i))
    }

    return this.backgroundPalette
  }

  /* $3F10-$3F1Fからスプライトパレットを取得する */
  selectSpritePalettes(number) {
    this.spritePalette.length = 0

    const start = 0x3f11 + number * 4
    const end = 0x3f11 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    this.spritePalette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      this.spritePalette.push(this.vram.read(i))
    }

    return this.spritePalette
  }

  extractTiles() {
    for (let i = 0; i < 0x1fff; ) {
      // タイルの下位ビット
      const lowerBitLines = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit)
          byte = byte >> 1
        }

        lowerBitLines.push(line)
      }

      // タイルの上位ビット
      const higherBitLines = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit << 1)
          byte = byte >> 1
        }

        higherBitLines.push(line)
      }

      // 上位ビットと下位ビットを合成する
      const perfectBits = []
      for (let h = 0; h < 8; h++) {
        for (let j = 0; j < 8; j++) {
          const perfectBit = lowerBitLines[h][j] | higherBitLines[h][j]
          perfectBits.push(perfectBit)
        }
      }
      this.tiles.push(perfectBits)
    }
  }
}
