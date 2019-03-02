export default class V {
  constructor() {
    this.register = 0b000000000000000 // 15bit
  }

  writeCoarseX(bits) {
    this.writeBits(0, 4, bits & 0b11111)
  }

  readCoarseX() {
    return this.readBits(0, 4)
  }

  writeCoarseY(bits) {
    this.writeBits(5, 9, bits & 0b11111)
  }

  readCoarseY() {
    return this.readBits(5, 9)
  }

  writeFineY(bits) {
    this.writeBits(12, 14, bits & 0b111)
  }

  readFineY() {
    return this.readBits(12, 14)
  }

  writeNametable(bits) {
    this.writeBits(10, 11, bits & 0b11)
  }

  readNametable() {
    return this.readBits(10, 11)
  }

  read() {
    return this.register
  }

  write(bits) {
    this.register = bits & 0b111111111111111
  }

  readBits(from, to) {
    let bits = (this.register << (14 - to)) & 0x7fff
    bits = bits >> (14 - to)
    bits = bits >> from

    return bits
  }

  writeBits(from, to, bits) {
    let bitHigh = (this.register << (14 - to)) & 0xffff8000
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
