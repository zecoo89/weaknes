import Cpu from './cpu'
import Ppu from './ppu'
import Apu from './apu'
import Controller from './controller'

export default class Nes {
  constructor(isDebug) {
    this.cpu = new Cpu(isDebug)
    this.ppu = new Ppu()
    this.apu = new Apu()
    this.controller = new Controller()

    this.ppu.connect({ cpu: this.cpu })
    this.cpu.connect({ ppu: this.ppu })
    this.cpu.connect({ apu: this.apu })
    this.cpu.connect({ controller: this.controller })
  }

  connect(parts) {
    parts.renderer && this.ppu.connect({ renderer: parts.renderer })
    parts.audio && this.apu.connect({ audio: parts.audio })
  }

  get rom() {
    return this._rom
  }

  set rom(rom) {
    this._rom = rom
  }

  run() {
    this.cpu.prgRom = this.rom.prgRom
    this.ppu.chrRom = this.rom.chrRom

    this.cpu.run()
  }
}
