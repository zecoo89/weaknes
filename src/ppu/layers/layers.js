import Layer from './layer'

export default class Layers {
  constructor() {
    this.init()
  }

  init() {
    const width = 256
    const height = 240
    let isBackground = true
    this.background = new Layer(width * 2, height * 2, isBackground)
    isBackground = false
    this.sprites = new Layer(width, height, isBackground)
  }

  connect(parts) {
    if (parts.vram) {
      this.background.connect({ vram: parts.vram })
      this.sprites.connect({ vram: parts.vram })
    }
  }
}
