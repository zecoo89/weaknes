import { BaseRegister } from '../../utils'

/* VRAMへの書き込みアドレス */
export default class X2006 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  write(bits) {
    if (this.w.isLatched()) {
      this.t.writeVramLowAddr(bits)
      //this.vramAddr = this.t.read()
      this.ppu.registers[0x2007].addr = this.t.read()
    } else {
      this.t.writeVramHighAddr(bits)
    }

    this.w.toggle()
  }

  get vramAddr() {
    return this.vramAddr_
  }

  set vramAddr(bits) {
    this.vramAddr_ = bits
  }

  /*
  incrementVramAddr() {
    this.vramAddr_ += this.ppu.registers[0x2000].vramIncremental()
  }
  */
}
