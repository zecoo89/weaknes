import Cpu from './cpu'
import Ppu from './ppu'
import Bus from './bus'
import Controller from './controller'
import Util from './util'

export default class Nes {
  constructor(isDebug) {
    this.cpu = new Cpu(isDebug)
    this.ppu = new Ppu()
    this.bus = new Bus()
    this.ppu.connect({ bus: this.bus })
    this.cpu.connect({ bus: this.bus })

    if (!Util.isNodejs()) {
      this.controller = new Controller()
      this.cpu.connect({ controller: this.controller })
    }
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

  run() {
    this.cpu.prgRom = this.rom.prgRom
    this.ppu.chrRom = this.rom.chrRom

    this.cpu.run()
  }
}
