export default class Ram {
  constructor() {
    this.memory = new Uint8Array(0x10000).fill(0)
  }

  connect(parts) {
    parts.ppu && (this.ppu = parts.ppu)
    parts.apu && (this.apu = parts.apu)
    parts.controller && (this.controller = parts.controller)
  }

  write(addr, value) {
    switch (addr) {
      case 0x2000:
      case 0x2001:
      case 0x2003:
      case 0x2004:
      case 0x2005:
      case 0x2006:
      case 0x2007:
      case 0x4014:
        this.ppu.registers[addr].write(value)
        break
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
        this.apu ? this.apu.write(addr, value) : null
        break
      case 0x4016:
        this.controller ? this.controller.write(value) : null
        break
      default:
        this.memory[addr] = value
    }
  }

  read(addr) {
    if(addr !== 0x2005)
      this.ppu.registers[0x2005].resetRewriteCycles()

    switch (addr) {
      case 0x2002:
      case 0x2007:
        return this.ppu.registers[addr].read()
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
        return this.apu.read(addr)
      case 0x4016:
        return this.controller ? this.controller.read() : 0x0
      default:
        return this.memory[addr]
    }
  }
}
