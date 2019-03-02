import Cpu from './cpu'
import Ppu from './ppu'
import Apu from './apu'
import Controller from './controller'
import Screen from './screen'
import Audio from './audio'
import Rom from './rom'
import { envType as env } from './utils'

export default class Nes {
  constructor(isDebug) {
    this.cpu = new Cpu(isDebug)
    this.ppu = new Ppu()
    this.apu = new Apu()
    this.controller = new Controller()

    this.ppu.connect({ cpu: this.cpu })
    this.cpu.connect({ ppu: this.ppu })
    this.cpu.connect({ apu: this.apu })
    this.cpu.connect({ controller: this.controller })

    this.frames = 0
    this.startTime = 0
    this.endTime = 0
  }

  connect(parts) {
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
    const frame = this.frame.bind(this)
    env === 'nodejs' ? setInterval(frame, 1000 / 60) : frame()
  }

  frame() {
    this.step()
    this.calcFps()
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
    if (env !== 'nodejs') window.requestAnimationFrame(this.frame.bind(this))
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

export class AllInOne {
  constructor(screenId, isDebug) {
    this.nes = new Nes(isDebug)

    if (env !== 'nodejs') {
      const screen = new Screen.Browser(screenId)
      const audio = new Audio()
      this.nes.connect({
        screen,
        audio
      })
    }
  }

  async run(romPath) {
    if (env === 'browser') {
      const data = await this.download(romPath)
      this.rom = new Rom(data)
      this.nes.rom = this.rom
    } else if (env === 'nodejs' || env === 'electron:renderer') {
      const data = await this.readFile(romPath)
      this.rom = new Rom(data)
      this.nes.rom = this.rom
    } else {
      throw new Error()
    }

    pcAddr && this.nes.cpu.registers.pc.init(pcAddr)
    this.nes.run()
  }

  async download(romUrl) {
    this.data = await fetch(romUrl)
      .then(response => response.arrayBuffer())
      .then(buffer => new Uint8Array(buffer))

    return this.data
  }

  async readFile(romPath) {
    const fs = require('fs')
    const util = require('util')

    const readFile = util.promisify(fs.readFile)
    this.data = await readFile(romPath)

    return this.data
  }

  set rom(rom) {
    this.rom_ = rom
  }

  get rom() {
    return this.rom_
  }
}
