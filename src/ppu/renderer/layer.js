import Pixel from './pixel'
import colors from './colors'

export default class Layer {
  constructor(width, height) {
    this._init(width, height)
  }

  _init(width, height) {
    this.width = width+7
    this.height = height+7
    this.layer = new Array(this.height)

    for(let i=0;i<this.height;i++) {
      this.layer[i] = new Array(this.width)

      for(let j=0;j<this.width;j++) {
        this.layer[i][j] = new Pixel()
      }
    }
  }

  reset() {
    for(let h=0;h<this.height;h++) {
      for(let w=0;w<this.width;w++) {
        this.layer[h][w].reset()
      }
    }
  }

  get raw() {
    return this.layer
  }

  set raw(layer) {
    this.layer = layer
  }

  getPixel(x, y) {
    return this.layer[y][x]
  }

  setPixel(x, y, pixel) {
    this.layer[y][x] = pixel
  }

  writeBgTile(tile, palette, paletteId, x, y) {
    for(let i=0;i<8;i++) {
      for(let j=0;j<8;j++) {
        const tileBit = tile[i][j]
        const colorId = palette.select(paletteId, tileBit)
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

  writeSpTile(tile, palette, paletteId, x, y, isHflip, isVflip, priority) {
    let iStart = 0
    let iSign = 1
    let vStart = 0
    let vSign = 1

    if(isHflip) {
      vStart = 7
      vSign = -1
    }
    if(isVflip) {
      iStart = 7
      iSign = -1
    }


    for(let h=0,i=iStart;h<8;h++,i+=iSign) {
      for(let w=0,v=vStart;w<8;w++,v+=vSign) {
        const tileBit = tile[i][v]
        const colorId = palette.select(paletteId, tileBit)
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
