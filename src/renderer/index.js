import colors from './colors'

export default class Renderer {
  constructor(id) {
    if (!id) throw new Error("Id of canvas tag isn't specified.")

    let canvas = document.getElementById(id)
    this.context = canvas.getContext('2d')
    this.pointer = 0
    this.width = 32
    this.height = 30
  }

  write(tile, palette) {
    const image = this.generateTileImage(tile, palette)
    const x = (this.pointer % this.width) * 8
    const y = ((this.pointer - (this.pointer % this.width)) / this.width) * 8

    if (this.pointer < this.width * this.height - 1) {
      this.pointer++
    } else {
      this.pointer = 0
    }

    this.context.putImageData(image, x, y)
  }

  writeSprite(tile, palette, x, y) {
    const image = this.generateTileImage(tile, palette)
    this.context.putImageData(image, x, y)
  }

  generateTileImage(tile, palette) {
    const image = this.context.createImageData(8, 8)

    for (let i = 0; i < 64; i++) {
      const bit = tile[i]
      const color = this.color(palette[bit])

      image.data[i * 4] = color[0]
      image.data[i * 4 + 1] = color[1]
      image.data[i * 4 + 2] = color[2]
      image.data[i * 4 + 3] = 255 // 透明度
    }

    return image
  }

  color(colorId) {
    return colors[colorId]
  }
}
