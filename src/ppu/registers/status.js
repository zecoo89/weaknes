export default class Status {
  constructor() {
    this.bits = 0xff
  }

  get raw() {
    return this.bits
  }

  set raw(bits) {
    this.bits = bits
  }

  get isVblank() {
    const bit = this.bits >> 7

    if (bit) {
      return 0
    } else {
      return 1
    }
  }

  set isVblank(bit) {
    this.bits = this.bits & 0x7f
    this.bits = this.bits | (~bit << 7)
  }
}
