export default class Pixel {
  constructor() {
    this.rgba = [0, 0, 0, 0]
  }

  reset() {
    for(let i=0;i<4;i++)
      this.rgba[i] = 0
  }

  rgba() {
    return this.rgba
  }

  alpha() {
    return this.rgba[3]
  }

  read() {
    return this.rgba
  }

  write(rgb, alpha) {
    for(let i=0;i<3;i++) {
      this.rgba[i] = rgb[i]
    }
    this.rgba[3] = alpha
  }
}
