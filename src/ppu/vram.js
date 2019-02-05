export default class Vram {
  constructor() {
    /* 0x0000 - 0x0fff : Pattern table 0
     * 0x1000 - 0x1fff : Pattern table 1
     * 0x2000 - 0x23bf : Name table 0
     * 0x23c0 - 0x23ff : Attribute table 0
     * 0x2400 - 0x27bf : Name table 1
     * 0x2bc0 - 0x2bbf : Attribute table 1
     * 0x2c00 - 0x2fbf : Name table 2
     * 0x2bc0 - 0x2bff : Attribute table 2
     * 0x2c00 - 0x2fbf : Name table 3
     * 0x2fc0 - 0x2fff : Attribute table 3
     * 0x3000 - 0x3eff : Mirror of 0x2000 - 0x2fff
     * 0x3f00 - 0x3f0f : Background palette
     * 0x3f10 - 0x3f1f : Sprite palette
     * 0x3f20 - 0x3fff : Mirror of 0x3f00 0 0x3f1f
     * */
    this.memory = new Uint8Array(0x4000)
  }

  write(addr, value) {
    const filteredAddr = this.filter(addr)
    this.memory[filteredAddr] = value
  }

  read(addr) {
    const filteredAddr = this.filter(addr)
    return this.memory[filteredAddr]
  }

  filter(_addr) {
    let addr = _addr

    if(addr >= 0x4000 && addr <= 0x7fff) {
      const size = addr - 0x4000
      addr = size % 0x4000
    }

    if(addr >= 0x3f20 && addr <= 0x3fff) {
      const size = addr - 0x3f20
      addr = 0x3f00 + size % 0x20
    }

    switch(addr) {
      case 0x3f10:
      case 0x3f14:
      case 0x3f18:
      case 0x3f1c:
        return addr -= 0x10
      default:
    }

    if(addr >= 0x2800 && addr <= 0x2fff) {
      addr -= 0x800
    }

    return addr
  }
}
