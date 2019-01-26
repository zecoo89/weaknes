import colors from './colors'

export default class Renderer {
  constructor() {
    this.init()
  }

  init() {
    this.width = 32
    this.height = 30
    this.tiles = []
    this.background = this.createLayer(256*2, 240*2)
    this.sprites = this.createLayer(256*2, 240*2)
    this._pixels = this.createLayer(256, 240)
    this.pointer = 0
  }

  createLayer(width, height) {
    const layer = new Array(height)

    for(let i=0;i<height;i++) {
      layer[i] = new Array(width)

      for(let j=0;j<width;j++) {
        layer[i][j] = [0, 0, 0, 0]
      }
    }

    return layer
  }

  initLayer(layer) {
    for(let i=0;i<layer.length;i++) {
      for(let j=0;j<layer[i].length;j++) {
        layer[i][j][0] = 0
        layer[i][j][1] = 0
        layer[i][j][2] = 0
        layer[i][j][3] = 0
      }
    }

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
    const width = 256
    const height = 240
    const scrollX = this.registers[0x2005].horizontalScrollPosition
    const scrollY = this.registers[0x2005].verticalScrollPosition
    const x = this.pointer % width
    const y = (this.pointer - (this.pointer % width)) / width

    this.pointer++
    if(this.pointer >= width * height) {
      this.pointer = 0
    }

    this.renderOnePixel(x, y, scrollX, scrollY)
  }

  renderOnePixel(x, y, scrollX, scrollY) {
    const pixel = this.pixels[y][x]
    const bx = x + scrollX
    const by = y + scrollY

    pixel[0] = this.background[by][bx][0]
    pixel[1] = this.background[by][bx][1]
    pixel[2] = this.background[by][bx][2]
    pixel[3] = this.background[by][bx][3]

    if(this.sprites[y][x][3] !== 0) {
      pixel[0] = this.sprites[y][x][0]
      pixel[1] = this.sprites[y][x][1]
      pixel[2] = this.sprites[y][x][2]
      pixel[3] = this.sprites[y][x][3]
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
      const x = (i % this.width) * 8
      const y = ((i - (i % this.width)) / this.width) * 8

      this.renderTile(this.background, tileId, palette, x, y)
      this.renderTile(this.background, tileId, palette, x+256, y)
    }
  }

  renderSprites() {
    const attrs = this.oam.attrs()

    this.initLayer(this.sprites)
    attrs.forEach(attr => {
      const tileId = attr.tileId + 256
      const paletteId = attr.paletteId
      const palette = this.selectSpritePalettes(paletteId)

      this.renderTile(
        this.sprites, tileId, palette,
        attr.x, attr.y,
        attr.isHorizontalFlip, attr.isVerticalFlip
      )
    })
  }

  renderTile(layer, tileId, palette, x, y, isHorizontalFlip, isVerticalFlip) {
    const tile = this.tiles[tileId]

    let iStart = 0
    let iSign = 1
    let vStart = 0
    let vSign = 1

    if(isHorizontalFlip) {
      vStart = 7
      vSign = -1
    }
    if(isVerticalFlip) {
      iStart = 7
      iSign = -1
    }

    for(let h=0,i=iStart;h<8;h++,i+=iSign) {
      for(let w=0,v=vStart;w<8;w++,v+=vSign) {
        const tileBit = tile[i][v]
        const colorId = palette[tileBit]
        const color = colors[colorId]

        layer[y+h][x+w][0] = color[0]
        layer[y+h][x+w][1] = color[1]
        layer[y+h][x+w][2] = color[2]
        layer[y+h][x+w][3] = 255
      }
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
    for (let i = 0; i < 0x1fff; ) {
      // タイルの下位ビット
      const lowerBits = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit)
          byte = byte >> 1
        }

        lowerBits.push(line)
      }

      // タイルの上位ビット
      const upperBits = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit << 1)
          byte = byte >> 1
        }

        upperBits.push(line)
      }

      // 上位ビットと下位ビットを合成する
      const perfectBits = []
      for (let h = 0; h < 8; h++) {
        const line = []
        for (let j = 0; j < 8; j++) {
          const perfectBit = lowerBits[h][j] | upperBits[h][j]
          line.push(perfectBit)
        }
        perfectBits.push(line)
      }
      this.tiles.push(perfectBits)
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
    console.log('---' + tileId + '---')
    console.log(output)
  }
}
