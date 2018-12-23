import Registers from './registers'
import Ram from './ram'
import opcodes from './opcodes'
import Util from '../util'

/* 6502 CPU */
export default class Cpu {
  constructor(isDebug) {
    this.init()
    this.isDebug = isDebug
  }

  init() {
    this.registers = new Registers()
    //this.opcodes = opcodes
    this.opcodes = opcodes.map(opcode => {
      return typeof opcode === 'function' ? opcode.bind(this) : opcode
    })

    this.ram = new Ram()
  }

  connect(parts) {
    parts.bus && this.ram.connect(parts)
  }

  reset() {
    this.init()
    this.run()
  }

  run() {
    const execute = this.eval.bind(this)

    Util.isNodejs() ? setInterval(execute, 10) : execute()
  }

  // 命令を処理する
  eval() {
    const addr = this.registers.pc++
    const opcode = this.ram.read(addr)

    if (typeof this.opcodes[opcode] !== 'function') {
      throw new Error('0x' + opcode.toString(16) + ' is not implemented')
    }

    this.opcodes[opcode].call()

    if (!Util.isNodejs()) {
      const fn = this.eval.bind(this)
      window.requestAnimationFrame(fn)
    }
  }

  /* 0x8000~のメモリにROM内のPRG-ROMを読み込む*/
  set prgRom(prgRom) {
    //this.interruptVectors(prgRom)
    const startAddr = 0xffff - prgRom.length
    this.registers.pc = startAddr

    for (let i = 0; i < prgRom.length; i++) {
      //this.memory[startAddr+i] = prgRom[i]
      this.ram.write(startAddr + i, prgRom[i])
    }

    // プログラムカウンタの初期値を0xFFFCから設定する
    //this.registers.pc = this.ram.read(0xfffc) << 2
  }

  /* スタック領域に対する操作*/
  stackPush(value) {
    this.ram.write(this.registers.sp, value)
    this.registers.sp--
  }

  stackPop() {
    return this.ram.read(++this.registers.sp)
  }
}
