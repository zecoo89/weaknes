export default class Screen {
  constructor() {
    this.width = 256
    this.height = 240
    this._pixels = null
  }

  beforeRefresh() {
    throw new Error(`beforeRefresh() isn't implemented in ${this.name}.`)
  }

  refresh() {
    this.beforeRefresh()

    for (let h = 0; h < this.height; h++)
      for (let w = 0; w < this.width; w++)
        this.refreshPixel(w, h)

    this.afterRefresh()
  }

  refreshPixel() {
    throw new Error(`refreshPixel() isn't implemented in ${this.name}.`)
  }

  afterRefresh() {
    throw new Error(`afterRefresh() isn't implemented in ${this.name}.`)
  }

  set pixels(pixels) {
    this._pixels = pixels
  }

  get pixels() {
    return this._pixels
  }
}
