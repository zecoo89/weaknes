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
    this.layers.connect({ vram: this.vram })
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
    this.isAlreadyZeroSpriteHit = false
  }

  bindModules() {
    for (let e of Object.keys(modules)) this[e] = modules[e]
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.cpu && this.oam.connect(parts)

    if (parts.screen) {
      this.screen = parts.screen
      this.renderer.connect(parts)
    }
  }

  run() {
    const isBackgroundEnabled = this.registers[0x2001].isBackgroundEnabled()
    const isSpriteEnabled = this.registers[0x2001].isSpriteEnabled()
    const isRenderingEnabled = isBackgroundEnabled || isSpriteEnabled
    const hPosition = this.hPosition()
    const vPosition = this.vPosition()

    hPosition === 256 && (this.isHblank = true)
    hPosition === 0 && (this.isHblank = false)

    /* Setting vblank */
    if (this.isVblankStart()) {
      this.screen && this.screen.refresh()
      this.registers[0x2002].setVblank()
      this.registers[0x2000].isNmiEnabled() && this.cpu.nmi()
    } else if (this.isVblankEnd()) {
      this.registers[0x2002].clearVblank()
      this.registers[0x2002].clearZeroSpriteHit()
      this.isAlreadyZeroSpriteHit = false
      this.loader.loadAllOnEachLayer()
    }

    if (!isRenderingEnabled) return

    const isRendering = !this.registers[0x2002].isVblank()
    if (isRendering) {
      if (hPosition === 256) {
        this.registers[0x2002].clearZeroSpriteHit()
        this.incrementY()
      }

      if (hPosition === 257) {
        this.copyHorizontalPosition()
      }
    }

    if (!this.isHblank && isRendering) {
      const isZeroSpriteHit = this.isZeroSpriteHit(hPosition, vPosition)
      isZeroSpriteHit && this.registers[0x2002].setZeroSpriteHit()
      this.renderer.render(hPosition, vPosition)
      this.incrementX()
    } else {
      if (vPosition === 261) {
        hPosition === 304 && this.copyVerticalPosition()
      }
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
    this.renderer.endX = isVerticalMirror
      ? this.renderer.width * 2
      : this.renderer.width
    this.renderer.endY = isVerticalMirror
      ? this.renderer.height
      : this.renderer.height * 2
    this.loader.secondScreenAddr = isVerticalMirror ? 0x2400 : 0x2800

    this.renderer.setScreenIndex(isVerticalMirror)
  }
}
