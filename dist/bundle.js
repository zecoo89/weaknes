(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.NesPack = {})));
}(this, (function (exports) { 'use strict';

  var registers = {
    acc: 0x00, // アキュムレータ：汎用演算
    indexX: 0x00, // インデックスレジスタ：アドレッシング、カウンタ等
    indexY: 0x00, // 上に同じ
    sp: 0x01fd, // スタックポインタ
    status: {
      // ステータスレジスタ：CPUの各種状態を保持する
      negative_: 0,
      overflow_: 0,
      reserved_: 1,
      break_: 1, // 割り込みBRK発生時にtrue,IRQ発生時にfalse
      decimal_: 0,
      interrupt_: 1,
      zero_: 0,
      carry_: 0
    },
    pc: 0x8000 // プログラムカウンタ
  };

  class Ram {
    constructor() {
      this.memory = new Uint8Array(0x10000);
    }

    /* Memory mapped I/Oであるため，バス(Bus)を接続しておく
     * PPU等へはBusを通してデータのやり取りを行う
     * */
    connect(parts) {
      parts.bus && (this.bus = parts.bus);
    }

    /*TODO 各ポート(addr)にアクセスがあった場合にはバスに書き込む */
    write(addr, value) {
      if (addr >= 0x2000 && addr <= 0x2007) {
        this.bus.write(addr, value);
        return;
      }

      // 通常のメモリアクセス
      this.memory[addr] = value;
    }

    /*TODO コントローラ用のポート */
    read(addr) {
      return this.memory[addr];
    }
  }

  /* 0x00 - 0x0F */
  var x0x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0x10 - 0x1F */
  var x1x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0x20 - 0x2F */
  var x2x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0x30 - 0x3F */
  var x3x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  var Addressing = {
    /* 8bitの即値なのでアドレスをそのまま返す */
    immediate: function() {
      const addr = this.registers.pc++;
      return addr;
    },

    /* アドレスaddr(8bit)を返す */
    zeropage: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_);
      return addr;
    },

    /* (アドレスaddr + レジスタindexX)(8bit)を返す */
    zeropageX: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_) + this.registers.indexX;
      return addr & 0xff;
    },

    /* 上と同じでindexYに替えるだけ*/
    zeropageY: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_) + this.registers.indexY;
      return addr & 0xff;
    },

    /* zeropageのaddrが16bit版 */
    absolute: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = lowAddr | (highAddr << 8);

      return addr & 0xffff;
    },

    absoluteX: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | (highAddr << 8)) + this.registers.indexX;

      return addr & 0xffff;
    },

    absoluteY: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | (highAddr << 8)) + this.registers.indexY;

      return addr & 0xffff;
    },

    indirect: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr_ = lowAddr | (highAddr << 8);
      const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);

      return addr & 0xffff;
    },

    indexIndirect: function() {
      const addr__ = this.registers.pc++;
      let addr_ = this.ram.read(addr__) + this.registers.indexX;
      addr_ = addr_ & 0x00ff;

      const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);

      return addr & 0xffff;
    },

    indirectIndex: function() {
      const addr__ = this.registers.pc++;
      const addr_ = this.ram.read(addr__);

      let addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);
      addr = addr + this.registers.indexY;

      return addr & 0xffff;
    },

    /* (プログラムカウンタ + オフセット)を返す。
     * オフセットの計算では符号付きの値が使用される。
     * 符号付きの値は
     *   -128(0x80) ~ -1 (0xff)
     *   0(0x00) ~ 127(0x7f)
     * */
    relative: function() {
      const addr_ = this.registers.pc++;
      const signedNumber = this.ram.read(addr_);

      let addr =
        signedNumber >= 0x80
          ? this.registers.pc + signedNumber - 0x100
          : this.registers.pc + signedNumber;

      return addr;
    }
  };

  class Util {
    static isNegative(value) {
      return value >> 7;
    }

    static isZero(value) {
      return (value === 0x00) & 1;
    }

    static msb(value) {
      return value >> 7;
    }

    static lsb(value) {
      return value & 0x01;
    }
  }

  var Instructions = {
    /* LD* (Load memory[addr) to * register)
     * フラグ
     *   - negative_ : 計算結果が負の値のとき1そうでなければ0(accの7bit目と同じ値になる)
     *   - zero_ : 計算結果がゼロのとき1そうでなければ0
     * */
    LDA: function(addr) {
      const value = this.ram.read(addr);
      this.registers.acc = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },
    /* レジスタindexXにdataをロードする */
    LDX: function(addr) {
      const value = this.ram.read(addr);
      this.registers.indexX = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    LDY: function(addr) {
      const value = this.ram.read(addr);
      this.registers.indexY = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* ST* (Store memory[addr) to * register)
     * フラグ操作は無し
     * */
    STA: function(addr) {
      this.ram.write(addr, this.registers.acc);
    },

    STX: function(addr) {
      this.ram.write(addr, this.registers.indexX);
    },

    STY: function(addr) {
      this.ram.write(addr, this.registers.indexY);
    },

    /* T** (Transfer * register to * register)
     * フラグ
     *   - negative_
     *   - zero_
     * */
    TAX: function() {
      const value = this.registers.acc;
      this.registers.indexX = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    TAY: function() {
      const value = this.registers.acc;
      this.registers.indexY = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    TSX: function() {
      const value = this.registers.sp;
      this.registers.indexX = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    TXA: function() {
      const value = this.registers.indexX;
      this.registers.acc = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    TXS: function() {
      const value = this.registers.indexX;
      this.registers.sp = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    TYA: function() {
      const value = this.registers.indexY;
      this.registers.acc = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* acc & memory[addr)
     * フラグ
     *   - negative_
     *   - zero_
     * */
    AND: function(addr) {
      const value = this.registers.acc & this.ram.read(addr);
      this.registers.acc = value;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* Aまたはメモリを左へシフト
     * フラグ
     *   - negative_
     *   - zero_
     *   - carry_
     * */
    ASL: function(addr) {
      const value = this.ram.read(addr);
      const msb = Util.msb(value);
      this.ram.write(addr, value << 1);
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
      this.registers.status.carry_ = msb;
    },

    /* accまたはメモリを右へシフト
     * フラグ
     *   - negative_
     *   - zero_
     *   - carry_
     * */
    LSR: function(addr) {
      const value = this.ram.read(addr);
      const lsb = Util.lsb(value);
      this.ram.write(addr, value >> 1);
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
      this.registers.status.carry_ = lsb;
    },

    /* AとメモリをAND演算してフラグを操作する
     * 演算結果は捨てる
     * */
    BIT: function(addr) {
      return addr;
    },

    /* Aとメモリを比較演算してフラグを操作
     * 演算結果は捨てる
     * A == mem -> Z = 0
     * A >= mem -> C = 1
     * A <= mem -> C = 0
     * */
    CMP: function(addr) {
      return addr;
    },

    /* Xとメモリを比較演算 */
    CPX: function() {},

    /* Yとメモリを比較演算*/
    CPY: function() {},

    /* *をインクリメントする
     * フラグ
     *   - negative_
     *   - zero_
     * */
    /* メモリをインクリメントする*/
    INC: function(addr) {
      this.ram.write(addr, this.ram.read(addr) + 1);
      const value = this.ram.read(addr);
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* メモリをデクリメント */
    DEC: function(addr) {
      this.ram.write(addr, this.ram.read(addr) - 1);
      const value = this.ram.read(addr);
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* Xをインクリメントする */
    INX: function() {
      this.registers.indexX++;
      const value = this.registers.indexX;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* Yをインクリメントする */
    INY: function() {
      this.registers.indexY++;
      const value = this.registers.indexY;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* Xをデクリメント */
    DEX: function() {
      this.registers.indexX--;
      const value = this.registers.indexX;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* Yをデクリメント*/
    DEY: function() {
      this.registers.indexY--;
      const value = this.registers.indexY;
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* accとメモリを論理XOR演算してaccに結果を返す*/
    EOR: function(addr) {
      this.registers.acc = this.registers.acc ^ this.ram.read(addr);
    },

    /* accとメモリを論理OR演算して結果をAへ返す */
    ORA: function(addr) {
      this.registers.acc = this.registers.acc | this.ram.read(addr);
    },

    /* メモリを左へローテートする */
    ROL: function(addr) {
      const carry_ = this.registers.status.carry_;
      const msb = this.ram.read(addr) >> 7;

      this.registers.status.carry_ = msb;
      this.ram.write(addr, (this.ram.read(addr) << 1) | carry_);
    },

    /* accを左へローテートする
     * 実装を考えて、accの場合をROLと分離した
     * */
    RLA: function() {
      const carry_ = this.registers.status.carry_;
      const msb = this.registers.acc >> 7;

      this.registers.status.carry_ = msb;
      this.registers.acc = (this.registers.acc << 1) | carry_;
    },

    /* メモリを右へローテートする */
    ROR: function(addr) {
      const carry_ = this.registers.status.carry_ << 7;
      const lsb = this.ram.read(addr) & 0x01;

      this.registers.status.carry_ = lsb;
      this.ram.write(addr, (this.ram.read(addr) >> 1) | carry_);
    },

    /* accを右へローテートする
     * 実装を考えてaccの場合をRORと分離した
     * */
    RRA: function() {
      const carry_ = this.registers.status.carry_ << 7;
      const lsb = this.registers.acc & 0x01;

      this.registers.status.carry_ = lsb;
      this.registers.acc = (this.registers.acc >> 1) | carry_;
    },

    /* acc + memory + carryFlag
     * フラグ
     *   - negative_
     *   - overflow_
     *   - zero_
     *   - carry_
     * */
    ADC: function(addr) {
      const added = this.registers.acc + this.ram.read(addr);
      this.registers.acc = added + this.registers.status.carry_;
      this.registers.status.carry_ = (added > 0xff) & 1;
    },

    /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
    SBC: function(addr) {
      const subed = this.registers.acc - this.ram.read(addr);
      this.registers.acc = subed - this.registers.status.carry_;
      this.registers.status.carry_ = (subed < 0x00) & 1;
    },

    /* accをスタックにプッシュ */
    PHA: function() {},

    /* Pをスタックにプッシュ */
    PHP: function() {},

    /* スタックからAにポップアップする */
    PLA: function() {},

    /* スタックからPにポップアップする */
    PLP: function() {},

    /* アドレスへジャンプする */
    JMP: function(addr) {
      this.registers.pc = addr;
    },

    /* サブルーチンを呼び出す */
    JSR: function() {},

    /* サブルーチンから復帰する */
    RTS: function() {},

    /* 割り込みルーチンから復帰する */
    RTI: function() {},

    /* キャリーフラグがクリアされているときにブランチする */
    BCC: function() {},

    /* キャリーフラグがセットされているときにブランチする */
    BCS: function() {},

    /* ゼロフラグがセットされているときにブランチする */
    BEQ: function() {},

    /* ネガティブフラグがセットされているときにブランチする */
    BMI: function() {},

    /* ゼロフラグがクリアされているときにブランチする*/
    BNE: function(addr) {
      const isBranchable = !this.registers.status.zero_;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ネガティブフラグがクリアされているときにブランチする */
    BPL: function() {},

    /* オーバーフローフラグがクリアされているときにブランチする*/
    BVC: function() {},

    /* オーバーフローフラグがセットされているときにブランチする */
    BVS: function() {},

    /* キャリーフラグをクリアします */
    CLC: function() {},

    /* BCDモードから通常モードに戻る NESには実装されていない */
    CLD: function() {},

    /* IRQ割り込みを許可する */
    CLI: function() {},

    /* オーバーフローフラグをクリアする */
    CLV: function() {},

    /* キャリーフラグをセットする */
    SEC: function() {},

    /* BCDモードに設定する NESには実装されていない */
    SED: function() {},

    /* IRQ割り込みを禁止する
     * フラグ
     * interrupt_ : 1にセットする
     * */
    SEI: function() {
      this.registers.status.interrupt_ = 1;
    },

    /* ソフトウェア割り込みを起こす*/
    BRK: function() {},

    /* 空の命令を実行する */
    NOP: function() {}
  };

  class Util$1 {
    static debugString(instruction, addressing, value_) {
      let prefix = "$";
      let postfix = "";

      if (!addressing) {
        prefix = "";
      } else if (addressing.name === "bound immediate") {
        prefix = "#$";
      }

      let value;
      if (value_ === undefined) {
        value = "";
      } else {
        value = value_.toString(16);
      }

      const chars = [
        instruction.name.split(" ")[1],
        " ",
        prefix,
        value,
        postfix
      ].join("");

      return chars;
    }
  }

  /* 0x40 - 0x4F */
  var x4x = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    /* 0x4c: JMP Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);
      const addr = absolute();

      const JMP = Instructions.JMP.bind(this);
      JMP(addr);

      return Util$1.debugString(JMP, absolute, addr);
    },
    "d",
    "e",
    "f"
  ];

  /* 0x50 - 0x5F */
  var x5x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0x60 - 0x6F */
  var x6x = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0x70 - 0x7F */
  var x7x = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    /* 0x78: SEI */
    function() {
      const SEI = Instructions.SEI.bind(this);

      SEI();

      return Util$1.debugString(SEI);
    },
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f"
  ];

  /* 0x80 - 0x8F */
  var x8x = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    /* 0x88: DEY */
    function() {
      const DEY = Instructions.DEY.bind(this);

      DEY();

      return Util$1.debugString(DEY);
    },
    "9",
    "a",
    "b",
    "c",
    /* 0x8d: STA Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);

      const addr = absolute();
      const STA = Instructions.STA.bind(this);

      STA(addr);

      return Util$1.debugString(STA, absolute, addr);
    },
    "e",
    "f"
  ];

  //import Addressing from '../addressing'

  /* 0x90 - 0x9F */
  var x9x = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    /* 9A: TXS Implied*/
    function() {
      const TXS = Instructions.TXS.bind(this);
      TXS();

      return Util$1.debugString(TXS);
    },
    "",
    "",
    "",
    "",
    ""
  ];

  /* 0xA0 - 0xAF */
  var xAx = [
    /* 0xA0: LDY Immediate*/
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDY = Instructions.LDY.bind(this);
      LDY(addr);

      return Util$1.debugString(LDY, immediate, this.ram.read(addr));
    },
    "1",
    /* 0xA2: LDX Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDX = Instructions.LDX.bind(this);
      LDX(addr);

      return Util$1.debugString(LDX, immediate, this.ram.read(addr));
    },
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",

    /* 0xA9: LDA Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, immediate, this.ram.read(addr));
    },
    "",
    "",
    "",
    "",
    "",
    ""
  ];

  /* 0xb0 - 0xbF */
  var xBx = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    /* 0xbd: LDA Absolutem X */
    function() {
      const absoluteX = Addressing.absoluteX.bind(this);
      const addr = absoluteX();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, absoluteX, addr);
    },
    "e",
    "f"
  ];

  /* 0xc0 - 0xcF */
  var xCx = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  /* 0xd0 - 0xdF */
  var xDx = [
    /* 0xd0: BNE */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BNE = Instructions.BNE.bind(this);
      BNE(addr);

      return Util$1.debugString(BNE, relative, addr);
    },
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ];

  //import Addressing from '../addressing'

  /* 0xe0 - 0xeF */
  var xEx = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    /* 0xe8: INX */
    function() {
      const INX = Instructions.INX.bind(this);

      INX();

      return Util$1.debugString(INX);
    },
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ];

  /* 0xf0 - 0xff */
  var xFx = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  const opcodes = [].concat(
    x0x,
    x1x,
    x2x,
    x3x,
    x4x,
    x5x,
    x6x,
    x7x,
    x8x,
    x9x,
    xAx,
    xBx,
    xCx,
    xDx,
    xEx,
    xFx
  );

  /* 6502 CPU */
  class Cpu {
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

  class Vram {
    constructor() {
      this.memory = new Uint8Array(0x4000);
      this.vp = null;
    }

    connect(ppu) {
      this.refreshDisplay = ppu.refreshDisplay.bind(ppu);
    }

    writeFromBus(value) {
      //console.log('vram[$' + this.vp.toString(16) + '] = ' + String.fromCharCode(value))
      this.memory[this.vp] = value;
      this.vp++;
      this.refreshDisplay && this.refreshDisplay();
    }

    write(addr, value) {
      this.memory[addr] = value;
    }

    read(addr) {
      return this.memory[addr];
    }
  }

  class Ppu {
    constructor() {
      this.init();
    }

    init() {
      /* About VRAM
       * 0x0000 - 0x0fff : Pattern table 0
       * 0x1000 - 0x1fff : Pattern table 1
       * 0x2000 - 0x23bf : Name table 0
       * 0x23c0 - 0x23ff : Attribute table 0
       * 0x2400 - 0x27bf : Name table 1
       * 0x2bc0 - 0x2bbf : Attribute table 1
       * 0x2c00 - 0x2fbf : Name table 2
       * 0x2bc0 - 0x2bff : Attribute table 2
       * 0x2c00 - 0x2fbf : Name table 3
       * 0x2fc0 - 0x2fff : Attribute table 3
       * 0x3000 - 0x3eff : Mirror of 0x2000 - 0x2fff
       * 0x3f00 - 0x3f0f : Background palette
       * 0x3f10 - 0x3f1f : Sprite palette
       * 0x3f20 - 0x3fff : Mirror of 0x3f00 0 0x3f1f
       * */
      this.vram = new Vram();
    }

    connect(parts) {
      if (parts.bus) {
        parts.bus.connect({ vram: this.vram });
      }

      if (parts.renderer) {
        this.renderer = parts.renderer;
        this.vram.connect(this);
      }
    }

    /* $2000 - $23BFのネームテーブルを更新する */
    refreshDisplay() {
      /* タイル(8x8)を32*30個 */
      for (let i = 0x2000; i <= 0x23bf; i++) {
        const tileId = this.vram.read(i);
        /* タイルを指定 */
        const tile = this.tiles[tileId];
        /* タイルが使用するパレットを取得 */
        const paletteId = this.selectPalette(tileId);
        const palette = this.selectBackgroundPalettes(paletteId);

        /* タイルとパレットをRendererに渡す */
        this.renderer.write(tile, palette);
      }
    }

    /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
    set chrRom(chrRom) {
      for (let i = 0; i < chrRom.length; i++) {
        this.vram.write(i, chrRom[i]);
      }

      /* CHR領域からタイルを抽出しておく */
      this.extractTiles();
    }

    // 8x8のタイルをすべてvramのCHRから抽出しておく
    extractTiles() {
      this.tiles = [];
      for (let i = 0; i < 0x1fff; ) {
        // タイルの下位ビット
        const lowerBitLines = [];
        for (let h = 0; h < 8; h++) {
          let byte = this.vram.read(i++);
          const line = [];
          for (let j = 0; j < 8; j++) {
            const bit = byte & 0x01;
            line.unshift(bit);
            byte = byte >> 1;
          }

          lowerBitLines.push(line);
        }

        // タイルの上位ビット
        const higherBitLines = [];
        for (let h = 0; h < 8; h++) {
          let byte = this.vram.read(i++);
          const line = [];
          for (let j = 0; j < 8; j++) {
            const bit = byte & 0x01;
            line.unshift(bit << 1);
            byte = byte >> 1;
          }

          higherBitLines.push(line);
        }

        // 上位ビットと下位ビットを合成する
        const perfectBits = [];
        for (let h = 0; h < 8; h++) {
          for (let j = 0; j < 8; j++) {
            const perfectBit = lowerBitLines[h][j] | higherBitLines[h][j];
            perfectBits.push(perfectBit);
          }
        }
        this.tiles.push(perfectBits);
      }
    }

    /* 属性テーブルから該当パレットの番号を取得する */
    selectPalette(n) {
      const blockPosition = ((n - (n % 64)) / 64) * 8 + ((n % 64) - (n % 4)) / 4;
      const bitPosition = n % 4;
      const start = 0x23c0;

      const block = this.vram.read(start + blockPosition);
      const bit = (block >> bitPosition) & 0x03;

      return bit;
    }

    /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
    selectBackgroundPalettes(number) {
      const palette = [];

      const start = 0x3f00 + number * 4;
      const end = 0x3f00 + number * 4 + 4;
      for (let i = start; i < end; i++) {
        palette.push(this.vram.read(i));
      }

      return palette;
    }

    /* $3F10-$3F1Fからスプライトパレットを取得する */
    selectSpritePaletts(number) {
      const palette = [];

      const start = 0x3f10 + number * 4;
      const end = 0x3f10 + number * 4 + 4;
      for (let i = start; i < end; i++) {
        palette.push(this.vram.read(i));
      }

      return palette;
    }
  }

  class Bus {
    constructor() {
      this.buffer = {};
      this.vramAddr_ = [];
    }

    connect(parts) {
      parts.vram && (this.vram = parts.vram);
    }

    /* CPU側からのみしか考慮してない */
    write(addr, value) {
      switch (addr) {
        case 0x2006:
          this.vramAddr = value;
          break;
        case 0x2007:
          this.vram.writeFromBus(value);
          break;
        default:
          this.buffer[addr] = value;
      }
    }

    read(addr) {
      switch (addr) {
        case 0x2006:
          return this.vramAddr;
        default:
          throw new Error("The bus of this addr is Not implemented");
      }
    }

    set vramAddr(addr) {
      if (this.vramAddr_.length < 1) {
        this.vramAddr_.push(addr);
      } else {
        this.vramAddr_.push(addr);
        this.vram.vp = this.vramAddr;
        this.vramAddr_.length = 0;
      }
    }

    get vramAddr() {
      return (this.vramAddr_[0] << 8) + this.vramAddr_[1];
    }
  }

  class Nes {
    constructor() {
      this.cpu = new Cpu();
      this.ppu = new Ppu();
      this.bus = new Bus();
      this.ppu.connect({ bus: this.bus });
      this.cpu.connect({ bus: this.bus });
    }

    connect(renderer) {
      this.ppu.connect({ renderer });
    }

    get rom() {
      return this._rom
    }

    set rom(rom) {
      this._rom = rom;
    }

    run(isDebug) {
      this.cpu.prgRom = this.rom.prgRom;
      this.ppu.chrRom = this.rom.chrRom;

      this.cpu.run(isDebug);
    }
  }

  class Rom {
    constructor(data) {
      this.check(data);
      this.data = data;
    }

    check(data) {
      if (!this.isNesRom(data)) throw new Error("This is not NES ROM.");
    }

    get NES_ROM_HEADER_SIZE() {
      return 0x10;
    }

    get START_ADDRESS_OF_CHR_ROM() {
      return this.NES_ROM_HEADER_SIZE + this.SIZE_OF_PRG_ROM;
    }

    get END_ADDRESS_OF_CHR_ROM() {
      return this.START_ADDRESS_OF_CHR_ROM + this.SIZE_OF_CHR_ROM;
    }

    /* PRG ROMのサイズを取得する
     ** ROMヘッダの1から数えて5Byte目の値に16Ki(キビ)をかけたサイズ */
    get SIZE_OF_PRG_ROM() {
      return this.data[4] * 0x4000;
    }

    /* PRG ROMに同じ*/
    get SIZE_OF_CHR_ROM() {
      return this.data[5] * 0x2000;
    }

    /* ROMからprgROMに該当するところを切り出す
     ** prgROMはヘッダ領域の次のByteから始まる */
    get prgRom() {
      return this.data.slice(
        this.NES_ROM_HEADER_SIZE,
        this.START_ADDRESS_OF_CHR_ROM - 1
      );
    }

    /* ROMからchrROMに該当するところを切り出す
     ** chrRomはprgRomの後から始まる */
    get chrRom() {
      return this.data.slice(
        this.START_ADDRESS_OF_CHR_ROM,
        this.END_ADDRESS_OF_CHR_ROM - 1
      );
    }

    /* データのヘッダに'NES'があるかどうかでNESのROMか判別する */
    isNesRom(data) {
      const header = data.slice(0, 3);
      const headerStr = String.fromCharCode.apply(null, header);

      return headerStr === "NES";
    }
  }

  class Renderer {
    constructor(id) {
      let canvas = document.getElementById(id);
      this.context = canvas.getContext("2d");
      this.pointer = 0;
      this.width = 32;
      this.height = 30;
    }

    write(tile, palette) {
      const image = this.generateTileImage(tile, palette);
      const x = (this.pointer % this.width) * 8;
      const y = ((this.pointer - (this.pointer % this.width)) / this.width) * 8;

      if (this.pointer < this.width * this.height - 1) {
        this.pointer++;
      } else {
        this.pointer = 0;
      }

      this.context.putImageData(image, x, y);
    }

    generateTileImage(tile, palette) {
      const image = this.context.createImageData(8, 8);

      for (let i = 0; i < 64; i++) {
        const bit = tile[i];
        const color = this.color(palette[bit]);

        image.data[i * 4] = color[0];
        image.data[i * 4 + 1] = color[1];
        image.data[i * 4 + 2] = color[2];
        image.data[i * 4 + 3] = 255; // 透明度
      }

      return image;
    }

    color(colorId) {
      return [
        [0x75, 0x75, 0x75],
        [0x27, 0x1b, 0x8f],
        [0x00, 0x00, 0xab],
        [0x47, 0x00, 0x9f],
        [0x8f, 0x00, 0x77],
        [0xab, 0x00, 0x13],
        [0xa7, 0x00, 0x00],
        [0x7f, 0x0b, 0x00],
        [0x43, 0x2f, 0x00],
        [0x00, 0x47, 0x00],
        [0x00, 0x51, 0x00],
        [0x00, 0x3f, 0x17],
        [0x1b, 0x3f, 0x5f],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xbc, 0xbc, 0xbc],
        [0x00, 0x73, 0xef],
        [0x23, 0x3b, 0xef],
        [0x83, 0x00, 0xf3],
        [0xbf, 0x00, 0xbf],
        [0xe7, 0x00, 0x5b],
        [0xdb, 0x2b, 0x00],
        [0xcb, 0x4f, 0x0f],
        [0x8b, 0x73, 0x00],
        [0x00, 0x97, 0x00],
        [0x00, 0xab, 0x00],
        [0x00, 0x93, 0x3b],
        [0x00, 0x83, 0x8b],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff],
        [0x3f, 0xbf, 0xff],
        [0x5f, 0x73, 0xff],
        [0xa7, 0x8b, 0xfd],
        [0xf7, 0x7b, 0xff],
        [0xff, 0x77, 0xb7],
        [0xff, 0x77, 0x63],
        [0xff, 0x9b, 0x3b],
        [0xf3, 0xbf, 0x3f],
        [0x83, 0xd3, 0x13],
        [0x4f, 0xdf, 0x4b],
        [0x58, 0xf8, 0x98],
        [0x00, 0xeb, 0xdb],
        [0x75, 0x75, 0x75],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff],
        [0xab, 0xe7, 0xff],
        [0xc7, 0xd7, 0xff],
        [0xd7, 0xcb, 0xff],
        [0xff, 0xc7, 0xff],
        [0xff, 0xc7, 0xdb],
        [0xff, 0xbf, 0xb3],
        [0xff, 0xdb, 0xab],
        [0xff, 0xe7, 0xa3],
        [0xe3, 0xff, 0xa3],
        [0xab, 0xf3, 0xbf],
        [0xb3, 0xff, 0xcf],
        [0x9f, 0xff, 0xf3],
        [0xbc, 0xbc, 0xbc],
        [0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00]
      ][colorId];
    }
  }

  const Nes$1 = Nes;
  const Rom$1 = Rom;
  const Renderer$1 = Renderer;

  exports.Nes = Nes$1;
  exports.Rom = Rom$1;
  exports.Renderer = Renderer$1;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgxeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDJ4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4M3guanMiLCIuLi9zcmMvY3B1L2FkZHJlc3NpbmcvaW5kZXguanMiLCIuLi9zcmMvY3B1L2luc3RydWN0aW9ucy91dGlsLmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvaW5kZXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy9jcHUvY3B1LmpzIiwiLi4vc3JjL3BwdS92cmFtLmpzIiwiLi4vc3JjL3BwdS9wcHUuanMiLCIuLi9zcmMvYnVzL2luZGV4LmpzIiwiLi4vc3JjL25lcy5qcyIsIi4uL3NyYy9yb20vaW5kZXguanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICBhY2M6IDB4MDAsIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICBpbmRleFg6IDB4MDAsIC8vIOOCpOODs+ODh+ODg+OCr+OCueODrOOCuOOCueOCv++8muOCouODieODrOODg+OCt+ODs+OCsOOAgeOCq+OCpuODs+OCv+etiVxuICBpbmRleFk6IDB4MDAsIC8vIOS4iuOBq+WQjOOBmFxuICBzcDogMHgwMWZkLCAvLyDjgrnjgr/jg4Pjgq/jg53jgqTjg7Pjgr9cbiAgc3RhdHVzOiB7XG4gICAgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgbmVnYXRpdmVfOiAwLFxuICAgIG92ZXJmbG93XzogMCxcbiAgICByZXNlcnZlZF86IDEsXG4gICAgYnJlYWtfOiAxLCAvLyDlibLjgorovrzjgb9CUkvnmbrnlJ/mmYLjgat0cnVlLElSUeeZuueUn+aZguOBq2ZhbHNlXG4gICAgZGVjaW1hbF86IDAsXG4gICAgaW50ZXJydXB0XzogMSxcbiAgICB6ZXJvXzogMCxcbiAgICBjYXJyeV86IDBcbiAgfSxcbiAgcGM6IDB4ODAwMCAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr9cbn07XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4MTAwMDApO1xuICB9XG5cbiAgLyogTWVtb3J5IG1hcHBlZCBJL0/jgafjgYLjgovjgZ/jgoHvvIzjg5DjgrkoQnVzKeOCkuaOpee2muOBl+OBpuOBiuOBj1xuICAgKiBQUFXnrYnjgbjjga9CdXPjgpLpgJrjgZfjgabjg4fjg7zjgr/jga7jgoTjgorlj5bjgorjgpLooYzjgYZcbiAgICogKi9cbiAgY29ubmVjdChwYXJ0cykge1xuICAgIHBhcnRzLmJ1cyAmJiAodGhpcy5idXMgPSBwYXJ0cy5idXMpO1xuICB9XG5cbiAgLypUT0RPIOWQhOODneODvOODiChhZGRyKeOBq+OCouOCr+OCu+OCueOBjOOBguOBo+OBn+WgtOWQiOOBq+OBr+ODkOOCueOBq+abuOOBjei+vOOCgCAqL1xuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIGlmIChhZGRyID49IDB4MjAwMCAmJiBhZGRyIDw9IDB4MjAwNykge1xuICAgICAgdGhpcy5idXMud3JpdGUoYWRkciwgdmFsdWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIOmAmuW4uOOBruODoeODouODquOCouOCr+OCu+OCuVxuICAgIHRoaXMubWVtb3J5W2FkZHJdID0gdmFsdWU7XG4gIH1cblxuICAvKlRPRE8g44Kz44Oz44OI44Ot44O844Op55So44Gu44Od44O844OIICovXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXTtcbiAgfVxufVxuIiwiLyogMHgwMCAtIDB4MEYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiXTtcbiIsIi8qIDB4MTAgLSAweDFGICovXG5leHBvcnQgZGVmYXVsdCBbXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIl07XG4iLCIvKiAweDIwIC0gMHgyRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiLyogMHgzMCAtIDB4M0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiXTtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLyogOGJpdOOBruWNs+WApOOBquOBruOBp+OCouODieODrOOCueOCkuOBneOBruOBvuOBvui/lOOBmSAqL1xuICBpbW1lZGlhdGU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIHJldHVybiBhZGRyO1xuICB9LFxuXG4gIC8qIOOCouODieODrOOCuWFkZHIoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2U6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXyk7XG4gICAgcmV0dXJuIGFkZHI7XG4gIH0sXG5cbiAgLyogKOOCouODieODrOOCuWFkZHIgKyDjg6zjgrjjgrnjgr9pbmRleFgpKDhiaXQp44KS6L+U44GZICovXG4gIHplcm9wYWdlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WDtcbiAgICByZXR1cm4gYWRkciAmIDB4ZmY7XG4gIH0sXG5cbiAgLyog5LiK44Go5ZCM44GY44GnaW5kZXhZ44Gr5pu/44GI44KL44Gg44GRKi9cbiAgemVyb3BhZ2VZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZO1xuICAgIHJldHVybiBhZGRyICYgMHhmZjtcbiAgfSxcblxuICAvKiB6ZXJvcGFnZeOBrmFkZHLjgYwxNmJpdOeJiCAqL1xuICBhYnNvbHV0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKTtcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXyk7XG5cbiAgICBjb25zdCBhZGRyID0gbG93QWRkciB8IChoaWdoQWRkciA8PCA4KTtcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmO1xuICB9LFxuXG4gIGFic29sdXRlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKTtcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXyk7XG5cbiAgICBjb25zdCBhZGRyID0gKGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOCkpICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmY7XG4gIH0sXG5cbiAgYWJzb2x1dGVZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pO1xuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKTtcblxuICAgIGNvbnN0IGFkZHIgPSAobG93QWRkciB8IChoaWdoQWRkciA8PCA4KSkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZjtcbiAgfSxcblxuICBpbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKTtcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXyk7XG5cbiAgICBjb25zdCBhZGRyXyA9IGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOCk7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KTtcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmO1xuICB9LFxuXG4gIGluZGV4SW5kaXJlY3Q6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgbGV0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIGFkZHJfID0gYWRkcl8gJiAweDAwZmY7XG5cbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCAodGhpcy5yYW0ucmVhZChhZGRyXyArIDEpIDw8IDgpO1xuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmY7XG4gIH0sXG5cbiAgaW5kaXJlY3RJbmRleDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmFtLnJlYWQoYWRkcl9fKTtcblxuICAgIGxldCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCAodGhpcy5yYW0ucmVhZChhZGRyXyArIDEpIDw8IDgpO1xuICAgIGFkZHIgPSBhZGRyICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZO1xuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmY7XG4gIH0sXG5cbiAgLyogKOODl+ODreOCsOODqeODoOOCq+OCpuODs+OCvyArIOOCquODleOCu+ODg+ODiCnjgpLov5TjgZnjgIJcbiAgICog44Kq44OV44K744OD44OI44Gu6KiI566X44Gn44Gv56ym5Y+35LuY44GN44Gu5YCk44GM5L2/55So44GV44KM44KL44CCXG4gICAqIOespuWPt+S7mOOBjeOBruWApOOBr1xuICAgKiAgIC0xMjgoMHg4MCkgfiAtMSAoMHhmZilcbiAgICogICAwKDB4MDApIH4gMTI3KDB4N2YpXG4gICAqICovXG4gIHJlbGF0aXZlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3Qgc2lnbmVkTnVtYmVyID0gdGhpcy5yYW0ucmVhZChhZGRyXyk7XG5cbiAgICBsZXQgYWRkciA9XG4gICAgICBzaWduZWROdW1iZXIgPj0gMHg4MFxuICAgICAgICA/IHRoaXMucmVnaXN0ZXJzLnBjICsgc2lnbmVkTnVtYmVyIC0gMHgxMDBcbiAgICAgICAgOiB0aGlzLnJlZ2lzdGVycy5wYyArIHNpZ25lZE51bWJlcjtcblxuICAgIHJldHVybiBhZGRyO1xuICB9XG59O1xuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBpc05lZ2F0aXZlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID4+IDc7XG4gIH1cblxuICBzdGF0aWMgaXNaZXJvKHZhbHVlKSB7XG4gICAgcmV0dXJuICh2YWx1ZSA9PT0gMHgwMCkgJiAxO1xuICB9XG5cbiAgc3RhdGljIG1zYih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA+PiA3O1xuICB9XG5cbiAgc3RhdGljIGxzYih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAmIDB4MDE7XG4gIH1cbn1cbiIsImltcG9ydCBVdGlsIGZyb20gXCIuL3V0aWxcIjtcblxuZXhwb3J0IGRlZmF1bHQge1xuICAvKiBMRCogKExvYWQgbWVtb3J5W2FkZHIpIHRvICogcmVnaXN0ZXIpXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfIDog6KiI566X57WQ5p6c44GM6LKg44Gu5YCk44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDAoYWNj44GuN2JpdOebruOBqOWQjOOBmOWApOOBq+OBquOCiylcbiAgICogICAtIHplcm9fIDog6KiI566X57WQ5p6c44GM44K844Ot44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDBcbiAgICogKi9cbiAgTERBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcbiAgLyog44Os44K444K544K/aW5kZXhY44GrZGF0YeOCkuODreODvOODieOBmeOCiyAqL1xuICBMRFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIExEWTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkgPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogU1QqIChTdG9yZSBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44Kw5pON5L2c44Gv54Sh44GXXG4gICAqICovXG4gIFNUQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmFjYyk7XG4gIH0sXG5cbiAgU1RYOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhYKTtcbiAgfSxcblxuICBTVFk6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFkpO1xuICB9LFxuXG4gIC8qIFQqKiAoVHJhbnNmZXIgKiByZWdpc3RlciB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gemVyb19cbiAgICogKi9cbiAgVEFYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjYztcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgVEFZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjYztcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkgPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgVFNYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLnNwO1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICBUWEE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICBUWFM6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIHRoaXMucmVnaXN0ZXJzLnNwID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIFRZQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIGFjYyAmIG1lbW9yeVthZGRyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gemVyb19cbiAgICogKi9cbiAgQU5EOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2MgJiB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiBB44G+44Gf44Gv44Oh44Oi44Oq44KS5bem44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAgIC0gY2FycnlfXG4gICAqICovXG4gIEFTTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICBjb25zdCBtc2IgPSBVdGlsLm1zYih2YWx1ZSk7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdmFsdWUgPDwgMSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBtc2I7XG4gIH0sXG5cbiAgLyogYWNj44G+44Gf44Gv44Oh44Oi44Oq44KS5Y+z44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAgIC0gY2FycnlfXG4gICAqICovXG4gIExTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICBjb25zdCBsc2IgPSBVdGlsLmxzYih2YWx1ZSk7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdmFsdWUgPj4gMSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2I7XG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkkFOROa8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nOOBmeOCi1xuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogKi9cbiAgQklUOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgcmV0dXJuIGFkZHI7XG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkuavlOi8g+a8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nFxuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogQSA9PSBtZW0gLT4gWiA9IDBcbiAgICogQSA+PSBtZW0gLT4gQyA9IDFcbiAgICogQSA8PSBtZW0gLT4gQyA9IDBcbiAgICogKi9cbiAgQ01QOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgcmV0dXJuIGFkZHI7XG4gIH0sXG5cbiAgLyogWOOBqOODoeODouODquOCkuavlOi8g+a8lOeulyAqL1xuICBDUFg6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyogWeOBqOODoeODouODquOCkuavlOi8g+a8lOeulyovXG4gIENQWTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiAq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAqL1xuICAvKiDjg6Hjg6Ljg6rjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosqL1xuICBJTkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpICsgMSk7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLjg4fjgq/jg6rjg6Hjg7Pjg4ggKi9cbiAgREVDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yYW0ucmVhZChhZGRyKSAtIDEpO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogWOOCkuOCpOODs+OCr+ODquODoeODs+ODiOOBmeOCiyAqL1xuICBJTlg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCsrO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiBZ44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKys7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIFjjgpLjg4fjgq/jg6rjg6Hjg7Pjg4ggKi9cbiAgREVYOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFgtLTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WDtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogWeOCkuODh+OCr+ODquODoeODs+ODiCovXG4gIERFWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZLS07XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhlhPUua8lOeul+OBl+OBpmFjY+OBq+e1kOaenOOCkui/lOOBmSovXG4gIEVPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHRoaXMucmVnaXN0ZXJzLmFjYyBeIHRoaXMucmFtLnJlYWQoYWRkcik7XG4gIH0sXG5cbiAgLyogYWNj44Go44Oh44Oi44Oq44KS6KuW55CGT1LmvJTnrpfjgZfjgabntZDmnpzjgpJB44G46L+U44GZICovXG4gIE9SQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHRoaXMucmVnaXN0ZXJzLmFjYyB8IHRoaXMucmFtLnJlYWQoYWRkcik7XG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS5bem44G444Ot44O844OG44O844OI44GZ44KLICovXG4gIFJPTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGNhcnJ5XyA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV87XG4gICAgY29uc3QgbXNiID0gdGhpcy5yYW0ucmVhZChhZGRyKSA+PiA3O1xuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IG1zYjtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCAodGhpcy5yYW0ucmVhZChhZGRyKSA8PCAxKSB8IGNhcnJ5Xyk7XG4gIH0sXG5cbiAgLyogYWNj44KS5bem44G444Ot44O844OG44O844OI44GZ44KLXG4gICAqIOWun+ijheOCkuiAg+OBiOOBpuOAgWFjY+OBruWgtOWQiOOCklJPTOOBqOWIhumbouOBl+OBn1xuICAgKiAqL1xuICBSTEE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGNhcnJ5XyA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV87XG4gICAgY29uc3QgbXNiID0gdGhpcy5yZWdpc3RlcnMuYWNjID4+IDc7XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfID0gbXNiO1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgPDwgMSkgfCBjYXJyeV87XG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS5Y+z44G444Ot44O844OG44O844OI44GZ44KLICovXG4gIFJPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGNhcnJ5XyA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPDwgNztcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpICYgMHgwMTtcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2I7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgKHRoaXMucmFtLnJlYWQoYWRkcikgPj4gMSkgfCBjYXJyeV8pO1xuICB9LFxuXG4gIC8qIGFjY+OCkuWPs+OBuOODreODvOODhuODvOODiOOBmeOCi1xuICAgKiDlrp/oo4XjgpLogIPjgYjjgaZhY2Pjga7loLTlkIjjgpJST1LjgajliIbpm6LjgZfjgZ9cbiAgICogKi9cbiAgUlJBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBjYXJyeV8gPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfIDw8IDc7XG4gICAgY29uc3QgbHNiID0gdGhpcy5yZWdpc3RlcnMuYWNjICYgMHgwMTtcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2I7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gKHRoaXMucmVnaXN0ZXJzLmFjYyA+PiAxKSB8IGNhcnJ5XztcbiAgfSxcblxuICAvKiBhY2MgKyBtZW1vcnkgKyBjYXJyeUZsYWdcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIG92ZXJmbG93X1xuICAgKiAgIC0gemVyb19cbiAgICogICAtIGNhcnJ5X1xuICAgKiAqL1xuICBBREM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBhZGRlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyArIHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gYWRkZWQgKyB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSAoYWRkZWQgPiAweGZmKSAmIDE7XG4gIH0sXG5cbiAgLyogKGFjYyAtIOODoeODouODqiAtIOOCreODo+ODquODvOODleODqeOCsCnjgpLmvJTnrpfjgZfjgaZhY2Pjgbjov5TjgZkgKi9cbiAgU0JDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3Qgc3ViZWQgPSB0aGlzLnJlZ2lzdGVycy5hY2MgLSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHN1YmVkIC0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XztcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfID0gKHN1YmVkIDwgMHgwMCkgJiAxO1xuICB9LFxuXG4gIC8qIGFjY+OCkuOCueOCv+ODg+OCr+OBq+ODl+ODg+OCt+ODpSAqL1xuICBQSEE6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyogUOOCkuOCueOCv+ODg+OCr+OBq+ODl+ODg+OCt+ODpSAqL1xuICBQSFA6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJQeOBq+ODneODg+ODl+OCouODg+ODl+OBmeOCiyAqL1xuICBQTEE6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJUOOBq+ODneODg+ODl+OCouODg+ODl+OBmeOCiyAqL1xuICBQTFA6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Ki44OJ44Os44K544G444K444Oj44Oz44OX44GZ44KLICovXG4gIEpNUDogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkcjtcbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgpLlkbzjgbPlh7rjgZkgKi9cbiAgSlNSOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCteODluODq+ODvOODgeODs+OBi+OCieW+qeW4sOOBmeOCiyAqL1xuICBSVFM6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog5Ymy44KK6L6844G/44Or44O844OB44Oz44GL44KJ5b6p5biw44GZ44KLICovXG4gIFJUSTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkNDOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCQ1M6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44K844Ot44OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJFUTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQk1JOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCvOODreODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyovXG4gIEJORTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb187XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHI7XG4gICAgfVxuICB9LFxuXG4gIC8qIOODjeOCrOODhuOCo+ODluODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCUEw6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQlZDOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCVlM6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44Kv44Oq44Ki44GX44G+44GZICovXG4gIENMQzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgYvjgonpgJrluLjjg6Ljg7zjg4njgavmiLvjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIENMRDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBJUlHlibLjgorovrzjgb/jgpLoqLHlj6/jgZnjgosgKi9cbiAgQ0xJOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOCkuOCr+ODquOCouOBmeOCiyAqL1xuICBDTFY6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44K744OD44OI44GZ44KLICovXG4gIFNFQzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgavoqK3lrprjgZnjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIFNFRDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBJUlHlibLjgorovrzjgb/jgpLnpoHmraLjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqIGludGVycnVwdF8gOiAx44Gr44K744OD44OI44GZ44KLXG4gICAqICovXG4gIFNFSTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmludGVycnVwdF8gPSAxO1xuICB9LFxuXG4gIC8qIOOCveODleODiOOCpuOCp+OCouWJsuOCiui+vOOBv+OCkui1t+OBk+OBmSovXG4gIEJSSzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDnqbrjga7lkb3ku6TjgpLlrp/ooYzjgZnjgosgKi9cbiAgTk9QOiBmdW5jdGlvbigpIHt9XG59O1xuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBkZWJ1Z1N0cmluZyhpbnN0cnVjdGlvbiwgYWRkcmVzc2luZywgdmFsdWVfKSB7XG4gICAgbGV0IHByZWZpeCA9IFwiJFwiO1xuICAgIGxldCBwb3N0Zml4ID0gXCJcIjtcblxuICAgIGlmICghYWRkcmVzc2luZykge1xuICAgICAgcHJlZml4ID0gXCJcIjtcbiAgICB9IGVsc2UgaWYgKGFkZHJlc3NpbmcubmFtZSA9PT0gXCJib3VuZCBpbW1lZGlhdGVcIikge1xuICAgICAgcHJlZml4ID0gXCIjJFwiO1xuICAgIH1cblxuICAgIGxldCB2YWx1ZTtcbiAgICBpZiAodmFsdWVfID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlID0gXCJcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB2YWx1ZV8udG9TdHJpbmcoMTYpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoYXJzID0gW1xuICAgICAgaW5zdHJ1Y3Rpb24ubmFtZS5zcGxpdChcIiBcIilbMV0sXG4gICAgICBcIiBcIixcbiAgICAgIHByZWZpeCxcbiAgICAgIHZhbHVlLFxuICAgICAgcG9zdGZpeFxuICAgIF0uam9pbihcIlwiKTtcblxuICAgIHJldHVybiBjaGFycztcbiAgfVxufVxuIiwiaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSBcIi4uL2FkZHJlc3NpbmdcIjtcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSBcIi4uL2luc3RydWN0aW9uc1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweDQwIC0gMHg0RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICBcIjBcIixcbiAgXCIxXCIsXG4gIFwiMlwiLFxuICBcIjNcIixcbiAgXCI0XCIsXG4gIFwiNVwiLFxuICBcIjZcIixcbiAgXCI3XCIsXG4gIFwiOFwiLFxuICBcIjlcIixcbiAgXCJhXCIsXG4gIFwiYlwiLFxuICAvKiAweDRjOiBKTVAgQWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWJzb2x1dGUgPSBBZGRyZXNzaW5nLmFic29sdXRlLmJpbmQodGhpcyk7XG4gICAgY29uc3QgYWRkciA9IGFic29sdXRlKCk7XG5cbiAgICBjb25zdCBKTVAgPSBJbnN0cnVjdGlvbnMuSk1QLmJpbmQodGhpcyk7XG4gICAgSk1QKGFkZHIpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoSk1QLCBhYnNvbHV0ZSwgYWRkcik7XG4gIH0sXG4gIFwiZFwiLFxuICBcImVcIixcbiAgXCJmXCJcbl07XG4iLCIvKiAweDUwIC0gMHg1RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiLyogMHg2MCAtIDB4NkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiXTtcbiIsImltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSBcIi4uL2luc3RydWN0aW9uc1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICBcIjBcIixcbiAgXCIxXCIsXG4gIFwiMlwiLFxuICBcIjNcIixcbiAgXCI0XCIsXG4gIFwiNVwiLFxuICBcIjZcIixcbiAgXCI3XCIsXG4gIC8qIDB4Nzg6IFNFSSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBTRUkgPSBJbnN0cnVjdGlvbnMuU0VJLmJpbmQodGhpcyk7XG5cbiAgICBTRUkoKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFNFSSk7XG4gIH0sXG4gIFwiOVwiLFxuICBcImFcIixcbiAgXCJiXCIsXG4gIFwiY1wiLFxuICBcImRcIixcbiAgXCJlXCIsXG4gIFwiZlwiXG5dO1xuIiwiaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSBcIi4uL2FkZHJlc3NpbmdcIjtcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSBcIi4uL2luc3RydWN0aW9uc1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweDgwIC0gMHg4RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICBcIjBcIixcbiAgXCIxXCIsXG4gIFwiMlwiLFxuICBcIjNcIixcbiAgXCI0XCIsXG4gIFwiNVwiLFxuICBcIjZcIixcbiAgXCI3XCIsXG4gIC8qIDB4ODg6IERFWSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBERVkgPSBJbnN0cnVjdGlvbnMuREVZLmJpbmQodGhpcyk7XG5cbiAgICBERVkoKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKERFWSk7XG4gIH0sXG4gIFwiOVwiLFxuICBcImFcIixcbiAgXCJiXCIsXG4gIFwiY1wiLFxuICAvKiAweDhkOiBTVEEgQWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWJzb2x1dGUgPSBBZGRyZXNzaW5nLmFic29sdXRlLmJpbmQodGhpcyk7XG5cbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGUoKTtcbiAgICBjb25zdCBTVEEgPSBJbnN0cnVjdGlvbnMuU1RBLmJpbmQodGhpcyk7XG5cbiAgICBTVEEoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhTVEEsIGFic29sdXRlLCBhZGRyKTtcbiAgfSxcbiAgXCJlXCIsXG4gIFwiZlwiXG5dO1xuIiwiLy9pbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qIDB4OTAgLSAweDlGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIFwiMFwiLFxuICBcIjFcIixcbiAgXCIyXCIsXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgXCI4XCIsXG4gIFwiOVwiLFxuICAvKiA5QTogVFhTIEltcGxpZWQqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBUWFMgPSBJbnN0cnVjdGlvbnMuVFhTLmJpbmQodGhpcyk7XG4gICAgVFhTKCk7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhUWFMpO1xuICB9LFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiXG5dO1xuIiwiaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgQWRkcmVzc2luZyBmcm9tIFwiLi4vYWRkcmVzc2luZ1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweEEwIC0gMHhBRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweEEwOiBMRFkgSW1tZWRpYXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaW1tZWRpYXRlID0gQWRkcmVzc2luZy5pbW1lZGlhdGUuYmluZCh0aGlzKTtcbiAgICBjb25zdCBhZGRyID0gaW1tZWRpYXRlKCk7XG5cbiAgICBjb25zdCBMRFkgPSBJbnN0cnVjdGlvbnMuTERZLmJpbmQodGhpcyk7XG4gICAgTERZKGFkZHIpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERZLCBpbW1lZGlhdGUsIHRoaXMucmFtLnJlYWQoYWRkcikpO1xuICB9LFxuICBcIjFcIixcbiAgLyogMHhBMjogTERYIEltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBpbW1lZGlhdGUgPSBBZGRyZXNzaW5nLmltbWVkaWF0ZS5iaW5kKHRoaXMpO1xuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKTtcblxuICAgIGNvbnN0IExEWCA9IEluc3RydWN0aW9ucy5MRFguYmluZCh0aGlzKTtcbiAgICBMRFgoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMRFgsIGltbWVkaWF0ZSwgdGhpcy5yYW0ucmVhZChhZGRyKSk7XG4gIH0sXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgXCI4XCIsXG5cbiAgLyogMHhBOTogTERBIEltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBpbW1lZGlhdGUgPSBBZGRyZXNzaW5nLmltbWVkaWF0ZS5iaW5kKHRoaXMpO1xuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKTtcblxuICAgIGNvbnN0IExEQSA9IEluc3RydWN0aW9ucy5MREEuYmluZCh0aGlzKTtcbiAgICBMREEoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMREEsIGltbWVkaWF0ZSwgdGhpcy5yYW0ucmVhZChhZGRyKSk7XG4gIH0sXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCJcbl07XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tIFwiLi4vYWRkcmVzc2luZ1wiO1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4YjAgLSAweGJGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIFwiMFwiLFxuICBcIjFcIixcbiAgXCIyXCIsXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgXCI4XCIsXG4gIFwiOVwiLFxuICBcImFcIixcbiAgXCJiXCIsXG4gIFwiY1wiLFxuICAvKiAweGJkOiBMREEgQWJzb2x1dGVtIFggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWJzb2x1dGVYID0gQWRkcmVzc2luZy5hYnNvbHV0ZVguYmluZCh0aGlzKTtcbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGVYKCk7XG5cbiAgICBjb25zdCBMREEgPSBJbnN0cnVjdGlvbnMuTERBLmJpbmQodGhpcyk7XG4gICAgTERBKGFkZHIpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERBLCBhYnNvbHV0ZVgsIGFkZHIpO1xuICB9LFxuICBcImVcIixcbiAgXCJmXCJcbl07XG4iLCIvKiAweGMwIC0gMHhjRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSBcIi4uL2FkZHJlc3NpbmdcIjtcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSBcIi4uL2luc3RydWN0aW9uc1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweGQwIC0gMHhkRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweGQwOiBCTkUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmVsYXRpdmUgPSBBZGRyZXNzaW5nLnJlbGF0aXZlLmJpbmQodGhpcyk7XG4gICAgY29uc3QgYWRkciA9IHJlbGF0aXZlKCk7XG5cbiAgICBjb25zdCBCTkUgPSBJbnN0cnVjdGlvbnMuQk5FLmJpbmQodGhpcyk7XG4gICAgQk5FKGFkZHIpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoQk5FLCByZWxhdGl2ZSwgYWRkcik7XG4gIH0sXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCJcbl07XG4iLCIvL2ltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gXCIuLi9pbnN0cnVjdGlvbnNcIjtcbmltcG9ydCBVdGlsIGZyb20gXCIuL3V0aWxcIjtcblxuLyogMHhlMCAtIDB4ZUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgXCIwXCIsXG4gIFwiMVwiLFxuICBcIjJcIixcbiAgXCIzXCIsXG4gIFwiNFwiLFxuICBcIjVcIixcbiAgXCI2XCIsXG4gIFwiN1wiLFxuICAvKiAweGU4OiBJTlggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgSU5YID0gSW5zdHJ1Y3Rpb25zLklOWC5iaW5kKHRoaXMpO1xuXG4gICAgSU5YKCk7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhJTlgpO1xuICB9LFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiLFxuICBcIlwiXG5dO1xuIiwiLyogMHhmMCAtIDB4ZmYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiXTtcbiIsImltcG9ydCB4MHggZnJvbSBcIi4vMHgweFwiO1xuaW1wb3J0IHgxeCBmcm9tIFwiLi8weDF4XCI7XG5pbXBvcnQgeDJ4IGZyb20gXCIuLzB4MnhcIjtcbmltcG9ydCB4M3ggZnJvbSBcIi4vMHgzeFwiO1xuaW1wb3J0IHg0eCBmcm9tIFwiLi8weDR4XCI7XG5pbXBvcnQgeDV4IGZyb20gXCIuLzB4NXhcIjtcbmltcG9ydCB4NnggZnJvbSBcIi4vMHg2eFwiO1xuaW1wb3J0IHg3eCBmcm9tIFwiLi8weDd4XCI7XG5pbXBvcnQgeDh4IGZyb20gXCIuLzB4OHhcIjtcbmltcG9ydCB4OXggZnJvbSBcIi4vMHg5eFwiO1xuaW1wb3J0IHhBeCBmcm9tIFwiLi8weEF4XCI7XG5pbXBvcnQgeEJ4IGZyb20gXCIuLzB4QnhcIjtcbmltcG9ydCB4Q3ggZnJvbSBcIi4vMHhDeFwiO1xuaW1wb3J0IHhEeCBmcm9tIFwiLi8weER4XCI7XG5pbXBvcnQgeEV4IGZyb20gXCIuLzB4RXhcIjtcbmltcG9ydCB4RnggZnJvbSBcIi4vMHhGeFwiO1xuXG5jb25zdCBvcGNvZGVzID0gW10uY29uY2F0KFxuICB4MHgsXG4gIHgxeCxcbiAgeDJ4LFxuICB4M3gsXG4gIHg0eCxcbiAgeDV4LFxuICB4NngsXG4gIHg3eCxcbiAgeDh4LFxuICB4OXgsXG4gIHhBeCxcbiAgeEJ4LFxuICB4Q3gsXG4gIHhEeCxcbiAgeEV4LFxuICB4Rnhcbik7XG5cbmV4cG9ydCBkZWZhdWx0IG9wY29kZXM7XG4iLCJpbXBvcnQgcmVnaXN0ZXJzIGZyb20gXCIuL3JlZ2lzdGVyc1wiO1xuaW1wb3J0IFJhbSBmcm9tIFwiLi9yYW1cIjtcbmltcG9ydCBvcGNvZGVzIGZyb20gXCIuL29wY29kZXNcIjtcblxuLyogNjUwMiBDUFUgKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENwdSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdCgpO1xuICB9XG5cbiAgaW5pdCgpIHtcbiAgICB0aGlzLnJlZ2lzdGVycyA9IHJlZ2lzdGVyczsgLy8g44Os44K444K544K/XG4gICAgdGhpcy5vcGNvZGVzID0gb3Bjb2RlczsgLy/lkb3ku6TkuIDopqdcbiAgICAvL3RoaXMub3Bjb2RlcyA9IG9wY29kZXMubWFwKG9wY29kZSA9PiBvcGNvZGUuYmluZCh0aGlzKSkgLy8g5ZG95Luk5LiA6KanXG5cbiAgICB0aGlzLnJhbSA9IG5ldyBSYW0oKTtcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgdGhpcy5yYW0uY29ubmVjdChwYXJ0cyk7XG4gIH1cblxuICByZXNldCgpIHtcbiAgICB0aGlzLmluaXQoKTtcbiAgfVxuXG4gIHJ1bihpc0RlYnVnKSB7XG4gICAgY29uc3QgcnVuID0gaXNEZWJ1ZyA/IHRoaXMuZGVidWcuYmluZCh0aGlzKSA6IHRoaXMuZXZhbC5iaW5kKHRoaXMpO1xuXG4gICAgc2V0SW50ZXJ2YWwocnVuLCA3MCk7XG4gIH1cblxuICAvLyDlkb3ku6TjgpLlh6bnkIbjgZnjgotcbiAgZXZhbCgpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICAvL2NvbnN0IG9wY29kZSA9IHRoaXMubWVtb3J5W2ldXG4gICAgY29uc3Qgb3Bjb2RlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcblxuICAgIHRoaXMub3Bjb2Rlc1tvcGNvZGVdLmNhbGwoKTtcbiAgfVxuXG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgZGVidWcoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgLy9jb25zdCBvcGNvZGUgPSB0aGlzLm1lbW9yeVtpXVxuICAgIGNvbnN0IG9wY29kZSA9IHRoaXMucmFtLnJlYWQoYWRkcik7XG5cbiAgICBpZiAodHlwZW9mIHRoaXMub3Bjb2Rlc1tvcGNvZGVdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IFwiICsgb3Bjb2RlLnRvU3RyaW5nKDE2KSk7XG4gICAgICBjb25zb2xlLmVycm9yKHRoaXMub3Bjb2Rlc1tvcGNvZGVdKTtcbiAgICB9XG5cbiAgICBjb25zdCBkZWJ1Z1N0cmluZyA9IHRoaXMub3Bjb2Rlc1tvcGNvZGVdLmJpbmQodGhpcykuY2FsbCgpO1xuICAgIGNvbnNvbGUubG9nKGRlYnVnU3RyaW5nKTtcbiAgfVxuXG4gIC8qIDB4ODAwMH7jga7jg6Hjg6Ljg6rjgatST03lhoXjga5QUkctUk9N44KS6Kqt44G/6L6844KAKi9cbiAgc2V0IHByZ1JvbShwcmdSb20pIHtcbiAgICBjb25zdCBzdGFydEFkZHIgPSAweDgwMDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZ1JvbS5sZW5ndGg7IGkrKykge1xuICAgICAgLy90aGlzLm1lbW9yeVtzdGFydEFkZHIraV0gPSBwcmdSb21baV1cbiAgICAgIHRoaXMucmFtLndyaXRlKHN0YXJ0QWRkciArIGksIHByZ1JvbVtpXSk7XG4gICAgfVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBWcmFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5tZW1vcnkgPSBuZXcgVWludDhBcnJheSgweDQwMDApO1xuICAgIHRoaXMudnAgPSBudWxsO1xuICB9XG5cbiAgY29ubmVjdChwcHUpIHtcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ID0gcHB1LnJlZnJlc2hEaXNwbGF5LmJpbmQocHB1KTtcbiAgfVxuXG4gIHdyaXRlRnJvbUJ1cyh2YWx1ZSkge1xuICAgIC8vY29uc29sZS5sb2coJ3ZyYW1bJCcgKyB0aGlzLnZwLnRvU3RyaW5nKDE2KSArICddID0gJyArIFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpKVxuICAgIHRoaXMubWVtb3J5W3RoaXMudnBdID0gdmFsdWU7XG4gICAgdGhpcy52cCsrO1xuICAgIHRoaXMucmVmcmVzaERpc3BsYXkgJiYgdGhpcy5yZWZyZXNoRGlzcGxheSgpO1xuICB9XG5cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlO1xuICB9XG5cbiAgcmVhZChhZGRyKSB7XG4gICAgcmV0dXJuIHRoaXMubWVtb3J5W2FkZHJdO1xuICB9XG59XG4iLCJpbXBvcnQgVnJhbSBmcm9tIFwiLi92cmFtXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBwdSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdCgpO1xuICB9XG5cbiAgaW5pdCgpIHtcbiAgICAvKiBBYm91dCBWUkFNXG4gICAgICogMHgwMDAwIC0gMHgwZmZmIDogUGF0dGVybiB0YWJsZSAwXG4gICAgICogMHgxMDAwIC0gMHgxZmZmIDogUGF0dGVybiB0YWJsZSAxXG4gICAgICogMHgyMDAwIC0gMHgyM2JmIDogTmFtZSB0YWJsZSAwXG4gICAgICogMHgyM2MwIC0gMHgyM2ZmIDogQXR0cmlidXRlIHRhYmxlIDBcbiAgICAgKiAweDI0MDAgLSAweDI3YmYgOiBOYW1lIHRhYmxlIDFcbiAgICAgKiAweDJiYzAgLSAweDJiYmYgOiBBdHRyaWJ1dGUgdGFibGUgMVxuICAgICAqIDB4MmMwMCAtIDB4MmZiZiA6IE5hbWUgdGFibGUgMlxuICAgICAqIDB4MmJjMCAtIDB4MmJmZiA6IEF0dHJpYnV0ZSB0YWJsZSAyXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAzXG4gICAgICogMHgyZmMwIC0gMHgyZmZmIDogQXR0cmlidXRlIHRhYmxlIDNcbiAgICAgKiAweDMwMDAgLSAweDNlZmYgOiBNaXJyb3Igb2YgMHgyMDAwIC0gMHgyZmZmXG4gICAgICogMHgzZjAwIC0gMHgzZjBmIDogQmFja2dyb3VuZCBwYWxldHRlXG4gICAgICogMHgzZjEwIC0gMHgzZjFmIDogU3ByaXRlIHBhbGV0dGVcbiAgICAgKiAweDNmMjAgLSAweDNmZmYgOiBNaXJyb3Igb2YgMHgzZjAwIDAgMHgzZjFmXG4gICAgICogKi9cbiAgICB0aGlzLnZyYW0gPSBuZXcgVnJhbSgpO1xuICB9XG5cbiAgY29ubmVjdChwYXJ0cykge1xuICAgIGlmIChwYXJ0cy5idXMpIHtcbiAgICAgIHBhcnRzLmJ1cy5jb25uZWN0KHsgdnJhbTogdGhpcy52cmFtIH0pO1xuICAgIH1cblxuICAgIGlmIChwYXJ0cy5yZW5kZXJlcikge1xuICAgICAgdGhpcy5yZW5kZXJlciA9IHBhcnRzLnJlbmRlcmVyO1xuICAgICAgdGhpcy52cmFtLmNvbm5lY3QodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyogJDIwMDAgLSAkMjNCRuOBruODjeODvOODoOODhuODvOODluODq+OCkuabtOaWsOOBmeOCiyAqL1xuICByZWZyZXNoRGlzcGxheSgpIHtcbiAgICAvKiDjgr/jgqTjg6soOHg4KeOCkjMyKjMw5YCLICovXG4gICAgZm9yIChsZXQgaSA9IDB4MjAwMDsgaSA8PSAweDIzYmY7IGkrKykge1xuICAgICAgY29uc3QgdGlsZUlkID0gdGhpcy52cmFtLnJlYWQoaSk7XG4gICAgICAvKiDjgr/jgqTjg6vjgpLmjIflrpogKi9cbiAgICAgIGNvbnN0IHRpbGUgPSB0aGlzLnRpbGVzW3RpbGVJZF07XG4gICAgICAvKiDjgr/jgqTjg6vjgYzkvb/nlKjjgZnjgovjg5Hjg6zjg4Pjg4jjgpLlj5blvpcgKi9cbiAgICAgIGNvbnN0IHBhbGV0dGVJZCA9IHRoaXMuc2VsZWN0UGFsZXR0ZSh0aWxlSWQpO1xuICAgICAgY29uc3QgcGFsZXR0ZSA9IHRoaXMuc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKHBhbGV0dGVJZCk7XG5cbiAgICAgIC8qIOOCv+OCpOODq+OBqOODkeODrOODg+ODiOOCklJlbmRlcmVy44Gr5rih44GZICovXG4gICAgICB0aGlzLnJlbmRlcmVyLndyaXRlKHRpbGUsIHBhbGV0dGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qIDB4MDAwMCAtIDB4MWZmZuOBruODoeODouODquOBq0NIUi1ST03jgpLoqq3jgb/ovrzjgoAgKi9cbiAgc2V0IGNoclJvbShjaHJSb20pIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoclJvbS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy52cmFtLndyaXRlKGksIGNoclJvbVtpXSk7XG4gICAgfVxuXG4gICAgLyogQ0hS6aCY5Z+f44GL44KJ44K/44Kk44Or44KS5oq95Ye644GX44Gm44GK44GPICovXG4gICAgdGhpcy5leHRyYWN0VGlsZXMoKTtcbiAgfVxuXG4gIC8vIDh4OOOBruOCv+OCpOODq+OCkuOBmeOBueOBpnZyYW3jga5DSFLjgYvjgonmir3lh7rjgZfjgabjgYrjgY9cbiAgZXh0cmFjdFRpbGVzKCkge1xuICAgIHRoaXMudGlsZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDB4MWZmZjsgKSB7XG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIvkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGxvd2VyQml0TGluZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGxldCBieXRlID0gdGhpcy52cmFtLnJlYWQoaSsrKTtcbiAgICAgICAgY29uc3QgbGluZSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IGJpdCA9IGJ5dGUgJiAweDAxO1xuICAgICAgICAgIGxpbmUudW5zaGlmdChiaXQpO1xuICAgICAgICAgIGJ5dGUgPSBieXRlID4+IDE7XG4gICAgICAgIH1cblxuICAgICAgICBsb3dlckJpdExpbmVzLnB1c2gobGluZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIOOCv+OCpOODq+OBruS4iuS9jeODk+ODg+ODiFxuICAgICAgY29uc3QgaGlnaGVyQml0TGluZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGxldCBieXRlID0gdGhpcy52cmFtLnJlYWQoaSsrKTtcbiAgICAgICAgY29uc3QgbGluZSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IGJpdCA9IGJ5dGUgJiAweDAxO1xuICAgICAgICAgIGxpbmUudW5zaGlmdChiaXQgPDwgMSk7XG4gICAgICAgICAgYnl0ZSA9IGJ5dGUgPj4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGhpZ2hlckJpdExpbmVzLnB1c2gobGluZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIOS4iuS9jeODk+ODg+ODiOOBqOS4i+S9jeODk+ODg+ODiOOCkuWQiOaIkOOBmeOCi1xuICAgICAgY29uc3QgcGVyZmVjdEJpdHMgPSBbXTtcbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgcGVyZmVjdEJpdCA9IGxvd2VyQml0TGluZXNbaF1bal0gfCBoaWdoZXJCaXRMaW5lc1toXVtqXTtcbiAgICAgICAgICBwZXJmZWN0Qml0cy5wdXNoKHBlcmZlY3RCaXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnRpbGVzLnB1c2gocGVyZmVjdEJpdHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qIOWxnuaAp+ODhuODvOODluODq+OBi+OCieipsuW9k+ODkeODrOODg+ODiOOBrueVquWPt+OCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RQYWxldHRlKG4pIHtcbiAgICBjb25zdCBibG9ja1Bvc2l0aW9uID0gKChuIC0gKG4gJSA2NCkpIC8gNjQpICogOCArICgobiAlIDY0KSAtIChuICUgNCkpIC8gNDtcbiAgICBjb25zdCBiaXRQb3NpdGlvbiA9IG4gJSA0O1xuICAgIGNvbnN0IHN0YXJ0ID0gMHgyM2MwO1xuXG4gICAgY29uc3QgYmxvY2sgPSB0aGlzLnZyYW0ucmVhZChzdGFydCArIGJsb2NrUG9zaXRpb24pO1xuICAgIGNvbnN0IGJpdCA9IChibG9jayA+PiBiaXRQb3NpdGlvbikgJiAweDAzO1xuXG4gICAgcmV0dXJuIGJpdDtcbiAgfVxuXG4gIC8qICQzRjAwLSQzRjBG44GL44KJ44OQ44OD44Kv44Kw44Op44Km44Oz44OJKOiDjOaZrynjg5Hjg6zjg4Pjg4jjgpLlj5blvpfjgZnjgosgKi9cbiAgc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXTtcblxuICAgIGNvbnN0IHN0YXJ0ID0gMHgzZjAwICsgbnVtYmVyICogNDtcbiAgICBjb25zdCBlbmQgPSAweDNmMDAgKyBudW1iZXIgKiA0ICsgNDtcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgcGFsZXR0ZS5wdXNoKHRoaXMudnJhbS5yZWFkKGkpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFsZXR0ZTtcbiAgfVxuXG4gIC8qICQzRjEwLSQzRjFG44GL44KJ44K544OX44Op44Kk44OI44OR44Os44OD44OI44KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdFNwcml0ZVBhbGV0dHMobnVtYmVyKSB7XG4gICAgY29uc3QgcGFsZXR0ZSA9IFtdO1xuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMTAgKyBudW1iZXIgKiA0O1xuICAgIGNvbnN0IGVuZCA9IDB4M2YxMCArIG51bWJlciAqIDQgKyA0O1xuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpO1xuICAgIH1cblxuICAgIHJldHVybiBwYWxldHRlO1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBCdXMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHt9O1xuICAgIHRoaXMudnJhbUFkZHJfID0gW107XG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMudnJhbSAmJiAodGhpcy52cmFtID0gcGFydHMudnJhbSk7XG4gIH1cblxuICAvKiBDUFXlgbTjgYvjgonjga7jgb/jgZfjgYvogIPmha7jgZfjgabjgarjgYQgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBzd2l0Y2ggKGFkZHIpIHtcbiAgICAgIGNhc2UgMHgyMDA2OlxuICAgICAgICB0aGlzLnZyYW1BZGRyID0gdmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAweDIwMDc6XG4gICAgICAgIHRoaXMudnJhbS53cml0ZUZyb21CdXModmFsdWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuYnVmZmVyW2FkZHJdID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmVhZChhZGRyKSB7XG4gICAgc3dpdGNoIChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgcmV0dXJuIHRoaXMudnJhbUFkZHI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYnVzIG9mIHRoaXMgYWRkciBpcyBOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuICB9XG5cbiAgc2V0IHZyYW1BZGRyKGFkZHIpIHtcbiAgICBpZiAodGhpcy52cmFtQWRkcl8ubGVuZ3RoIDwgMSkge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKTtcbiAgICAgIHRoaXMudnJhbS52cCA9IHRoaXMudnJhbUFkZHI7XG4gICAgICB0aGlzLnZyYW1BZGRyXy5sZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIGdldCB2cmFtQWRkcigpIHtcbiAgICByZXR1cm4gKHRoaXMudnJhbUFkZHJfWzBdIDw8IDgpICsgdGhpcy52cmFtQWRkcl9bMV07XG4gIH1cbn1cbiIsImltcG9ydCBDcHUgZnJvbSAnLi9jcHUnXG5pbXBvcnQgUHB1IGZyb20gJy4vcHB1J1xuaW1wb3J0IEJ1cyBmcm9tICcuL2J1cydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTmVzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jcHUgPSBuZXcgQ3B1KClcbiAgICB0aGlzLnBwdSA9IG5ldyBQcHUoKVxuICAgIHRoaXMuYnVzID0gbmV3IEJ1cygpXG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IGJ1czogdGhpcy5idXMgfSlcbiAgICB0aGlzLmNwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICB9XG5cbiAgY29ubmVjdChyZW5kZXJlcikge1xuICAgIHRoaXMucHB1LmNvbm5lY3QoeyByZW5kZXJlciB9KVxuICB9XG5cbiAgZ2V0IHJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9tXG4gIH1cblxuICBzZXQgcm9tKHJvbSkge1xuICAgIHRoaXMuX3JvbSA9IHJvbVxuICB9XG5cbiAgcnVuKGlzRGVidWcpIHtcbiAgICB0aGlzLmNwdS5wcmdSb20gPSB0aGlzLnJvbS5wcmdSb21cbiAgICB0aGlzLnBwdS5jaHJSb20gPSB0aGlzLnJvbS5jaHJSb21cblxuICAgIHRoaXMuY3B1LnJ1bihpc0RlYnVnKVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSb20ge1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5jaGVjayhkYXRhKTtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICB9XG5cbiAgY2hlY2soZGF0YSkge1xuICAgIGlmICghdGhpcy5pc05lc1JvbShkYXRhKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBpcyBub3QgTkVTIFJPTS5cIik7XG4gIH1cblxuICBnZXQgTkVTX1JPTV9IRUFERVJfU0laRSgpIHtcbiAgICByZXR1cm4gMHgxMDtcbiAgfVxuXG4gIGdldCBTVEFSVF9BRERSRVNTX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuTkVTX1JPTV9IRUFERVJfU0laRSArIHRoaXMuU0laRV9PRl9QUkdfUk9NO1xuICB9XG5cbiAgZ2V0IEVORF9BRERSRVNTX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NICsgdGhpcy5TSVpFX09GX0NIUl9ST007XG4gIH1cblxuICAvKiBQUkcgUk9N44Gu44K144Kk44K644KS5Y+W5b6X44GZ44KLXG4gICAqKiBST03jg5jjg4Pjg4Djga4x44GL44KJ5pWw44GI44GmNUJ5dGXnm67jga7lgKTjgasxNktpKOOCreODkynjgpLjgYvjgZHjgZ/jgrXjgqTjgrogKi9cbiAgZ2V0IFNJWkVfT0ZfUFJHX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhWzRdICogMHg0MDAwO1xuICB9XG5cbiAgLyogUFJHIFJPTeOBq+WQjOOBmCovXG4gIGdldCBTSVpFX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YVs1XSAqIDB4MjAwMDtcbiAgfVxuXG4gIC8qIFJPTeOBi+OCiXByZ1JPTeOBq+ipsuW9k+OBmeOCi+OBqOOBk+OCjeOCkuWIh+OCiuWHuuOBmVxuICAgKiogcHJnUk9N44Gv44OY44OD44OA6aCY5Z+f44Gu5qyh44GuQnl0ZeOBi+OCieWni+OBvuOCiyAqL1xuICBnZXQgcHJnUm9tKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2xpY2UoXG4gICAgICB0aGlzLk5FU19ST01fSEVBREVSX1NJWkUsXG4gICAgICB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSAtIDFcbiAgICApO1xuICB9XG5cbiAgLyogUk9N44GL44KJY2hyUk9N44Gr6Kmy5b2T44GZ44KL44Go44GT44KN44KS5YiH44KK5Ye644GZXG4gICAqKiBjaHJSb23jga9wcmdSb23jga7lvozjgYvjgonlp4vjgb7jgosgKi9cbiAgZ2V0IGNoclJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKFxuICAgICAgdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00sXG4gICAgICB0aGlzLkVORF9BRERSRVNTX09GX0NIUl9ST00gLSAxXG4gICAgKTtcbiAgfVxuXG4gIC8qIOODh+ODvOOCv+OBruODmOODg+ODgOOBqydORVMn44GM44GC44KL44GL44Gp44GG44GL44GnTkVT44GuUk9N44GL5Yik5Yil44GZ44KLICovXG4gIGlzTmVzUm9tKGRhdGEpIHtcbiAgICBjb25zdCBoZWFkZXIgPSBkYXRhLnNsaWNlKDAsIDMpO1xuICAgIGNvbnN0IGhlYWRlclN0ciA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgaGVhZGVyKTtcblxuICAgIHJldHVybiBoZWFkZXJTdHIgPT09IFwiTkVTXCI7XG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJlbmRlcmVyIHtcbiAgY29uc3RydWN0b3IoaWQpIHtcbiAgICBsZXQgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgIHRoaXMuY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgdGhpcy5wb2ludGVyID0gMDtcbiAgICB0aGlzLndpZHRoID0gMzI7XG4gICAgdGhpcy5oZWlnaHQgPSAzMDtcbiAgfVxuXG4gIHdyaXRlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuZ2VuZXJhdGVUaWxlSW1hZ2UodGlsZSwgcGFsZXR0ZSk7XG4gICAgY29uc3QgeCA9ICh0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSAqIDg7XG4gICAgY29uc3QgeSA9ICgodGhpcy5wb2ludGVyIC0gKHRoaXMucG9pbnRlciAlIHRoaXMud2lkdGgpKSAvIHRoaXMud2lkdGgpICogODtcblxuICAgIGlmICh0aGlzLnBvaW50ZXIgPCB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgLSAxKSB7XG4gICAgICB0aGlzLnBvaW50ZXIrKztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wb2ludGVyID0gMDtcbiAgICB9XG5cbiAgICB0aGlzLmNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlLCB4LCB5KTtcbiAgfVxuXG4gIGdlbmVyYXRlVGlsZUltYWdlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuY29udGV4dC5jcmVhdGVJbWFnZURhdGEoOCwgOCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY0OyBpKyspIHtcbiAgICAgIGNvbnN0IGJpdCA9IHRpbGVbaV07XG4gICAgICBjb25zdCBjb2xvciA9IHRoaXMuY29sb3IocGFsZXR0ZVtiaXRdKTtcblxuICAgICAgaW1hZ2UuZGF0YVtpICogNF0gPSBjb2xvclswXTtcbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAxXSA9IGNvbG9yWzFdO1xuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDJdID0gY29sb3JbMl07XG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgM10gPSAyNTU7IC8vIOmAj+aYjuW6plxuICAgIH1cblxuICAgIHJldHVybiBpbWFnZTtcbiAgfVxuXG4gIGNvbG9yKGNvbG9ySWQpIHtcbiAgICByZXR1cm4gW1xuICAgICAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICAgICAgWzB4MjcsIDB4MWIsIDB4OGZdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4YWJdLFxuICAgICAgWzB4NDcsIDB4MDAsIDB4OWZdLFxuICAgICAgWzB4OGYsIDB4MDAsIDB4NzddLFxuICAgICAgWzB4YWIsIDB4MDAsIDB4MTNdLFxuICAgICAgWzB4YTcsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4N2YsIDB4MGIsIDB4MDBdLFxuICAgICAgWzB4NDMsIDB4MmYsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4NDcsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4NTEsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4M2YsIDB4MTddLFxuICAgICAgWzB4MWIsIDB4M2YsIDB4NWZdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICAgICAgWzB4MDAsIDB4NzMsIDB4ZWZdLFxuICAgICAgWzB4MjMsIDB4M2IsIDB4ZWZdLFxuICAgICAgWzB4ODMsIDB4MDAsIDB4ZjNdLFxuICAgICAgWzB4YmYsIDB4MDAsIDB4YmZdLFxuICAgICAgWzB4ZTcsIDB4MDAsIDB4NWJdLFxuICAgICAgWzB4ZGIsIDB4MmIsIDB4MDBdLFxuICAgICAgWzB4Y2IsIDB4NGYsIDB4MGZdLFxuICAgICAgWzB4OGIsIDB4NzMsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4OTcsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4YWIsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4OTMsIDB4M2JdLFxuICAgICAgWzB4MDAsIDB4ODMsIDB4OGJdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4ZmYsIDB4ZmYsIDB4ZmZdLFxuICAgICAgWzB4M2YsIDB4YmYsIDB4ZmZdLFxuICAgICAgWzB4NWYsIDB4NzMsIDB4ZmZdLFxuICAgICAgWzB4YTcsIDB4OGIsIDB4ZmRdLFxuICAgICAgWzB4ZjcsIDB4N2IsIDB4ZmZdLFxuICAgICAgWzB4ZmYsIDB4NzcsIDB4YjddLFxuICAgICAgWzB4ZmYsIDB4NzcsIDB4NjNdLFxuICAgICAgWzB4ZmYsIDB4OWIsIDB4M2JdLFxuICAgICAgWzB4ZjMsIDB4YmYsIDB4M2ZdLFxuICAgICAgWzB4ODMsIDB4ZDMsIDB4MTNdLFxuICAgICAgWzB4NGYsIDB4ZGYsIDB4NGJdLFxuICAgICAgWzB4NTgsIDB4ZjgsIDB4OThdLFxuICAgICAgWzB4MDAsIDB4ZWIsIDB4ZGJdLFxuICAgICAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4ZmYsIDB4ZmYsIDB4ZmZdLFxuICAgICAgWzB4YWIsIDB4ZTcsIDB4ZmZdLFxuICAgICAgWzB4YzcsIDB4ZDcsIDB4ZmZdLFxuICAgICAgWzB4ZDcsIDB4Y2IsIDB4ZmZdLFxuICAgICAgWzB4ZmYsIDB4YzcsIDB4ZmZdLFxuICAgICAgWzB4ZmYsIDB4YzcsIDB4ZGJdLFxuICAgICAgWzB4ZmYsIDB4YmYsIDB4YjNdLFxuICAgICAgWzB4ZmYsIDB4ZGIsIDB4YWJdLFxuICAgICAgWzB4ZmYsIDB4ZTcsIDB4YTNdLFxuICAgICAgWzB4ZTMsIDB4ZmYsIDB4YTNdLFxuICAgICAgWzB4YWIsIDB4ZjMsIDB4YmZdLFxuICAgICAgWzB4YjMsIDB4ZmYsIDB4Y2ZdLFxuICAgICAgWzB4OWYsIDB4ZmYsIDB4ZjNdLFxuICAgICAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICAgICAgWzB4MDAsIDB4MDAsIDB4MDBdXG4gICAgXVtjb2xvcklkXTtcbiAgfVxufVxuIiwiaW1wb3J0IE5lc18gZnJvbSBcIi4vbmVzXCI7XG5pbXBvcnQgUm9tXyBmcm9tIFwiLi9yb21cIjtcbmltcG9ydCBSZW5kZXJlcl8gZnJvbSBcIi4vcmVuZGVyZXJcIjtcblxuZXhwb3J0IGNvbnN0IE5lcyA9IE5lc187XG5leHBvcnQgY29uc3QgUm9tID0gUm9tXztcbmV4cG9ydCBjb25zdCBSZW5kZXJlciA9IFJlbmRlcmVyXztcbiJdLCJuYW1lcyI6WyJVdGlsIiwiTmVzIiwiTmVzXyIsIlJvbSIsIlJvbV8iLCJSZW5kZXJlciIsIlJlbmRlcmVyXyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0JBQWU7RUFDZixFQUFFLEdBQUcsRUFBRSxJQUFJO0VBQ1gsRUFBRSxNQUFNLEVBQUUsSUFBSTtFQUNkLEVBQUUsTUFBTSxFQUFFLElBQUk7RUFDZCxFQUFFLEVBQUUsRUFBRSxNQUFNO0VBQ1osRUFBRSxNQUFNLEVBQUU7RUFDVjtFQUNBLElBQUksU0FBUyxFQUFFLENBQUM7RUFDaEIsSUFBSSxTQUFTLEVBQUUsQ0FBQztFQUNoQixJQUFJLFNBQVMsRUFBRSxDQUFDO0VBQ2hCLElBQUksTUFBTSxFQUFFLENBQUM7RUFDYixJQUFJLFFBQVEsRUFBRSxDQUFDO0VBQ2YsSUFBSSxVQUFVLEVBQUUsQ0FBQztFQUNqQixJQUFJLEtBQUssRUFBRSxDQUFDO0VBQ1osSUFBSSxNQUFNLEVBQUUsQ0FBQztFQUNiLEdBQUc7RUFDSCxFQUFFLEVBQUUsRUFBRSxNQUFNO0VBQ1osQ0FBQyxDQUFDOztFQ2pCYSxNQUFNLEdBQUcsQ0FBQztFQUN6QixFQUFFLFdBQVcsR0FBRztFQUNoQixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7RUFDMUMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUU7RUFDakIsSUFBSSxLQUFLLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3hDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0VBQ3JCLElBQUksSUFBSSxJQUFJLElBQUksTUFBTSxJQUFJLElBQUksSUFBSSxNQUFNLEVBQUU7RUFDMUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7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LElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRztFQUNIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUN0QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztFQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0VBQ2xDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDN0MsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQ2hELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztFQUNoRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7RUFDbEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0VBQ2xDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztFQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7RUFDeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUM7RUFDL0IsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ3hDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztFQUMvQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztFQUMvQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztFQUN2QyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ2hDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0VBQ3ZDLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxPQUFPLElBQUksQ0FBQztFQUNoQixHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksT0FBTyxJQUFJLENBQUM7RUFDaEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ2xELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUNsRCxJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7RUFDNUIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO0VBQzVCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7RUFDeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztFQUM1QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ3hDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7RUFDNUIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDbEUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDbEUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQ2hELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztFQUV6QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7RUFDdkMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLENBQUM7RUFDOUQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQ2hELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDOztFQUV4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUM7RUFDNUQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztFQUNyRCxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQzs7RUFFM0MsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0VBQ3ZDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0VBQzlELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7RUFDckQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUM7O0VBRTFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQztFQUM1RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDOUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUN0RCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDOUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUN0RCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO0VBQzdCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBC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eEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3hCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDeEIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0VBQ2YsR0FBRztFQUNILENBQUM7O0FDdkdXLFFBQUNDLEtBQUcsR0FBR0MsSUFBSztBQUN4QixBQUFZLFFBQUNDLEtBQUcsR0FBR0MsSUFBSztBQUN4QixBQUFZLFFBQUNDLFVBQVEsR0FBR0M7Ozs7Ozs7Ozs7Ozs7OyJ9
