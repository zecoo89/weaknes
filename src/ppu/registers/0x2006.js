import BaseRegister from '../../utils/baseRegister'

/* VRAMへの書き込みアドレス */
export default class X2006 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
    this.vramAddrUpper = 0x00
    this.vramAddrLower = 0x00
    this.vramAddr_ = 0x0000
    this.isFirst = true
  }

  write(bits) {
    if(this.isFirst) {
      this.vramAddrUpper = bits
    } else {
      this.vramAddrLower = bits
      this.vramAddr_ = (this.vramAddrUpper << 8) | this.vramAddrLower
    }

    this.isFirst = this.isFirst ? false : true
  }

  get vramAddr() {
    return this.vramAddr_
  }

  set vramAddr(bits) {
    this.vramAddr_ = bits
  }

  incrementVramAddr() {
    this.vramAddr_ += this.ppu.registers[0x2000].vramIncremental()
  }
}
