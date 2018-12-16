import Cpu from './cpu'
import Ppu from './ppu'
import Bus from './bus'

export default class Nes {
  constructor() {
    const isDebug = true

    this.cpu = new Cpu(isDebug)
    this.ppu = new Ppu()
    this.bus = new Bus()
    this.ppu.connect({ bus: this.bus })
    this.cpu.connect({ bus: this.bus })
  }

  connect(renderer) {
    this.ppu.connect({ renderer })
  }

  get rom() {
    return this._rom
  }

  set rom(rom) {
    this._rom = rom
  }

  run(isDebug) {
    this.cpu.prgRom = this.rom.prgRom
    this.ppu.chrRom = this.rom.chrRom

    this.cpu.run(isDebug)
  }
}
