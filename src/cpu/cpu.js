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
    const execute = this.isDebug ? this.debug.bind(this) : this.eval.bind(this)

    Util.isNodejs() ? setInterval(execute, 100) : execute()
  }

  // 命令を処理する
  eval() {
    const addr = this.registers.pc++
    const opcode = this.ram.read(addr)

    this.opcodes[opcode].call()

    const fn = this.eval.bind(this)

    if (!Util.isNodejs()) window.requestAnimationFrame(fn)
  }

  /* eslint-disable no-console */
  debug() {
    const addr = this.registers.pc++
    //const opcode = this.memory[i]
    const opcode = this.ram.read(addr)

    if (typeof this.opcodes[opcode] !== 'function') {
      console.error('Not implemented: ' + opcode.toString(16))
      console.error(this.opcodes[opcode])
    }

    const debugString = this.opcodes[opcode].call()
    console.log('$' + addr.toString(16) + ':' + debugString)

    const fn = this.debug.bind(this)

    if (!Util.isNodejs()) window.requestAnimationFrame(fn)
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
  }

  /* //TODO 割り込みベクタの設定を行う
   * NMI	    0xFFFA	0xFFFB
   * RESET	  0xFFFC	0xFFFD
   * IRQ、BRK	0xFFFE	0xFFFF
   *
  interruptVectors(prgRom) {
    const startAddr = 0xffff - prgRom.length

    const resetHighAddr = prgRom[0xfffc - 0xc000]
    const resetLowAddr = prgRom[0xfffd - 0xc000]
    const RESET = resetHighAddr << 8 | resetLowAddr
  }
  /**/

  /* スタック領域に対する操作*/
  stackPush(value) {
    this.ram.write(this.registers.sp, value)
    this.registers.sp--
  }

  stackPop() {
    return this.ram.read(++this.registers.sp)
  }
}
