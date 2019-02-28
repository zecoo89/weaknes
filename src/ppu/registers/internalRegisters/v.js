export default class V {
  constructor() {
    this.register = 0b000000000000000 // 15bit
  }

  writeCoarseX(bits) {
    this.writeBits(0, 4, bits)
  }

  readCoarseX() {
    return this.readBits(0, 4)
  }

  writeCoarseY(bits) {
    this.writeBits(5, 9, bits)
  }

  readCoarseY() {
    return this.readBits(5, 9)
  }

  writeFineY() {
    this.writeBits(12, 14)
  }

  readFineY() {
    return this.readBits(12, 14)
  }

  writeNametable(bits) {
    this.writeBits(10, 11, bits)
  }

  readNametable() {
    return this.readBits(10, 11)
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
    let bits = (this.register << (14 - to)) & 0x7fff
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
