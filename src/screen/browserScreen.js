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

    const rows = new Array(this.height)
    this.pixels = rows.map(row => {
      const line = new Array(this.width).fill([0, 0, 0, 0])
      row.push(line)
    })
    this.image = this.cotext.createImageData(this.width, this.height)
  }

  /* Refresh screen */
  refreshPixel(h, w) {
    const i = h * this.width + w

    this.image.data[i] = this.pixels[h][w][0]
    this.image.data[i + 1] = this.pixels[h][w][1]
    this.image.data[i + 2] = this.pixels[h][w][2]
    this.image.data[i + 3] = this.pixels[h][w][3]
  }

  afterRefresh() {
    this.context.putImageData(this.image, 0, 0)
  }
}
