export default class Screen {
  constructor() {
    this.width = 256
    this.height = 240
    this._pixels = null
  }

  refresh() {
    throw new Error(`refresh() isn't implemented in ${this.name}.`)
  }

  set pixels(pixels) {
    this._pixels = pixels
  }

  get pixels() {
    return this._pixels
  }
}
