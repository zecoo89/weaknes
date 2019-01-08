import Registers from './registers'
import Ram from './ram'
import opcodes from './opcodes'
import Util from '../util'
import OpcodeUtil from './opcodes/util'

/* 6502 CPU */
export default class Cpu {
  constructor(isDebug) {
    this.init()
    this.isDebug = isDebug
    this.cycle = 0
  }

  init() {
    this.registers = new Registers()
    this.opcodes = opcodes

    this.ram = new Ram()
  }

  connect(parts) {
    parts.ppu && (this.ppu = parts.ppu)
    parts.ppu && this.ram.connect(parts)
    parts.controller && this.ram.connect(parts)
  }

  reset() {
    this.init()
    this.run()
  }

  run() {
    const execute = this.eval.bind(this)

    Util.isNodejs() ? setInterval(execute, 10) : execute()
  }

  // Run instructions of 1/60 frame
  eval() {
    for (;;) {
      const addr = this.registers.pc++
      const opcode = this.ram.read(addr)

      OpcodeUtil.execute.call(this, this.opcodes[opcode])

      if (this.cycle > 30000) break
    }

    const isInterruptable = this.ppu.setting >> 7
    if(isInterruptable) {
      //TODO レジスタをすべて保存してからnmiアドレスに遷移する
      const addr = this.registers.pc
      const highAddr = addr >> 8
      const lowAddr = addr & 0x00ff
      this.stackPush(highAddr)
      this.stackPush(lowAddr)
      const statusBits = this.registers.statusAllRawBits
      this.stackPush(statusBits)
      this.registers.pc = this.nmi

      //Vblank分のサイクルを実行する
      this.cycle = 0
      for (; this.cycle < 3000; ) {
        const addr = this.registers.pc++
        const opcode = this.ram.read(addr)
        OpcodeUtil.execute.call(this, this.opcodes[opcode])
      }
    }

    //背景とスプライトのデータを更新する
    this.ppu.run()
    this.cycle = 0

    if (!Util.isNodejs()) window.requestAnimationFrame(this.eval.bind(this))
  }

  /* 0x8000~のメモリにROM内のPRG-ROMを読み込む*/
  set prgRom(prgRom) {
    let startAddr = 0x8000
    for (let i = 0; i < prgRom.length; i++) {
      this.ram.write(startAddr + i, prgRom[i])
    }

    startAddr = 0xc000
    // 0xc000~に0x8000~のコピーを置く
    for (let i = 0; i < prgRom.length; i++) {
      this.ram.write(startAddr + i, prgRom[i])
    }

    // プログラムカウンタの初期値を0xFFFDから設定する
    const resetAddr = this.ram.read(0xfffd) << 8
    this.registers.pc = resetAddr ? resetAddr : 0x8000

    this.nmi = this.ram.read(0xfffa) | (this.ram.read(0xfffb) << 8)
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
