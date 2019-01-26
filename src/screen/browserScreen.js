import Screen from './screen'

/* Output device on the premise that browser */
export default class BrowserScreen extends Screen {
  constructor(id) {
    super()
    if (!id) {
      throw new Error("Id of canvas tag isn't specified.")
    }

    let canvas = document.getElementById(id)
    this.context = canvas.getContext('2d')
    this.image = this.context.createImageData(this.width, this.height)
  }

  /* Refresh screen */
  refreshPixel(x, y) {
    const i = (y * this.width + x) * 4
    const pixels = this.pixels

    this.image.data[i] = pixels[y][x][0]
    this.image.data[i + 1] = pixels[y][x][1]
    this.image.data[i + 2] = pixels[y][x][2]
    this.image.data[i + 3] = pixels[y][x][3]
  }

  afterRefresh() {
    this.context.putImageData(this.image, 0, 0)
  }
}
