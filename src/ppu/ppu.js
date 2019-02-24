import Vram from './vram'
import Oam from './oam'
import RegistersFactory from './registers'
import Renderer from './renderer'
import Layers from './layers'
import Loader from './loader'
import modules from './modules'

export default class Ppu {
  constructor() {
    this.init()
    this.bindModules()
  }

  init() {
    this.vram = new Vram()
    this.oam = new Oam()
    this.registers = RegistersFactory.create(this)

    this.layers = new Layers()

    this.renderer = new Renderer()
    this.loader = new Loader()

    this.oam.connect({ ppu: this })
    this.layers.connect({vram: this.vram})
    this.renderer.connect({
      vram: this.vram,
      oam: this.oam,
      registers: this.registers,
      layers: this.layers
    })
    this.loader.connect({
      layers: this.layers,
      vram: this.vram,
      oam: this.oam,
      registers: this.registers
    })

    this.cycles = 0
    this.cyclesPerLine = 341
    this.cyclesPerFrame = 89342
    this.isHblank = false
  }

  bindModules() {
    for(let e of Object.keys(modules))
      this[e] = modules[e]
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.cpu && this.oam.connect(parts)

    if(parts.screen) {
      this.screen = parts.screen
      this.renderer.connect(parts)
    }
  }

  run() {
    if(this.isVblankStart()) {
      this.screen && this.screen.refresh()
      this.registers[0x2002].setVblank()
      this.registers[0x2000].isNmiEnabled() && this.cpu.nmi()
    } else if(this.isVblankEnd()) {
      this.registers[0x2002].clearVblank()
      /* y is 0 ~ 239 */
      if(this.registers[0x2005].verticalScrollPosition < 240) {
        this.renderer.scrollY = this.registers[0x2005].verticalScrollPosition
        this.loader.loadAllOnEachLayer()
      }

    }

    if(this.isHblankStart()) {
      this.registers[0x2002].clearZeroSpriteFlag()
      this.isHblank = true
      return
    } else if(this.isHblank) {
      if(this.isHblankEnd()) {
        this.isHblank = false
      }
      return
    }

    if(!this.registers[0x2002].isVblank()) {
      /* Check zero sprite overlap */
      this.isZeroSpriteOverlapped() && this.registers[0x2002].setZeroSpriteFlag()
      this.renderer.render()
    }
  }

  readRegister(addr) {
    return this.registers[addr].read()
  }

  writeRegister(addr, value) {
    this.registers[addr].write(value)
  }

  /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
  set rom(rom) {
    const chrRom = rom.chrRom
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i])
    }

    this.loader.tiles.extract()

    const isVerticalMirror = rom.isVerticalMirror()
    this.renderer._offsetX = isVerticalMirror ? 256 : 0
    this.renderer._offsetY = isVerticalMirror ? 0 : 240
    this.loader.offsetX = isVerticalMirror ? 256 : 0
    this.loader.offsetY = isVerticalMirror ? 0 : 240
    this.renderer.endX = isVerticalMirror ? this.renderer.width * 2 : this.renderer.width
    this.renderer.endY = isVerticalMirror ? this.renderer.height : this.renderer.height * 2
    this.loader.secondScreenAddr = isVerticalMirror ? 0x2400 : 0x2800

    this.renderer.setScreenIndex(isVerticalMirror)
  }
}
