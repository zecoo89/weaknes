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
    this.scanlines = 262
    this.cyclesPerFrame = this.cyclesPerLine * this.scanlines
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

  step() {
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

    const isPreScanline = vPosition === 261

    if (isPreScanline && hPosition >= 280 && hPosition <= 304) {
      this.copyY()
    }

    const isRenderLine = !this.registers[0x2002].isVblank()
    if (!this.isHblank && isRenderLine) {
      if (isRenderingEnabled && !this.isAlreadyZeroSpriteHit) {
        const isZeroSpriteHit = this.isZeroSpriteHit(hPosition, vPosition)
        if (isZeroSpriteHit) {
          this.registers[0x2002].setZeroSpriteHit()
          this.isAlreadyZeroSpriteHit = true
        }
      }

      this.renderer.render(hPosition, vPosition)
    }

    if (isRenderLine) {
      if (!this.isHblank && (hPosition & 7) === 7) {
        this.incrementX()
      }

      if (hPosition === 256) {
        this.incrementY()
      }

      if (hPosition === 257) {
        this.copyX()
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
