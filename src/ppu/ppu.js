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
    this.renderer.connect({
      vram: this.vram,
      oam: this.oam,
      registers: this.registers
    })

    this.preCycles = 0 // PPU cycles before add new cycles
    this.cycles = 0 // PPU cycles
    this.restOfCpuCycles = 0
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.cpu && this.oam.connect(parts)

    if(parts.screen) {
      this.screen = parts.screen
      this.screen.pixels = this.renderer.pixels
    }
  }

  cycle(_cpuCycles) {
    let cpuCycles = _cpuCycles + this.restOfCpuCycles
    this.restOfCpuCycles = 0

    if (this.registers[0x2002].isVblank()) {
      this.preCycles = this.cycles
      this.cycles += cpuCycles * 3 // ppu cycle = cpu cycle * 3
      cpuCycles = 0
    } else {
      for (; cpuCycles >= 4; cpuCycles -= 4) {
        this.renderer.render()

        this.preCycles = this.cycles
        this.cycles += 4 * 3 // 4 = cpu cycle, ppu cycle = cpu cycle * 3

        if(this.isBeginVblank()) break
      }
    }

    this.restOfCpuCycles = cpuCycles

    /*** Decide to begin or end vblank ***/
    if (this.isBeginVblank()) {
      this.screen ? this.screen.refresh() : null
      this.registers[0x2002].setVblank()
      this.cpu.isInterruptable() ? this.cpu.nmi() : null
    }
    if (this.isEndVblank()) {
      this.cycles = 0
      this.registers[0x2002].clearVblank()
      this.renderer.renderAllOnEachLayer()
    }
  }

  isBeginVblank() {
    return this.preCycles < 81920 && this.cycles >= 81920
  }

  isEndVblank() {
    return this.cycles >= 90000
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
    this.renderer.tiles.extract()
  }
}
