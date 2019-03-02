import Pixel from './pixel'
import Palette from './palette'
import colors from './colors'

export default class Layer {
  constructor(width, height, isBackground) {
    this.init(width, height)
    this.writeTile = isBackground ? this.writeBgTile : this.writeSpTile
  }

  init(width, height) {
    this.bgPalette = new Palette(0x3f00)
    this.spPalette = new Palette(0x3f10)
    this.width = width
    this.height = height
    this.layer = new Array(height)
    this.initLayer()
  }

  initLayer() {
    for (let i = 0; i < this.height; i++) {
      this.layer[i] = new Array(this.width)

      for (let j = 0; j < this.width; j++) {
        this.layer[i][j] = new Pixel()
      }
    }
  }

  connect(parts) {
    if (parts.vram) {
      this.bgPalette.connect({ vram: parts.vram })
      this.spPalette.connect({ vram: parts.vram })
    }
  }

  reset() {
    const layer = this.layer

    for (let h = 0; h < this.height; h++) {
      for (let w = 0; w < this.width; w++) {
        layer[h][w].reset()
      }
    }
  }

  getPixel(x, y) {
    return this.layer[y][x]
  }

  setPixel(x, y, pixel) {
    this.layer[y][x] = pixel
  }

  writeBgTile(tile, paletteId, x, y) {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const tileBit = tile[i][j]
        const colorId = this.bgPalette.select(paletteId, tileBit)
        const rgb = colors[colorId]
        const alpha = tileBit ? 255 : 0
        const px = x + j
        const py = y + i

        if (px < this.width && py < this.height) {
          this.getPixel(px, py).write(rgb, alpha)
        }
      }
    }
  }

  writeSpTile(tile, paletteId, x, y, isHflip, isVflip, priority) {
    let iStart = 0
    let iSign = 1
    let vStart = 0
    let vSign = 1

    if (isHflip) {
      vStart = 7
      vSign = -1
    }
    if (isVflip) {
      iStart = 7
      iSign = -1
    }

    for (let h = 0, i = iStart; h < 8; h++, i += iSign) {
      for (let w = 0, v = vStart; w < 8; w++, v += vSign) {
        const tileBit = tile[i][v]
        const colorId = this.spPalette.select(paletteId, tileBit)
        const rgb = colors[colorId]
        const alpha = tileBit ? 255 : 0
        const px = x + w
        const py = y + h

        if (px < this.width && py < this.height) {
          const pixel = this.getPixel(px, py)
          !pixel.alpha() && pixel.write(rgb, alpha, priority)
        }
      }
    }
  }
}
