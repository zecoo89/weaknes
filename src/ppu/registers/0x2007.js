import { BaseRegister } from '../../utils'

export default class X2007 extends BaseRegister {
  constructor(ppu) {
    super(ppu)

    this.buffer = 0x00
    this.rNum = 0x2006 // VRAMへの書き込みアドレスを保持するレジスタ
  }

  read() {
    const value = this.buffer

    const addr = this.ppu.registers[this.rNum].vramAddr()
    this.ppu.registers[this.rNum].incrementVramAddr()

    if (addr <= 0x3eff) {
      // external access
      this.buffer = this.ppu.vram.read(addr)
      return value
    } else {
      // internal access
      return this.ppu.vram.read(addr)
    }
  }

  _read() {
    const addr = this.ppu.registers[this.rNum].vramAddr()
    const filteredAddr = this.filter(addr)
    this.ppu.registers[this.rNum].incrementVramAddr()
    return this.ppu.vram.read(filteredAddr)
  }

  write(bits) {
    const addr = this.ppu.registers[this.rNum].vramAddr()
    this.ppu.registers[this.rNum].incrementVramAddr()

    const filteredAddr = this.filter(addr)
    this.ppu.vram.write(filteredAddr, bits)
  }

  filter(_addr) {
    let addr = _addr

    if (addr >= 0x3000 && addr <= 0x3eff) {
      addr = addr - 0x1000
    }

    if (addr >= 0x4000 && addr <= 0x7fff) {
      const size = addr - 0x4000
      addr = size % 0x4000
    }

    if (addr >= 0x3f20 && addr <= 0x3fff) {
      const size = addr - 0x3f20
      addr = 0x3f00 + (size % 0x20)
    }

    switch (addr) {
      case 0x3f10:
      case 0x3f14:
      case 0x3f18:
      case 0x3f1c:
        return (addr -= 0x10)
      default:
    }

    return addr
  }
}
