import Registers from './registers'
import Ram from './ram'
import opcodes from './opcodes'
import OpcodeUtil from './opcodes/util'

/* 2A03 CPU */
export default class Cpu {
  constructor(isDebug) {
    this.isDebug = isDebug
    this.init()
  }

  init() {
    this.registers = new Registers()
    this.ram = new Ram()
    this.ram.connect({ cpu: this })
    this.opcodes = opcodes
    this.executeOpcode = this.isDebug
      ? OpcodeUtil.debug.bind(this)
      : OpcodeUtil.execute.bind(this)
    this.debtCycles = 0
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

  /* Run a cycle */
  run(cycles) {
    this.cycles(cycles)
  }

  /* Run instructions of 1/60 frame */
  frame() {
    this.cycles(29780)
  }

  /* Run cycles
   * return actual consumed cycles
   * */
  cycles(_cycles) {
    let cycles = this.debtCycles

    for (; cycles < _cycles; ) cycles += this.eval()

    this.debtCycles = cycles - _cycles

    return cycles
  }

  eval() {
    const addr = this.registers.pc++
    const opcodeId = this.ram.read(addr)

    return this.executeOpcode(this.opcodes[opcodeId])
  }

  isInterruptable() {
    return this.ppu.registers[0x2000].isNmiInterruptable()
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
  set rom(rom) {
    const prgRom = rom.prgRom
    let startAddr = 0x8000

    for (let i = 0; i < prgRom.length; i++) {
      this.ram.write(startAddr + i, prgRom[i])
    }

    if (prgRom.length === 0x4000) {
      startAddr = 0xc000
      // 0xc000~に0x8000~のコピーを置く
      for (let i = 0; i < prgRom.length; i++) {
        this.ram.write(startAddr + i, prgRom[i])
      }
    }

    this.nmiAddr = this.ram.read(0xfffa) | (this.ram.read(0xfffb) << 8)
    this.resetAddr = (this.ram.read(0xfffd) << 8) | this.ram.read(0xfffc)
    this.irqBrkAddr = (this.ram.read(0xfffe) << 8) | this.ram.read(0xffff)
    // プログラムカウンタの初期値を0xFFFDから設定する
    this.registers.pc = this.resetAddr ? this.resetAddr : 0x8000

    //eslint-disable-next-line
    console.log('NMI: 0x' + this.nmiAddr.toString(16))
    //eslint-disable-next-line
    console.log('RESET: 0x' + this.resetAddr.toString(16))
    //eslint-disable-next-line
    console.log('IRQ/BRK: 0x' + this.irqBrkAddr.toString(16))
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
