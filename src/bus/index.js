export default class Bus {
  constructor() {
    this.buffer = {}
    this.vramAddr_ = []
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
  }

  /* CPU側からのみしか考慮してない */
  write(addr, value) {
    switch (addr) {
      case 0x2006:
        this.vramAddr = value
        break
      case 0x2007:
        this.vram.writeFromBus(value)
        break
      default:
        this.buffer[addr] = value
    }
  }

  read(addr) {
    switch (addr) {
      case 0x2006:
        return this.vramAddr
      default:
        throw new Error('The bus of this addr is Not implemented')
    }
  }

  set vramAddr(addr) {
    if (this.vramAddr_.length < 1) {
      this.vramAddr_.push(addr)
    } else {
      this.vramAddr_.push(addr)
      this.vram.vp = this.vramAddr
      this.vramAddr_.length = 0
    }
  }

  get vramAddr() {
    return (this.vramAddr_[0] << 8) + this.vramAddr_[1]
  }
}
