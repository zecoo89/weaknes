export default class BaseRegister {
  constructor(module) {
    if(module) {
      const name = module.constructor.name.toLowerCase()
      this[name] = module
    }

    this.register = 0x00
  }

  read() {
    return this.register
  }

  write(bits) {
    this.register = bits && 0xff
  }

  readBits(from, to) {
    let bits = (this.register << (7 - to)) & 0xff
    bits = bits >> (7 - to)
    bits = bits >> from

    return bits
  }

  writeBits(from, to, bits) {
    const width = to - from + 1

    if((bits >> width))
      throw new Error(`Arg's bits are more than ${width} bits: ${bits.toString(2)}`)

    let bitHigh = (this.register << (7 - to)) & 0xff00
    bitHigh = bitHigh >> (7 - to)

    let bitLow = (this.register << (8 - from)) & 0xff
    bitLow = bitLow >> (8 - from)

    this.register = bitHigh | (bits << from) | bitLow
  }

  readOneBit(order) {
    return (this.register >> order) & 0b1
  }

  writeOneBit(order, bit) {
    if(bit > 0b1)
      throw new Error('Arg\'s bit is more than 2 bits.')

    const resetRegister = this.register & (0xff - (0b1 << order))
    this.register = resetRegister | (bit << order)
  }
}
