import Vram from './vram'
import Oam from './oam'
import RegistersFactory from './registers'
import Renderer from './renderer'

export default class Ppu {
  constructor() {
    this.init()
  }

  init() {
    this.vram = new Vram()
    this.oam = new Oam()
    this.registers = RegistersFactory.create(this)
    this.renderer = new Renderer()

    this.oam.connect({ ppu: this })
    this.registers.connect({
      vram: this.vram,
      oam: this.oam,
      registers: this.registers
    })

    this.cycles = 0 // PPU cycles
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.cpu && this.oam.connect(parts)

    if(parts.screen) {
      this.screen = parts.screen
      this.screen.pixels = this.renderer.pixels
    }
  }

  cycles(cpuCycles_) {
    let cpuCycles = cpuCycles_

    if (this.ppu.registers[0x2002].isVblank()) {
      cpuCycles = 0
    } else {
      for (; cpuCycles >= 4; cpuCycles -= 4) {
        this.renderer.render()
        this.screen.refresh()
      }
    }

    const consumedCpuCycle = cpuCycles - cpuCycles_
    this.cycles += (consumedCpuCycle - (consumedCpuCycle % 3)) / 3

    /*** Judging Vblank begin ***/
    // 61440 = 256 * 240
    if (this.cycles >= 61440) {
      this.ppu.registers[0x2002].setVblank()
    } else {
      this.ppu.registers[0x2002].clearVblank()
    }

    // 5120 = 256 * 20
    if (this.cycles >= 61440 + 5120) {
      this.cycles = 0
      this.ppu.registers[0x2002].clearVblank()
      this.renderer.renderAllOnEachLayer()
    }
    /*** Judging Vblank end ***/

    return consumedCpuCycle
  }

  readRegister(addr) {
    if (addr === 0x2002) {
      this.registers[0x2005].clearLatch()
      this.registers[0x2006].clearLatch()
    }

    return this.registers[addr].read()
  }

  writeRegister(addr, value) {
    this.registers[addr].write(value)
  }

  /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
  set chrRom(chrRom) {
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i])
    }

    /* CHR領域からタイルを抽出しておく */
    this.renderer.extractTiles()
  }
}
