import Nes from './nes'
import Controller from './controller'
import Screen from './screen'
import Audio from './audio'
import Rom from './rom'
import { envType as env } from './utils'

export default class AllInOne {
  constructor(screenId, isDebug) {
    this.nes = new Nes(isDebug)

    if (env !== 'nodejs') {
      const controller = new Controller()
      const screen = new Screen.Browser(screenId)
      const audio = new Audio()
      this.nes.connect({
        screen,
        audio,
        controller
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
