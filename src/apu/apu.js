import RegistersFactory from './registers'
import Utils from './utils'

export default class Apu {
  constructor() {
    this.init()
  }

  init() {
    this.registers = RegistersFactory.create()
  }

  /* 音声出力と接続する */
  connect(parts) {
    parts.audio && (this.audio = parts.audio)
  }

  readRegister(addr) {
    return this.registers[addr]
  }

  writeRegister(addr, value) {
    this.registers[addr].write(value)

    let settings
    switch (addr) {
      case 0x4003:
        settings = Utils.extractSettingsOfSquareWaveCh1.call(this)
        this.audio.sound(settings)
        break
      case 0x4007:
        settings = Utils.extractSettingsOfSquareWaveCh2.call(this)
        this.audio.sound(settings)
        break
      default:
        break
    }
  }
}
