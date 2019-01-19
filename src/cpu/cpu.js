import Registers from './registers'
import Ram from './ram'
import opcodes from './opcodes'
import { isNodejs } from '../utils'
import OpcodeUtil from './opcodes/util'

/* 6502 CPU */
export default class Cpu {
  constructor(isDebug) {
    this.init()
    this.isDebug = isDebug
  }

  init() {
    this.registers = new Registers()
    this.ram = new Ram()
    this.opcodes = opcodes
    this.cycle = 0
  }

  connect(parts) {
    parts.ppu && (this.ppu = parts.ppu)
    parts.ppu && this.ram.connect({ ppu: parts.ppu })
    parts.apu && this.ram.connect({ apu: parts.apu })
    parts.controller && this.ram.connect({ controller: parts.controller })
  }

  reset() {
    this.init()
    this.run()
  }

  run() {
    const frame = this.frame.bind(this)
    isNodejs() ? setInterval(frame, 10) : frame()
  }

  // Run instructions of 1/60 frame
  frame() {
    this.cycles(27000)

    /* Vblankをセットする */
    this.ppu.registers[0x2002].setVblank()

    const isInterruptable = this.ppu.registers[0x2000].isNmiInterruptable()
    if (isInterruptable) this.nmi()

    //Vblank分のサイクルを実行する
    this.cycles(3000)

    /* Vblankをクリアする */
    this.ppu.registers[0x2002].clearVblank()

    //背景とスプライトのデータを更新する
    this.ppu.run()

    if (!isNodejs()) window.requestAnimationFrame(this.frame.bind(this))
  }

  cycles(cycles) {
    for (this.cycle = 0; this.cycle < cycles; ) this.eval()
  }

  eval() {
    const addr = this.registers.pc++
    const opcode = this.ram.read(addr)
    OpcodeUtil.execute.call(this, this.opcodes[opcode])
  }

  nmi() {
    const addr = this.registers.pc
    const highAddr = addr >> 8
    const lowAddr = addr & 0x00ff
    this.stackPush(highAddr)
    this.stackPush(lowAddr)
    const statusBits = this.registers.statusAllRawBits
    this.stackPush(statusBits)
    this.registers.pc = this.nmiAddr
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
    const resetAddr = (this.ram.read(0xfffd) << 8) | this.ram.read(0xfffc)
    this.registers.pc = resetAddr ? resetAddr : 0x8000

    this.nmiAddr = this.ram.read(0xfffa) | (this.ram.read(0xfffb) << 8)
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
