export default class Ram {
  constructor() {
    this.memory = new Uint8Array(0x10000).fill(0)
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.ppu && (this.ppu = parts.ppu)
    parts.apu && (this.apu = parts.apu)
    parts.controller && (this.controller = parts.controller)
  }

  filter(addr) {
    if (addr >= 0x0800 && addr <= 0x1fff) {
      const size = addr - 0x800
      addr = size % 0x800
    } else if (addr >= 0x2008 && addr <= 0x3fff) {
      const size = addr - 0x2008
      addr = 0x2000 + (size % 0x8)
    }

    return addr
  }

  write(addr, value) {
    addr = this.filter(addr)
    switch (addr) {
      case 0x2000:
      case 0x2001:
      case 0x2003:
      case 0x2004:
      case 0x2005:
      case 0x2006:
      case 0x2007:
        this.ppu.writeRegister(addr, value)
        break
      case 0x4014:
        this.ppu.cycles += 513 * 3
        this.ppu.writeRegister(addr, value)
        break
      /*
      case 0x4000:
      case 0x4001:
      case 0x4002:
      case 0x4003:
      case 0x4004:
      case 0x4005:
      case 0x4006:
      case 0x4007:
      case 0x4008:
      case 0x400a:
      case 0x400b:
      case 0x400c:
      case 0x400e:
      case 0x400f:
      case 0x4010:
      case 0x4011:
      case 0x4012:
      case 0x4013:
      case 0x4015:
        this.apu ? this.apu.writeRegister(addr, value) : null
        break
      */
      case 0x4016:
        this.controller && this.controller.write(value)
        break
      default:
        this.memory[addr] = value
    }
  }

  read(addr) {
    addr = this.filter(addr)
    switch (addr) {
      case 0x2002:
      case 0x2007:
        return this.ppu.readRegister(addr)
      /*
      case 0x4000:
      case 0x4001:
      case 0x4002:
      case 0x4003:
      case 0x4004:
      case 0x4005:
      case 0x4006:
      case 0x4007:
      case 0x4008:
      case 0x400a:
      case 0x400b:
      case 0x400c:
      case 0x400e:
      case 0x400f:
      case 0x4010:
      case 0x4011:
      case 0x4012:
      case 0x4013:
      case 0x4015:
        return this.apu.readRegister(addr)
      */
      case 0x4016:
        return this.controller ? this.controller.read() : 0x0
      default:
        return this.memory[addr]
    }
  }
}
