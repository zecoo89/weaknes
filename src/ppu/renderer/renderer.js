import modules from './modules'

export default class Renderer {
  constructor() {
    this.init()
    this.bindModules()
    this.preparePixelIndex()
  }

  init() {
    this.width = 256
    this.height = 240
    this.position = 0
    this.pixels = new Array(256 * 240 * 4).fill(0)
    this.scrollX = 0
    this.scrollY = 0
    this._offsetX = 0
    this._offsetY = 0
    this.endX = 256
    this.endY = 240
  }

  bindModules() {
    for(let key of Object.keys(modules)) {
      this[key] = modules[key]
    }
  }

  connect(parts) {
    parts.registers && (this.registers = parts.registers)
    if(parts.layers) {
      this.bgLayer = parts.layers.background
      this.spLayer = parts.layers.sprites
    }
    parts.screen && (this.pixels = parts.screen.image.data)
  }

  /* Call from ppu */
  render() {
    this.scrollX = this.registers[0x2005].horizontalScrollPosition
    const pixelIndex = this.pixelIndex[this.position]
    const x = pixelIndex[0]
    const y = pixelIndex[1]
    const mainScreenNumber = this.registers[0x2000].mainScreenNumber()
    this.offsetX = (mainScreenNumber & 0b1) * this._offsetX
    this.offsetY = (mainScreenNumber >> 1) * this._offsetY

    this.position++
    if(this.position === this.width * this.height) {
      this.position = 0
    }

    return this.renderPixel(x, y, this.scrollX, this.scrollY, this.offsetX, this.offsetY)
  }

  renderPixel(x, y, scrollX, scrollY, offsetX, offsetY) {
    /* y is 0 ~ 239 */
    if(scrollY >= 240) {
      scrollY = 0
    }

    const dx = (x + scrollX + offsetX) & (this.endX - 1) // faster than % operator
    const dy = (y + scrollY + offsetY) % this.endY

    const bgPixel = this.bgLayer.getPixel(dx, dy)
    const bgRgb = bgPixel.rgb()
    const bgAlpha = bgPixel.alpha()
    const spPixel = this.spLayer.getPixel(x, y)
    const spRgb = spPixel.rgb()
    const spAlpha = spPixel.alpha()
    const spPriority = spPixel.priority()

    !bgAlpha && this.setPixel(x, y, bgRgb, 255)
    spAlpha && spPriority && this.setPixel(x, y, spRgb, spAlpha)
    bgAlpha && this.setPixel(x, y, bgRgb, bgAlpha)
    spAlpha && !spPriority && this.setPixel(x, y, spRgb, spAlpha)
  }

  setPixel(x, y, rgb, alpha) {
    const i = (x + y * this.width) * 4
    this.pixels[i] = rgb[0]
    this.pixels[i+1] = rgb[1]
    this.pixels[i+2] = rgb[2]
    this.pixels[i+3] = alpha
  }
}
