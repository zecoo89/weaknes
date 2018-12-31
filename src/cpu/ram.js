export default class Ram {
  constructor() {
    this.memory = new Uint8Array(0x10000).fill(0)
  }

  connect(parts) {
    parts.ppu && (this.ppu = parts.ppu)
    parts.controller && (this.controller = parts.controller)
  }

  write(addr, value) {
    switch (addr) {
      case 0x2000:
        this.ppu.setting = value
        break
      case 0x2001:
        this.ppu.screenSetting = value
        break
      case 0x2003:
        this.ppu.oam.pointer = value
        break
      case 0x2004:
        this.ppu.oam.write(value)
        break
      case 0x2005:
        this.ppu.scrollSetting = value
        break
      case 0x2006:
        this.ppu.vram.pointer = value
        break
      case 0x2007:
        this.ppu.vram.write(this.ppu.vram.pointer, value)
        break
      case 0x4014:
        this.ppu.oam.dma(value)
        break
      default:
        this.memory[addr] = value
    }
  }

  read(addr) {
    switch (addr) {
      case 0x2002:
        //TODO 二回書き込むタイプのレジスタは途中で他のところにアクセスするとリセットされる？
        this.ppu.scrollSetting_.length = 0
        return this.ppu.registers.status.raw
      case 0x2007:
        return this.ppu.vram.read(addr)
      case 0x4016:
        return this.controller ? this.controller.read() : 0x0
      default:
        return this.memory[addr]
    }
  }
}
