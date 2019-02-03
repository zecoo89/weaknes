export default class Pixel {
  constructor() {
    this._rgba = [0, 0, 0, 0]
  }

  reset() {
    for(let i=0;i<4;i++)
      this._rgba[i] = 0
  }

  rgba() {
    return this._rgba
  }

  alpha() {
    return this._rgba[3]
  }

  read() {
    return this._rgba
  }

  write(rgb, alpha) {
    for(let i=0;i<3;i++) {
      this._rgba[i] = rgb[i]
    }
    this._rgba[3] = alpha
  }
}
