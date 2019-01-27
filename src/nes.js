import Cpu from './cpu'
import Ppu from './ppu'
import Apu from './apu'
import Controller from './controller'
import Screen from './screen'
import Rom from './rom'
import { isNodejs } from './utils'

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
  }

  run() {
    this.cpu.prgRom = this.rom.prgRom
    this.ppu.chrRom = this.rom.chrRom

    this.cpu.run()
  }
}

export class AllInOne {
  constructor(screenId, isDebug) {
    const screen = new Screen.Browser(screenId)
    const audio = new Audio()

    this.nes = new Nes(isDebug)
    this.nes.connect({
      screen,
      audio
    })
  }

  async run(romPath) {
    if(typeof romPath === 'string') {
      const data = isNodejs() ? await this.readFile(romPath) : await this.download(romPath)
      const rom = new Rom(data)
      this.nes.rom = rom
    } else if(romPath.constructor.name === 'Rom') {
      this.nes.rom = romPath
    } else {
      throw new Error()
    }

    this.nes.run()
  }

  async download(romUrl) {
    const data = await fetch(romUrl)
    .then(response => response.arrayBuffer())
    .then(buffer => new Uint8Array(buffer))

    return data
  }

  async readFile(romPath) {
    const fs = require('fs')
    const util = require('util')

    const readFile = util.promisify(fs.readFile)
    const data = await readFile(romPath)

    return data
  }
}
