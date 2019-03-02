import { BaseRegister } from '../../utils'

/* VRAMへの書き込みアドレス */
export default class X2006 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  write(bits) {
    if (this.w.isLatched()) {
      this.t.writeVramLowAddr(bits)
      this.v.write(this.t.read())
    } else {
      this.t.writeVramHighAddr(bits)
    }

    this.w.toggle()
  }

  vramAddr() {
    return this.v.read()
  }

  incrementVramAddr() {
    const incremental = this.ppu.registers[0x2000].vramIncremental()
    const newV = this.v.read() + incremental
    this.v.write(newV)
  }
}
