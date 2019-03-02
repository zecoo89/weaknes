export default class W {
  constructor() {
    this.register = false
  }

  toggle() {
    this.register = ~this.register & 0b1
  }

  isLatched() {
    return this.register
  }

  clear() {
    this.register = 0
  }
}
