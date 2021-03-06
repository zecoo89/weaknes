export default class BaseRegister {
  constructor(module) {
    this.connect(module)
    this.register = 0x00
  }

  connect(module) {
    if (module) {
      const name = module.constructor.name.toLowerCase()
      this[name] = module
    }
  }

  read() {
    return this.register
  }

  write(bits) {
    this.register = bits & 0xff
  }

  readBits(from, to) {
    let bits = (this.register << (7 - to)) & 0xff
    bits = bits >> (7 - to)
    bits = bits >> from

    return bits
  }

  writeBits(from, to, bits) {
    let bitHigh = (this.register << (7 - to)) & 0xff00
    bitHigh = bitHigh >> (7 - to)

    let bitLow = (this.register << (8 - from)) & 0xff
    bitLow = bitLow >> (8 - from)

    this.register = bitHigh | (bits << from) | bitLow
  }

  readOneBit(order) {
    const bit = (this.register >> order) & 0b1
    return bit
  }

  writeOneBit(order, bit) {
    const resetRegister = this.register & (0xff - (0b1 << order))
    this.register = resetRegister | (bit << order)
  }
}
