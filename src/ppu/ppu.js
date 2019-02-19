import Vram from './vram'
import Oam from './oam'
import RegistersFactory from './registers'
import Renderer from './renderer'
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
    this.renderer = new Renderer()

    this.vram.connect({ renderer: this.renderer })
    this.oam.connect({ ppu: this })
    this.renderer.connect({
      vram: this.vram,
      oam: this.oam,
      registers: this.registers
    })

    this.cycles = 0
    this.cyclesPerLine = 341
    this.cyclesPerFrame = 89342
    this.isHblank = false
    this.zeroSpritePosition = this.oam.zeroSpritePosition()
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
      //this.registers[0x2005].verticalScrollPosition < 240 && this.renderer.loadAllOnEachLayer()
      this.renderer.loadAllOnEachLayer()
      this.zeroSpritePosition = this.oam.zeroSpritePosition()
    }

    if(this.isHblankStart()) {
      this.registers[0x2002].clearZeroSpriteFlag()
      this.isHblank = true
      //this.renderer.mainScreenNumber = this.registers[0x2000].mainScreenNumber()
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

    this.renderer.tiles.extract()

    this.renderer.isVerticalMirror = rom.isVerticalMirror()
    this.renderer._offsetX = this.renderer.isVerticalMirror ? 256 : 0
    this.renderer._offsetY = this.renderer.isVerticalMirror ? 0 : 240
    this.renderer.endX = this.renderer.isVerticalMirror ? this.renderer.width * 2 : this.renderer.width
    this.renderer.endY = this.renderer.isVerticalMirror ? this.renderer.height : this.renderer.height * 2
    this.renderer.secondScreenAddr = rom.isVerticalMirror() ? 0x2400 : 0x2800
    this.renderer.layerOffsetOfNametable = this.renderer.isVerticalMirror ? {
      0x2000: { x:0, y:0 },
      0x2400: { x:256, y:0 },
      0x2800: { x:0, y:0 },
      0x2c00: { x:256, y:0 }
    } : {
      0x2000: { x:0, y:0 },
      0x2400: { x:0, y:0 },
      0x2800: { x:0, y:240 },
      0x2c00: { x:0, y:240 }
    }
  }
}
