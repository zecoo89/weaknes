import Cpu from './cpu'
import Ppu from './ppu'
import Apu from './apu'
import { envType as env } from '../utils'

export default class Nes {
  constructor(isDebug) {
    this.cpu = new Cpu(isDebug)
    this.ppu = new Ppu()
    this.apu = new Apu()

    this.ppu.connect({ cpu: this.cpu })
    this.cpu.connect({ ppu: this.ppu })
    this.cpu.connect({ apu: this.apu })

    this.frames = 0
    this.startTime = 0
    this.endTime = 0
  }

  connect(parts) {
    parts.controller && this.cpu.connect({ controller: parts.controller })
    parts.screen && this.ppu.connect({ screen: parts.screen })
    parts.audio && this.apu.connect({ audio: parts.audio })
  }

  get rom() {
    return this._rom
  }

  set rom(rom) {
    this._rom = rom
    this.cpu.rom = this.rom
    this.ppu.rom = this.rom
  }

  run() {
    const loop = this.loop.bind(this)
    env === 'nodejs' ? setInterval(loop, 1000 / 60) : loop()
  }

  loop() {
    this.step()
    this.nextFrame()
  }

  step() {
    for (this.ppu.cycles = 0; this.ppu.cycles < this.ppu.cyclesPerFrame; ) {
      const cpuCycles = this.cpu.step()
      const ppuCycles = cpuCycles * 2
      for (let i = 0; i < ppuCycles; i++) {
        this.ppu.step()
        this.ppu.cycles++
      }
    }
  }

  nextFrame() {
    if (env !== 'nodejs') {
      this.calcFps()
      window.requestAnimationFrame(this.loop.bind(this))
    }
  }

  calcFps() {
    this.frames++

    if (this.frames === 60) {
      this.frames = 0
      this.endTime = Date.now()

      const time = this.endTime - this.startTime
      const fps = (1000 / time) * 60
      //eslint-disable-next-line
      console.log(Math.round(fps * 100) / 100)

      this.startTime = Date.now()
    }
  }
}
