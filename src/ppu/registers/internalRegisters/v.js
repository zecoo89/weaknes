export default class V {
  constructor() {
    this.register = 0b000000000000000 // 15bit
  }

  writeScrollX(_bits) {
    const bits = _bits & 0b11111000
    this.writeBits(0, 4, bits)
  }

  writeScrollY(_bits) {
    const low3Bits = _bits & 0b111
    const mid3Bits = _bits & 0b111000
    const high2Bits = _bits * 0b11100000

    this.writeBits(13, 15, low3Bits)
    this.writeBits(5, 7, mid3Bits)
    this.writeBits(8, 9, high2Bits)
  }

  writeVramHighAddr(_bits) {
    const bits = _bits & 0b111111

    this.writeBits(8, 13, bits)
    this.writeOneBit(14, 0b0)
  }

  writeVramLowAddr(bits) {
    this.writeBits(0, 7, bits)
  }

  writeScreenNumber(_bits) {
    const bits = _bits & 0b11
    this.writeBits(10, 11, bits)
  }

  read() {
    return this.register
  }

  write(bits) {
    this.register = bits & 0b111111111111111
  }

  readBits(from, to) {
    let bits = (this.register << (14 - to)) & 0xff
    bits = bits >> (14 - to)
    bits = bits >> from

    return bits
  }

  writeBits(from, to, bits) {
    let bitHigh = (this.register << (14 - to)) & 0x3ff8000
    bitHigh = bitHigh >> (14 - to)

    let bitLow = (this.register << (15 - from)) & 0x7fff
    bitLow = bitLow >> (15 - from)

    this.register = bitHigh | (bits << from) | bitLow
  }

  writeOneBit(order, bit) {
    const resetRegister = this.register & (0x7fff - (0b1 << order))
    this.register = resetRegister | (bit << order)
  }
}
