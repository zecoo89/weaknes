import BaseRegister from './baseRegister'

export default class X2007 extends BaseRegister {
  constructor(ppu) {
    super(ppu)

    this.rNum = 0x2006 // VRAMへの書き込みアドレスを保持するレジスタ
  }

  read() {
    const addr = this.ppu.registers[this.rNum].vramAddr
    return this.ppu.vram.read(addr)
  }

  write(bits) {
    const addr = this.ppu.registers[this.rNum].vramAddr
    this.ppu.registers[this.rNum].incrementVramAddr()

    this.ppu.vram.write(addr, bits)
  }
}
