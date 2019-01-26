export default class Screen {
  constructor() {
    this.width = 256
    this.height = 240
    this._pixels = null
  }

  beforeRefresh() {}

  refresh() {
    this.beforeRefresh()

    for (let h = 0; h < this.height; h++)
      for (let w = 0; w < this.width; w++)
        this.refreshPixel(w, h)

    this.afterRefresh()
  }

  refreshPixel() {
    throw new Error(`refreshPixel isn't implemented in ${this.name}.`)
  }

  afterRefresh() {}

  set pixels(pixels) {
    this._pixels = pixels
  }

  get pixels() {
    return this._pixels
  }
}
