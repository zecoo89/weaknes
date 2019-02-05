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
      this.screen.pixels = this.renderer.pixels
    }
  }

  run() {
    if(this.isHblank()) return

    if(this.registers[0x2002].isVblank()) {
      this.runInVblank()
    } else {
      this.runInRendering()
    }
  }

  isHblank() {
    const x = this.cycles - (this.cycles - (this.cycles % 341))
    return x >= 256 && x <= 340
  }

  runInVblank() {
    /* Check vblank ending */
    if(this.renderer.isVblankEnd()) {
      this.registers[0x2002].clearVblank()
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
    if(this.isZeroSpriteOverlapped()) {
      this.registers[0x2002].setZeroSpriteFlag()
    } else {
      this.registers[0x2002].clearZeroSpriteFlag()
    }
  }

  isZeroSpriteOverlapped() {
    const zsPosition = this.oam.zeroSpritePosition()
    const position = this.renderer.position
    const width = this.renderer.width
    const x = position & (width-1)
    const y = (position - (position & (width-1))) / width

    const isXOverlapped = x >= zsPosition.x && x < zsPosition.x + 8
    const isYOverlapped = y >= zsPosition.y && y < zsPosition.y + 8
    //const isXOverlapped = x === zsPosition.x
    //const isYOverlapped = y === zsPosition.y

    return isXOverlapped && isYOverlapped
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
  set rom(rom) {
    const chrRom = rom.chrRom
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i])
    }

    this.renderer.tiles.extract()

    this.renderer.isVerticalMirror = rom.isVerticalMirror()
    this.renderer.offsetX = this.renderer.isVerticalMirror ? 256 : 0
    this.renderer.offsetY = this.renderer.isVerticalMirror ? 0 : 240
    this.renderer.endX = this.renderer.isVerticalMirror ? this.renderer.width * 2 : this.renderer.width
    this.renderer.endY = this.renderer.isVerticalMirror ? this.renderer.height : this.renderer.height * 2
    this.renderer.secondScreenStartAddr = rom.isVerticalMirror() ? 0x2400 : 0x2800
  }
}
