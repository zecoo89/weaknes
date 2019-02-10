export default class W {
  constructor() {
    this.register = false
  }

  toggle() {
    this.register = !this.register
  }

  isLatched() {
    return this.register
  }

  clear() {
    this.register = false
  }
}
