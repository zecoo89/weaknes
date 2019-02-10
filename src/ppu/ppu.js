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

    this.cycles = 0
    this.cyclesPerFrame = 89342
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
    if(this.isHblank()) {
      this.registers[0x2002].clearZeroSpriteFlag()
      return
    }

    if(this.registers[0x2002].isVblank()) {
      this.runInVblank()
    } else {
      this.runInRendering()
    }
  }

  isHblank() {
    const x = this.cycles - (this.cycles - (this.cycles % 341))
    //TODO copy t to v
    //const bits = this.
    return x >= 256 && x <= 340
  }

  runInVblank() {
    /* Check vblank ending */
    if(this.renderer.isVblankEnd()) {
      this.registers[0x2002].clearVblank()
      this.registers[0x2002].clearZeroSpriteFlag()
      /* y is 0 ~ 239 */
      this.registers[0x2005].verticalScrollPosition < 240 && this.renderer.loadAllOnEachLayer()
      this.renderer.initPixelPosition()
    }
    this.renderer.incrementPixelPosition()
  }

  runInRendering() {
    this.renderer.render()

    /* Check vblank beginning */
    if(this.renderer.isVblankStart()) {
      this.screen && this.screen.refresh()
      this.registers[0x2002].setVblank()
      this.registers[0x2000].isNmiInterruptable() && this.cpu.nmi()
    }

    /* Check zero sprite overlap */
    if(!this.registers[0x2002].isZeroSpriteOverlapped() && this.isZeroSpriteOverlapped()) {
      this.registers[0x2002].setZeroSpriteFlag()
    }
  }

  isZeroSpriteOverlapped() {
    const isSpriteEnabled = this.registers[0x2001].isSpriteEnabled()
    if(!isSpriteEnabled) {
      return false
    }
    const isBackgroundEnabled = this.registers[0x2001].isBackgroundEnabled()
    if(!isBackgroundEnabled) {
      return false
    }

    const zsPosition = this.oam.zeroSpritePosition()
    const position = this.renderer.position
    const width = this.renderer.width
    const x = position & (width-1)
    const y = (position - (position & (width-1))) / width

    //const isXOverlapped = x >= zsPosition.x && x < zsPosition.x + 8
    //const isYOverlapped = y-7 >= zsPosition.y && y-7 < zsPosition.y + 8
    const isXOverlapped = x === zsPosition.x
    const isYOverlapped = y === zsPosition.y

    return isXOverlapped && isYOverlapped
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
  }
}
