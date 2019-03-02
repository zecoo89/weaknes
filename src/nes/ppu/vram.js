export default class Vram {
  constructor() {
    this.memory = new Uint8Array(0x4000)
  }

  write(addr, value) {
    this.memory[addr] = value
  }

  read(addr) {
    const filteredAddr = this.filterForRead(addr)
    return this.memory[filteredAddr]
  }

  filterForRead(addr) {
    switch (addr) {
      case 0x3f04:
      case 0x3f08:
      case 0x3f0c:
        return 0x3f00
      default:
        return addr
    }
  }
}
