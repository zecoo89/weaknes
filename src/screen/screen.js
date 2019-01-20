export default class Screen {
  constructor() {
    this.width = 256
    this.height = 240
  }

  beforeRefresh() {}

  refresh() {
    this.beforeRefresh()

    for (let h = 0; h < this.height; h++) {
      for (let w = 0; w < this.width; w++) {
        this.refreshPixel(h, w)
      }
    }

    this.postRefresh()
  }

  refreshPixel() {
    throw new Error(`refreshPixel isn't implemented in ${this.name}.`)
  }

  postRefresh() {}

  receivePixels(pixels) {
    this.pixels = pixels
  }
}
