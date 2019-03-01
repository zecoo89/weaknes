export default class X {
  constructor() {
    this.register = 0b000 // 3bit
  }

  read() {
    return this.register
  }

  write(bits) {
    this.register = bits & 0b111
  }
}
