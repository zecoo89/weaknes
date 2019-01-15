import registerModules from './registerModules'

export default class Apu {
  constructor() {
    this.init()
  }

  init() {
    this.registers = {}
    for (let i = 0x4000; i <= 0x4015; i++) {
      this.registers[i] = 0x00
    }

    this.initSquareWaveChannels()
  }

  initSquareWaveChannels() {
    this.squareWaveCh1 = registerModules.makeSquareWaveCh()
    this.squareWaveCh2 = registerModules.makeSquareWaveCh()

    this.triangleWaveCh = registerModules.makeTriangleWaveCh()
  }

  // 音声出力用のオブジェクトと接続する
  connect(parts) {
    parts.audio && (this.audio = parts.audio)
  }

  read(addr) {
    return this.registers[addr]
  }

  write(addr, value) {
    this.registers[addr] = value
    registerModules[addr].call(this, value)
  }
}
