export default class Pixel {
  constructor() {
    this._rgb = [0, 0, 0]
    this._alpha = 0
    this._priority = 0
  }

  reset() {
    for (let i = 0; i < 3; i++) this._rgb[i] = 0

    this._alpha = 0
    this._priority = 0
  }

  rgb() {
    return this._rgb
  }

  alpha() {
    return this._alpha
  }

  priority() {
    return this._priority
  }

  write(rgb, alpha, priority) {
    this._rgb[0] = rgb[0]
    this._rgb[1] = rgb[1]
    this._rgb[2] = rgb[2]
    this._alpha = alpha
    this._priority = priority
  }
}
