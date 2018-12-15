import registers from "./registers";
import Ram from "./ram";
import opcodes from "./opcodes";

/* 6502 CPU */
export default class Cpu {
  constructor() {
    this.init();
  }

  init() {
    this.registers = registers; // レジスタ
    this.opcodes = opcodes; //命令一覧
    //this.opcodes = opcodes.map(opcode => opcode.bind(this)) // 命令一覧

    this.ram = new Ram();
  }

  connect(parts) {
    parts.bus && this.ram.connect(parts);
  }

  reset() {
    this.init();
  }

  run(isDebug) {
    const run = isDebug ? this.debug.bind(this) : this.eval.bind(this);

    setInterval(run, 70);
  }

  // 命令を処理する
  eval() {
    const addr = this.registers.pc++;
    //const opcode = this.memory[i]
    const opcode = this.ram.read(addr);

    this.opcodes[opcode].call();
  }

  /* eslint-disable no-console */
  debug() {
    const addr = this.registers.pc++;
    //const opcode = this.memory[i]
    const opcode = this.ram.read(addr);

    if (typeof this.opcodes[opcode] !== "function") {
      console.error("Not implemented: " + opcode.toString(16));
      console.error(this.opcodes[opcode]);
    }

    const debugString = this.opcodes[opcode].bind(this).call();
    console.log(debugString);
  }

  /* 0x8000~のメモリにROM内のPRG-ROMを読み込む*/
  set prgRom(prgRom) {
    const startAddr = 0x8000;

    for (let i = 0; i < prgRom.length; i++) {
      //this.memory[startAddr+i] = prgRom[i]
      this.ram.write(startAddr + i, prgRom[i]);
    }
  }
}
