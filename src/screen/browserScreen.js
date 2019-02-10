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

  get pixels() {
    return this.image.data
  }

  /* Refresh screen */
  refresh() {
    this.context.putImageData(this.image, 0, 0)
  }
}
