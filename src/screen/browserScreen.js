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

  beforeRefresh() {}

  /* Refresh screen */
  refreshPixel(x, y) {
    const i = (y * this.width + x) * 4
    const rgba = this.pixels.getPixel(x, y).read()

    for(let j=0;j<4;j++)
      this.image.data[i+j] = rgba[j]
  }

  afterRefresh() {
    this.context.putImageData(this.image, 0, 0)
  }
}
