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
    this.nes = new Nes(isDebug)

    if(env !== 'nodejs') {
      const screen = new Screen.Browser(screenId)
      const audio = new Audio()
      this.nes.connect({
        screen,
        audio
      })
    }
  }

  async run(romPath) {
    if(env === 'browser') {
      const data = await this.download(romPath)
      this.rom = new Rom(data)
      this.nes.rom = this.rom
    } else if(env === 'nodejs' || env === 'electron:renderer') {
      const data = await this.readFile(romPath)
      this.rom = new Rom(data)
      this.nes.rom = this.rom
    } else {
      throw new Error()
    }

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
