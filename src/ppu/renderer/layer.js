import Pixel from './pixel'
import colors from './colors'

export default class Layer {
  constructor(width, height) {
    this._init(width, height)
  }

  _init(width, height) {
    this.width = width
    this.height = height
    this.layer = new Array(height)

    for(let i=0;i<height;i++) {
      this.layer[i] = new Array(width)

      for(let j=0;j<width;j++) {
        this.layer[i][j] = new Pixel()
      }
    }
  }

  reset() {
    const layer = this.layer

    for(let h=0;h<this.height;h++)
      for(let w=0;w<this.width;w++)
        layer[h][w].reset()
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

  writeTile(tile, palette, x, y, isHflip, isVflip) {
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
        const colorId = palette[tileBit]
        const rgb = colors[colorId]
        const alpha = 255

        this.getPixel(x+w, y+h).write(rgb, alpha)
      }
    }
  }
}
