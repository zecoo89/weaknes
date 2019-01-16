import colors from './colors'

export default class Renderer {
  constructor(id) {
    if (!id) throw new Error("Id of canvas tag isn't specified.")

    let canvas = document.getElementById(id)
    this.context = canvas.getContext('2d')

    canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 240
    this.backgroundContext = canvas.getContext('2d')
  }

  connect(nes) {
    this.nes = nes
  }

  run() {
    this.render()
  }

  render() {
    this.renderBackground()
    this.renderSprites()

    window.requestAnimationFrame(this.render.bind(this))
  }

  renderBackground() {
    const backgroundData = this.nes.ppu.backgroundData

    backgroundData.forEach(data => {
      const image = this.generateTileImage(data.tile, data.palette)
      this.backgroundContext.putImageData(image, data.x, data.y)
      this.backgroundContext.putImageData(image, data.x + 256, data.y)
    })

    const x = this.nes.ppu.registers[0x2005].horizontalScrollPosition
    const y = this.nes.ppu.registers[0x2005].verticalScrollPosition

    const width = 256
    const height = 240
    const image = this.backgroundContext.getImageData(x, y, width, height)
    this.context.putImageData(image, 0, 0)
  }

  renderSprites() {
    const spritesData = this.nes.ppu.spritesData
    spritesData.forEach(data => {
      const image = this.generateTileImage(
        data.tile,
        data.palette,
        data.isHorizontalFlip,
        data.isVerticalFlip
      )
      this.renderSprite(image, data.x, data.y)
    })
  }

  renderSprite(image, x, y) {
    this.context.putImageData(image, x, y)
  }

  generateTileImage(tile, palette, isHorizontalFlip, isVerticalFlip) {
    const image = this.context.createImageData(8, 8)

    let jSign = 1,
      jOffset = 0
    if (isHorizontalFlip) {
      (jSign = -1), (jOffset = 7)
    }

    let iSign = 1,
      iOffset = 0
    if (isVerticalFlip) {
      (iSign = -1), (iOffset = 7)
    }

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const k = i * 8 + j
        const l = (i * iSign + iOffset) * 8 + j * jSign + jOffset
        const bit = tile[k]
        const color = this.color(palette[bit])

        image.data[l * 4] = color[0]
        image.data[l * 4 + 1] = color[1]
        image.data[l * 4 + 2] = color[2]
        image.data[l * 4 + 3] = 255 // 透明度
      }
    }
    return image
  }

  color(colorId) {
    return colors[colorId]
  }
}
