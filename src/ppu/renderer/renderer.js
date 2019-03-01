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
    this.pixels = new Array(256 * 240 * 4).fill(0)
    this.scrollX = 0
    this.scrollY = 0
    this.endX = 256
    this.endY = 240
  }

  bindModules() {
    for (let key of Object.keys(modules)) {
      this[key] = modules[key]
    }
  }

  connect(parts) {
    parts.registers && (this.registers = parts.registers)
    if (parts.layers) {
      this.bgLayer = parts.layers.background
      this.spLayer = parts.layers.sprites
    }
    parts.screen && (this.pixels = parts.screen.image.data)
  }

  render(x, y) {
    const fineX = this.registers.x.read()
    const coarseX = this.registers.v.readCoarseX() * 8
    const lx = fineX + coarseX
    const fineY = this.registers.v.readFineY()
    const coarseY = this.registers.v.readCoarseY() * 8
    let ly = fineY + coarseY
    if (ly >= 240) ly = this.scrollY = 0
    const nametable = this.registers.v.readNametable()
    this.offsetX = (nametable & 0b1) * 256
    this.offsetY = (nametable >> 1) * 240

    const dx = lx + this.offsetX
    let dy = ly + this.offsetY

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
    this.pixels[i + 1] = rgb[1]
    this.pixels[i + 2] = rgb[2]
    this.pixels[i + 3] = alpha
  }
}
