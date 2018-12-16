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
        return
      }

      // 通常のメモリアクセス
      this.memory[addr] = value;
    }

    /*TODO コントローラ用のポート */
    read(addr) {
      return this.memory[addr]
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

  var Util$2 = {
    isNodejs: () => {
      return typeof process !== "undefined" && typeof require !== "undefined"
    }
  };

  /* 6502 CPU */
  class Cpu {
    constructor() {
      this.init();
    }

    init() {
      this.registers = registers;
      this.opcodes = opcodes;
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
      const execute = isDebug ? this.debug.bind(this) : this.eval.bind(this);

      Util$2.isNodejs() ? setInterval(execute, 100) : execute();
    }

    // 命令を処理する
    eval() {
      const addr = this.registers.pc++;
      //const opcode = this.memory[i]
      const opcode = this.ram.read(addr);

      this.opcodes[opcode].call();

      const fn = this.eval.bind(this);

      if(!Util$2.isNodejs()) window.requestAnimationFrame(fn);
    }

    /* eslint-disable no-console */
    debug() {
      const addr = this.registers.pc++;
      //const opcode = this.memory[i]
      const opcode = this.ram.read(addr);

      if (typeof this.opcodes[opcode] !== 'function') {
        console.error('Not implemented: ' + opcode.toString(16));
        console.error(this.opcodes[opcode]);
      }

      const debugString = this.opcodes[opcode].bind(this).call();
      console.log(debugString);

      const fn = this.debug.bind(this);

      if(!Util$2.isNodejs()) window.requestAnimationFrame(fn);
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
      return this.memory[addr]
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

      return bit
    }

    /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
    selectBackgroundPalettes(number) {
      const palette = [];

      const start = 0x3f00 + number * 4;
      const end = 0x3f00 + number * 4 + 4;
      for (let i = start; i < end; i++) {
        palette.push(this.vram.read(i));
      }

      return palette
    }

    /* $3F10-$3F1Fからスプライトパレットを取得する */
    selectSpritePaletts(number) {
      const palette = [];

      const start = 0x3f10 + number * 4;
      const end = 0x3f10 + number * 4 + 4;
      for (let i = start; i < end; i++) {
        palette.push(this.vram.read(i));
      }

      return palette
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
          break
        case 0x2007:
          this.vram.writeFromBus(value);
          break
        default:
          this.buffer[addr] = value;
      }
    }

    read(addr) {
      switch (addr) {
        case 0x2006:
          return this.vramAddr
        default:
          throw new Error('The bus of this addr is Not implemented')
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
      return (this.vramAddr_[0] << 8) + this.vramAddr_[1]
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
      if (!this.isNesRom(data)) throw new Error('This is not NES ROM.')
    }

    get NES_ROM_HEADER_SIZE() {
      return 0x10
    }

    get START_ADDRESS_OF_CHR_ROM() {
      return this.NES_ROM_HEADER_SIZE + this.SIZE_OF_PRG_ROM
    }

    get END_ADDRESS_OF_CHR_ROM() {
      return this.START_ADDRESS_OF_CHR_ROM + this.SIZE_OF_CHR_ROM
    }

    /* PRG ROMのサイズを取得する
     ** ROMヘッダの1から数えて5Byte目の値に16Ki(キビ)をかけたサイズ */
    get SIZE_OF_PRG_ROM() {
      return this.data[4] * 0x4000
    }

    /* PRG ROMに同じ*/
    get SIZE_OF_CHR_ROM() {
      return this.data[5] * 0x2000
    }

    /* ROMからprgROMに該当するところを切り出す
     ** prgROMはヘッダ領域の次のByteから始まる */
    get prgRom() {
      return this.data.slice(
        this.NES_ROM_HEADER_SIZE,
        this.START_ADDRESS_OF_CHR_ROM - 1
      )
    }

    /* ROMからchrROMに該当するところを切り出す
     ** chrRomはprgRomの後から始まる */
    get chrRom() {
      return this.data.slice(
        this.START_ADDRESS_OF_CHR_ROM,
        this.END_ADDRESS_OF_CHR_ROM - 1
      )
    }

    /* データのヘッダに'NES'があるかどうかでNESのROMか判別する */
    isNesRom(data) {
      const header = data.slice(0, 3);
      const headerStr = String.fromCharCode.apply(null, header);

      return headerStr === 'NES'
    }
  }

  var colors = [
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
  ];

  class Renderer {
    constructor(id) {
      if(!id) throw new Error('Id of canvas tag isn\'t specified.')

      let canvas = document.getElementById(id);
      this.context = canvas.getContext('2d');
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

      return image
    }

    color(colorId) {
      return colors[colorId]
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgxeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDJ4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4M3guanMiLCIuLi9zcmMvY3B1L2FkZHJlc3NpbmcvaW5kZXguanMiLCIuLi9zcmMvY3B1L2luc3RydWN0aW9ucy91dGlsLmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvaW5kZXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy91dGlsLmpzIiwiLi4vc3JjL2NwdS9jcHUuanMiLCIuLi9zcmMvcHB1L3ZyYW0uanMiLCIuLi9zcmMvcHB1L3BwdS5qcyIsIi4uL3NyYy9idXMvaW5kZXguanMiLCIuLi9zcmMvbmVzLmpzIiwiLi4vc3JjL3JvbS9pbmRleC5qcyIsIi4uL3NyYy9yZW5kZXJlci9jb2xvcnMuanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICBhY2M6IDB4MDAsIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICBpbmRleFg6IDB4MDAsIC8vIOOCpOODs+ODh+ODg+OCr+OCueODrOOCuOOCueOCv++8muOCouODieODrOODg+OCt+ODs+OCsOOAgeOCq+OCpuODs+OCv+etiVxuICBpbmRleFk6IDB4MDAsIC8vIOS4iuOBq+WQjOOBmFxuICBzcDogMHgwMWZkLCAvLyDjgrnjgr/jg4Pjgq/jg53jgqTjg7Pjgr9cbiAgc3RhdHVzOiB7XG4gICAgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgbmVnYXRpdmVfOiAwLFxuICAgIG92ZXJmbG93XzogMCxcbiAgICByZXNlcnZlZF86IDEsXG4gICAgYnJlYWtfOiAxLCAvLyDlibLjgorovrzjgb9CUkvnmbrnlJ/mmYLjgat0cnVlLElSUeeZuueUn+aZguOBq2ZhbHNlXG4gICAgZGVjaW1hbF86IDAsXG4gICAgaW50ZXJydXB0XzogMSxcbiAgICB6ZXJvXzogMCxcbiAgICBjYXJyeV86IDBcbiAgfSxcbiAgcGM6IDB4ODAwMCAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr9cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubWVtb3J5ID0gbmV3IFVpbnQ4QXJyYXkoMHgxMDAwMClcbiAgfVxuXG4gIC8qIE1lbW9yeSBtYXBwZWQgSS9P44Gn44GC44KL44Gf44KB77yM44OQ44K5KEJ1cynjgpLmjqXntprjgZfjgabjgYrjgY9cbiAgICogUFBV562J44G444GvQnVz44KS6YCa44GX44Gm44OH44O844K/44Gu44KE44KK5Y+W44KK44KS6KGM44GGXG4gICAqICovXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgKHRoaXMuYnVzID0gcGFydHMuYnVzKVxuICB9XG5cbiAgLypUT0RPIOWQhOODneODvOODiChhZGRyKeOBq+OCouOCr+OCu+OCueOBjOOBguOBo+OBn+WgtOWQiOOBq+OBr+ODkOOCueOBq+abuOOBjei+vOOCgCAqL1xuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIGlmIChhZGRyID49IDB4MjAwMCAmJiBhZGRyIDw9IDB4MjAwNykge1xuICAgICAgdGhpcy5idXMud3JpdGUoYWRkciwgdmFsdWUpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyDpgJrluLjjga7jg6Hjg6Ljg6rjgqLjgq/jgrvjgrlcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlXG4gIH1cblxuICAvKlRPRE8g44Kz44Oz44OI44Ot44O844Op55So44Gu44Od44O844OIICovXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCIvKiAweDAwIC0gMHgwRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiLyogMHgxMCAtIDB4MUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiLCBcIlwiXTtcbiIsIi8qIDB4MjAgLSAweDJGICovXG5leHBvcnQgZGVmYXVsdCBbXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIl07XG4iLCIvKiAweDMwIC0gMHgzRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvKiA4Yml044Gu5Y2z5YCk44Gq44Gu44Gn44Ki44OJ44Os44K544KS44Gd44Gu44G+44G+6L+U44GZICovXG4gIGltbWVkaWF0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgcmV0dXJuIGFkZHI7XG4gIH0sXG5cbiAgLyog44Ki44OJ44Os44K5YWRkcig4Yml0KeOCkui/lOOBmSAqL1xuICB6ZXJvcGFnZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKTtcbiAgICByZXR1cm4gYWRkcjtcbiAgfSxcblxuICAvKiAo44Ki44OJ44Os44K5YWRkciArIOODrOOCuOOCueOCv2luZGV4WCkoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2VYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIHJldHVybiBhZGRyICYgMHhmZjtcbiAgfSxcblxuICAvKiDkuIrjgajlkIzjgZjjgadpbmRleFnjgavmm7/jgYjjgovjgaDjgZEqL1xuICB6ZXJvcGFnZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG4gICAgcmV0dXJuIGFkZHIgJiAweGZmO1xuICB9LFxuXG4gIC8qIHplcm9wYWdl44GuYWRkcuOBjDE2Yml054mIICovXG4gIGFic29sdXRlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pO1xuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKTtcblxuICAgIGNvbnN0IGFkZHIgPSBsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpO1xuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmY7XG4gIH0sXG5cbiAgYWJzb2x1dGVYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pO1xuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKTtcblxuICAgIGNvbnN0IGFkZHIgPSAobG93QWRkciB8IChoaWdoQWRkciA8PCA4KSkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFg7XG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZjtcbiAgfSxcblxuICBhYnNvbHV0ZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXyk7XG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZChoaWdoQWRkcl8pO1xuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WTtcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmO1xuICB9LFxuXG4gIGluZGlyZWN0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKys7XG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pO1xuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKTtcblxuICAgIGNvbnN0IGFkZHJfID0gbG93QWRkciB8IChoaWdoQWRkciA8PCA4KTtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCAodGhpcy5yYW0ucmVhZChhZGRyXyArIDEpIDw8IDgpO1xuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmY7XG4gIH0sXG5cbiAgaW5kZXhJbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBsZXQgYWRkcl8gPSB0aGlzLnJhbS5yZWFkKGFkZHJfXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFg7XG4gICAgYWRkcl8gPSBhZGRyXyAmIDB4MDBmZjtcblxuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSB8ICh0aGlzLnJhbS5yZWFkKGFkZHJfICsgMSkgPDwgOCk7XG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZjtcbiAgfSxcblxuICBpbmRpcmVjdEluZGV4OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrO1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pO1xuXG4gICAgbGV0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSB8ICh0aGlzLnJhbS5yZWFkKGFkZHJfICsgMSkgPDwgOCk7XG4gICAgYWRkciA9IGFkZHIgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFk7XG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZjtcbiAgfSxcblxuICAvKiAo44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/ICsg44Kq44OV44K744OD44OIKeOCkui/lOOBmeOAglxuICAgKiDjgqrjg5Xjgrvjg4Pjg4jjga7oqIjnrpfjgafjga/nrKblj7fku5jjgY3jga7lgKTjgYzkvb/nlKjjgZXjgozjgovjgIJcbiAgICog56ym5Y+35LuY44GN44Gu5YCk44GvXG4gICAqICAgLTEyOCgweDgwKSB+IC0xICgweGZmKVxuICAgKiAgIDAoMHgwMCkgfiAxMjcoMHg3ZilcbiAgICogKi9cbiAgcmVsYXRpdmU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrKztcbiAgICBjb25zdCBzaWduZWROdW1iZXIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKTtcblxuICAgIGxldCBhZGRyID1cbiAgICAgIHNpZ25lZE51bWJlciA+PSAweDgwXG4gICAgICAgID8gdGhpcy5yZWdpc3RlcnMucGMgKyBzaWduZWROdW1iZXIgLSAweDEwMFxuICAgICAgICA6IHRoaXMucmVnaXN0ZXJzLnBjICsgc2lnbmVkTnVtYmVyO1xuXG4gICAgcmV0dXJuIGFkZHI7XG4gIH1cbn07XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVdGlsIHtcbiAgc3RhdGljIGlzTmVnYXRpdmUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPj4gNztcbiAgfVxuXG4gIHN0YXRpYyBpc1plcm8odmFsdWUpIHtcbiAgICByZXR1cm4gKHZhbHVlID09PSAweDAwKSAmIDE7XG4gIH1cblxuICBzdGF0aWMgbXNiKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID4+IDc7XG4gIH1cblxuICBzdGF0aWMgbHNiKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlICYgMHgwMTtcbiAgfVxufVxuIiwiaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8qIExEKiAoTG9hZCBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV8gOiDoqIjnrpfntZDmnpzjgYzosqDjga7lgKTjga7jgajjgY0x44Gd44GG44Gn44Gq44GR44KM44GwMChhY2Pjga43Yml055uu44Go5ZCM44GY5YCk44Gr44Gq44KLKVxuICAgKiAgIC0gemVyb18gOiDoqIjnrpfntZDmnpzjgYzjgrzjg63jga7jgajjgY0x44Gd44GG44Gn44Gq44GR44KM44GwMFxuICAgKiAqL1xuICBMREE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuICAvKiDjg6zjgrjjgrnjgr9pbmRleFjjgatkYXRh44KS44Ot44O844OJ44GZ44KLICovXG4gIExEWDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgTERZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WSA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiBTVCogKFN0b3JlIG1lbW9yeVthZGRyKSB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrDmk43kvZzjga/nhKHjgZdcbiAgICogKi9cbiAgU1RBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuYWNjKTtcbiAgfSxcblxuICBTVFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFgpO1xuICB9LFxuXG4gIFNUWTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmluZGV4WSk7XG4gIH0sXG5cbiAgLyogVCoqIChUcmFuc2ZlciAqIHJlZ2lzdGVyIHRvICogcmVnaXN0ZXIpXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAqL1xuICBUQVg6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjO1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICBUQVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjO1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WSA9IHZhbHVlO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICBUU1g6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuc3A7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIFRYQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFg7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIFRYUzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFg7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3AgPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgVFlBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WTtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogYWNjICYgbWVtb3J5W2FkZHIpXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAqL1xuICBBTkQ6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWU7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIEHjgb7jgZ/jga/jg6Hjg6Ljg6rjgpLlt6bjgbjjgrfjg5Xjg4hcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIHplcm9fXG4gICAqICAgLSBjYXJyeV9cbiAgICogKi9cbiAgQVNMOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIGNvbnN0IG1zYiA9IFV0aWwubXNiKHZhbHVlKTtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB2YWx1ZSA8PCAxKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IG1zYjtcbiAgfSxcblxuICAvKiBhY2Pjgb7jgZ/jga/jg6Hjg6Ljg6rjgpLlj7Pjgbjjgrfjg5Xjg4hcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIHplcm9fXG4gICAqICAgLSBjYXJyeV9cbiAgICogKi9cbiAgTFNSOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIGNvbnN0IGxzYiA9IFV0aWwubHNiKHZhbHVlKTtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB2YWx1ZSA+PiAxKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IGxzYjtcbiAgfSxcblxuICAvKiBB44Go44Oh44Oi44Oq44KSQU5E5ryU566X44GX44Gm44OV44Op44Kw44KS5pON5L2c44GZ44KLXG4gICAqIOa8lOeul+e1kOaenOOBr+aNqOOBpuOCi1xuICAgKiAqL1xuICBCSVQ6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICByZXR1cm4gYWRkcjtcbiAgfSxcblxuICAvKiBB44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566X44GX44Gm44OV44Op44Kw44KS5pON5L2cXG4gICAqIOa8lOeul+e1kOaenOOBr+aNqOOBpuOCi1xuICAgKiBBID09IG1lbSAtPiBaID0gMFxuICAgKiBBID49IG1lbSAtPiBDID0gMVxuICAgKiBBIDw9IG1lbSAtPiBDID0gMFxuICAgKiAqL1xuICBDTVA6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICByZXR1cm4gYWRkcjtcbiAgfSxcblxuICAvKiBY44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XICovXG4gIENQWDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBZ44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XKi9cbiAgQ1BZOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qICrjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIHplcm9fXG4gICAqICovXG4gIC8qIOODoeODouODquOCkuOCpOODs+OCr+ODquODoeODs+ODiOOBmeOCiyovXG4gIElOQzogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmFtLnJlYWQoYWRkcikgKyAxKTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIOODoeODouODquOCkuODh+OCr+ODquODoeODs+ODiCAqL1xuICBERUM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpIC0gMSk7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiBY44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYKys7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFg7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSk7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpO1xuICB9LFxuXG4gIC8qIFnjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosgKi9cbiAgSU5ZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkrKztcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogWOOCkuODh+OCr+ODquODoeODs+ODiCAqL1xuICBERVg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WC0tO1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKTtcbiAgfSxcblxuICAvKiBZ44KS44OH44Kv44Oq44Oh44Oz44OIKi9cbiAgREVZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFktLTtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSk7XG4gIH0sXG5cbiAgLyogYWNj44Go44Oh44Oi44Oq44KS6KuW55CGWE9S5ryU566X44GX44GmYWNj44Gr57WQ5p6c44KS6L+U44GZKi9cbiAgRU9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5yZWdpc3RlcnMuYWNjIF4gdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgfSxcblxuICAvKiBhY2Pjgajjg6Hjg6Ljg6rjgpLoq5bnkIZPUua8lOeul+OBl+OBpue1kOaenOOCkkHjgbjov5TjgZkgKi9cbiAgT1JBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5yZWdpc3RlcnMuYWNjIHwgdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgosgKi9cbiAgUk9MOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XztcbiAgICBjb25zdCBtc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpID4+IDc7XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfID0gbXNiO1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsICh0aGlzLnJhbS5yZWFkKGFkZHIpIDw8IDEpIHwgY2FycnlfKTtcbiAgfSxcblxuICAvKiBhY2PjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgotcbiAgICog5a6f6KOF44KS6ICD44GI44Gm44CBYWNj44Gu5aC05ZCI44KSUk9M44Go5YiG6Zui44GX44GfXG4gICAqICovXG4gIFJMQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XztcbiAgICBjb25zdCBtc2IgPSB0aGlzLnJlZ2lzdGVycy5hY2MgPj4gNztcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBtc2I7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gKHRoaXMucmVnaXN0ZXJzLmFjYyA8PCAxKSB8IGNhcnJ5XztcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLlj7Pjgbjjg63jg7zjg4bjg7zjg4jjgZnjgosgKi9cbiAgUk9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA8PCA3O1xuICAgIGNvbnN0IGxzYiA9IHRoaXMucmFtLnJlYWQoYWRkcikgJiAweDAxO1xuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IGxzYjtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCAodGhpcy5yYW0ucmVhZChhZGRyKSA+PiAxKSB8IGNhcnJ5Xyk7XG4gIH0sXG5cbiAgLyogYWNj44KS5Y+z44G444Ot44O844OG44O844OI44GZ44KLXG4gICAqIOWun+ijheOCkuiAg+OBiOOBpmFjY+OBruWgtOWQiOOCklJPUuOBqOWIhumbouOBl+OBn1xuICAgKiAqL1xuICBSUkE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGNhcnJ5XyA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPDwgNztcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJlZ2lzdGVycy5hY2MgJiAweDAxO1xuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IGxzYjtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSAodGhpcy5yZWdpc3RlcnMuYWNjID4+IDEpIHwgY2FycnlfO1xuICB9LFxuXG4gIC8qIGFjYyArIG1lbW9yeSArIGNhcnJ5RmxhZ1xuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gb3ZlcmZsb3dfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAgIC0gY2FycnlfXG4gICAqICovXG4gIEFEQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGFkZGVkID0gdGhpcy5yZWdpc3RlcnMuYWNjICsgdGhpcy5yYW0ucmVhZChhZGRyKTtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBhZGRlZCArIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV87XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IChhZGRlZCA+IDB4ZmYpICYgMTtcbiAgfSxcblxuICAvKiAoYWNjIC0g44Oh44Oi44OqIC0g44Kt44Oj44Oq44O844OV44Op44KwKeOCkua8lOeul+OBl+OBpmFjY+OBuOi/lOOBmSAqL1xuICBTQkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBzdWJlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyAtIHRoaXMucmFtLnJlYWQoYWRkcik7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gc3ViZWQgLSB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfO1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSAoc3ViZWQgPCAweDAwKSAmIDE7XG4gIH0sXG5cbiAgLyogYWNj44KS44K544K/44OD44Kv44Gr44OX44OD44K344OlICovXG4gIFBIQTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBQ44KS44K544K/44OD44Kv44Gr44OX44OD44K344OlICovXG4gIFBIUDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolB44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMQTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolQ44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMUDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgqLjg4njg6zjgrnjgbjjgrjjg6Pjg7Pjg5fjgZnjgosgKi9cbiAgSk1QOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyO1xuICB9LFxuXG4gIC8qIOOCteODluODq+ODvOODgeODs+OCkuWRvOOBs+WHuuOBmSAqL1xuICBKU1I6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44K144OW44Or44O844OB44Oz44GL44KJ5b6p5biw44GZ44KLICovXG4gIFJUUzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDlibLjgorovrzjgb/jg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRJOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCQ0M6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJDUzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgrzjg63jg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkVROiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOODjeOCrOODhuOCo+ODluODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCTUk6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44K844Ot44OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQk5FOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXztcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkcjtcbiAgICB9XG4gIH0sXG5cbiAgLyog44ON44Ks44OG44Kj44OW44OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJQTDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgqrjg7zjg5Djg7zjg5Xjg63jg7zjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosqL1xuICBCVkM6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJWUzogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgq/jg6rjgqLjgZfjgb7jgZkgKi9cbiAgQ0xDOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIEJDROODouODvOODieOBi+OCiemAmuW4uOODouODvOODieOBq+aIu+OCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgQ0xEOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuioseWPr+OBmeOCiyAqL1xuICBDTEk6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44KS44Kv44Oq44Ki44GZ44KLICovXG4gIENMVjogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgrvjg4Pjg4jjgZnjgosgKi9cbiAgU0VDOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIEJDROODouODvOODieOBq+ioreWumuOBmeOCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgU0VEOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuemgeatouOBmeOCi1xuICAgKiDjg5Xjg6njgrBcbiAgICogaW50ZXJydXB0XyA6IDHjgavjgrvjg4Pjg4jjgZnjgotcbiAgICogKi9cbiAgU0VJOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuaW50ZXJydXB0XyA9IDE7XG4gIH0sXG5cbiAgLyog44K944OV44OI44Km44Kn44Ki5Ymy44KK6L6844G/44KS6LW344GT44GZKi9cbiAgQlJLOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOepuuOBruWRveS7pOOCkuWun+ihjOOBmeOCiyAqL1xuICBOT1A6IGZ1bmN0aW9uKCkge31cbn07XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVdGlsIHtcbiAgc3RhdGljIGRlYnVnU3RyaW5nKGluc3RydWN0aW9uLCBhZGRyZXNzaW5nLCB2YWx1ZV8pIHtcbiAgICBsZXQgcHJlZml4ID0gXCIkXCI7XG4gICAgbGV0IHBvc3RmaXggPSBcIlwiO1xuXG4gICAgaWYgKCFhZGRyZXNzaW5nKSB7XG4gICAgICBwcmVmaXggPSBcIlwiO1xuICAgIH0gZWxzZSBpZiAoYWRkcmVzc2luZy5uYW1lID09PSBcImJvdW5kIGltbWVkaWF0ZVwiKSB7XG4gICAgICBwcmVmaXggPSBcIiMkXCI7XG4gICAgfVxuXG4gICAgbGV0IHZhbHVlO1xuICAgIGlmICh2YWx1ZV8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSBcIlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlXy50b1N0cmluZygxNik7XG4gICAgfVxuXG4gICAgY29uc3QgY2hhcnMgPSBbXG4gICAgICBpbnN0cnVjdGlvbi5uYW1lLnNwbGl0KFwiIFwiKVsxXSxcbiAgICAgIFwiIFwiLFxuICAgICAgcHJlZml4LFxuICAgICAgdmFsdWUsXG4gICAgICBwb3N0Zml4XG4gICAgXS5qb2luKFwiXCIpO1xuXG4gICAgcmV0dXJuIGNoYXJzO1xuICB9XG59XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tIFwiLi4vYWRkcmVzc2luZ1wiO1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4NDAgLSAweDRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIFwiMFwiLFxuICBcIjFcIixcbiAgXCIyXCIsXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgXCI4XCIsXG4gIFwiOVwiLFxuICBcImFcIixcbiAgXCJiXCIsXG4gIC8qIDB4NGM6IEpNUCBBYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhYnNvbHV0ZSA9IEFkZHJlc3NpbmcuYWJzb2x1dGUuYmluZCh0aGlzKTtcbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGUoKTtcblxuICAgIGNvbnN0IEpNUCA9IEluc3RydWN0aW9ucy5KTVAuYmluZCh0aGlzKTtcbiAgICBKTVAoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhKTVAsIGFic29sdXRlLCBhZGRyKTtcbiAgfSxcbiAgXCJkXCIsXG4gIFwiZVwiLFxuICBcImZcIlxuXTtcbiIsIi8qIDB4NTAgLSAweDVGICovXG5leHBvcnQgZGVmYXVsdCBbXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIl07XG4iLCIvKiAweDYwIC0gMHg2RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4NzAgLSAweDdGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIFwiMFwiLFxuICBcIjFcIixcbiAgXCIyXCIsXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgLyogMHg3ODogU0VJICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFNFSSA9IEluc3RydWN0aW9ucy5TRUkuYmluZCh0aGlzKTtcblxuICAgIFNFSSgpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoU0VJKTtcbiAgfSxcbiAgXCI5XCIsXG4gIFwiYVwiLFxuICBcImJcIixcbiAgXCJjXCIsXG4gIFwiZFwiLFxuICBcImVcIixcbiAgXCJmXCJcbl07XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tIFwiLi4vYWRkcmVzc2luZ1wiO1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4ODAgLSAweDhGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIFwiMFwiLFxuICBcIjFcIixcbiAgXCIyXCIsXG4gIFwiM1wiLFxuICBcIjRcIixcbiAgXCI1XCIsXG4gIFwiNlwiLFxuICBcIjdcIixcbiAgLyogMHg4ODogREVZICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IERFWSA9IEluc3RydWN0aW9ucy5ERVkuYmluZCh0aGlzKTtcblxuICAgIERFWSgpO1xuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoREVZKTtcbiAgfSxcbiAgXCI5XCIsXG4gIFwiYVwiLFxuICBcImJcIixcbiAgXCJjXCIsXG4gIC8qIDB4OGQ6IFNUQSBBYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhYnNvbHV0ZSA9IEFkZHJlc3NpbmcuYWJzb2x1dGUuYmluZCh0aGlzKTtcblxuICAgIGNvbnN0IGFkZHIgPSBhYnNvbHV0ZSgpO1xuICAgIGNvbnN0IFNUQSA9IEluc3RydWN0aW9ucy5TVEEuYmluZCh0aGlzKTtcblxuICAgIFNUQShhZGRyKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFNUQSwgYWJzb2x1dGUsIGFkZHIpO1xuICB9LFxuICBcImVcIixcbiAgXCJmXCJcbl07XG4iLCIvL2ltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gXCIuLi9pbnN0cnVjdGlvbnNcIjtcbmltcG9ydCBVdGlsIGZyb20gXCIuL3V0aWwuanNcIjtcblxuLyogMHg5MCAtIDB4OUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgXCIwXCIsXG4gIFwiMVwiLFxuICBcIjJcIixcbiAgXCIzXCIsXG4gIFwiNFwiLFxuICBcIjVcIixcbiAgXCI2XCIsXG4gIFwiN1wiLFxuICBcIjhcIixcbiAgXCI5XCIsXG4gIC8qIDlBOiBUWFMgSW1wbGllZCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFRYUyA9IEluc3RydWN0aW9ucy5UWFMuYmluZCh0aGlzKTtcbiAgICBUWFMoKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFRYUyk7XG4gIH0sXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCJcbl07XG4iLCJpbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gXCIuLi9pbnN0cnVjdGlvbnNcIjtcbmltcG9ydCBBZGRyZXNzaW5nIGZyb20gXCIuLi9hZGRyZXNzaW5nXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4QTAgLSAweEFGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4QTA6IExEWSBJbW1lZGlhdGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBpbW1lZGlhdGUgPSBBZGRyZXNzaW5nLmltbWVkaWF0ZS5iaW5kKHRoaXMpO1xuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKTtcblxuICAgIGNvbnN0IExEWSA9IEluc3RydWN0aW9ucy5MRFkuYmluZCh0aGlzKTtcbiAgICBMRFkoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMRFksIGltbWVkaWF0ZSwgdGhpcy5yYW0ucmVhZChhZGRyKSk7XG4gIH0sXG4gIFwiMVwiLFxuICAvKiAweEEyOiBMRFggSW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGltbWVkaWF0ZSA9IEFkZHJlc3NpbmcuaW1tZWRpYXRlLmJpbmQodGhpcyk7XG4gICAgY29uc3QgYWRkciA9IGltbWVkaWF0ZSgpO1xuXG4gICAgY29uc3QgTERYID0gSW5zdHJ1Y3Rpb25zLkxEWC5iaW5kKHRoaXMpO1xuICAgIExEWChhZGRyKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKExEWCwgaW1tZWRpYXRlLCB0aGlzLnJhbS5yZWFkKGFkZHIpKTtcbiAgfSxcbiAgXCIzXCIsXG4gIFwiNFwiLFxuICBcIjVcIixcbiAgXCI2XCIsXG4gIFwiN1wiLFxuICBcIjhcIixcblxuICAvKiAweEE5OiBMREEgSW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGltbWVkaWF0ZSA9IEFkZHJlc3NpbmcuaW1tZWRpYXRlLmJpbmQodGhpcyk7XG4gICAgY29uc3QgYWRkciA9IGltbWVkaWF0ZSgpO1xuXG4gICAgY29uc3QgTERBID0gSW5zdHJ1Y3Rpb25zLkxEQS5iaW5kKHRoaXMpO1xuICAgIExEQShhZGRyKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKExEQSwgaW1tZWRpYXRlLCB0aGlzLnJhbS5yZWFkKGFkZHIpKTtcbiAgfSxcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIlxuXTtcbiIsImltcG9ydCBBZGRyZXNzaW5nIGZyb20gXCIuLi9hZGRyZXNzaW5nXCI7XG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gXCIuLi9pbnN0cnVjdGlvbnNcIjtcbmltcG9ydCBVdGlsIGZyb20gXCIuL3V0aWxcIjtcblxuLyogMHhiMCAtIDB4YkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgXCIwXCIsXG4gIFwiMVwiLFxuICBcIjJcIixcbiAgXCIzXCIsXG4gIFwiNFwiLFxuICBcIjVcIixcbiAgXCI2XCIsXG4gIFwiN1wiLFxuICBcIjhcIixcbiAgXCI5XCIsXG4gIFwiYVwiLFxuICBcImJcIixcbiAgXCJjXCIsXG4gIC8qIDB4YmQ6IExEQSBBYnNvbHV0ZW0gWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhYnNvbHV0ZVggPSBBZGRyZXNzaW5nLmFic29sdXRlWC5iaW5kKHRoaXMpO1xuICAgIGNvbnN0IGFkZHIgPSBhYnNvbHV0ZVgoKTtcblxuICAgIGNvbnN0IExEQSA9IEluc3RydWN0aW9ucy5MREEuYmluZCh0aGlzKTtcbiAgICBMREEoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMREEsIGFic29sdXRlWCwgYWRkcik7XG4gIH0sXG4gIFwiZVwiLFxuICBcImZcIlxuXTtcbiIsIi8qIDB4YzAgLSAweGNGICovXG5leHBvcnQgZGVmYXVsdCBbXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIl07XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tIFwiLi4vYWRkcmVzc2luZ1wiO1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tIFwiLi4vaW5zdHJ1Y3Rpb25zXCI7XG5pbXBvcnQgVXRpbCBmcm9tIFwiLi91dGlsXCI7XG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKTtcbiAgICBjb25zdCBhZGRyID0gcmVsYXRpdmUoKTtcblxuICAgIGNvbnN0IEJORSA9IEluc3RydWN0aW9ucy5CTkUuYmluZCh0aGlzKTtcbiAgICBCTkUoYWRkcik7XG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhCTkUsIHJlbGF0aXZlLCBhZGRyKTtcbiAgfSxcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIixcbiAgXCJcIlxuXTtcbiIsIi8vaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSBcIi4uL2luc3RydWN0aW9uc1wiO1xuaW1wb3J0IFV0aWwgZnJvbSBcIi4vdXRpbFwiO1xuXG4vKiAweGUwIC0gMHhlRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICBcIjBcIixcbiAgXCIxXCIsXG4gIFwiMlwiLFxuICBcIjNcIixcbiAgXCI0XCIsXG4gIFwiNVwiLFxuICBcIjZcIixcbiAgXCI3XCIsXG4gIC8qIDB4ZTg6IElOWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBJTlggPSBJbnN0cnVjdGlvbnMuSU5YLmJpbmQodGhpcyk7XG5cbiAgICBJTlgoKTtcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKElOWCk7XG4gIH0sXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCIsXG4gIFwiXCJcbl07XG4iLCIvKiAweGYwIC0gMHhmZiAqL1xuZXhwb3J0IGRlZmF1bHQgW1wiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCJdO1xuIiwiaW1wb3J0IHgweCBmcm9tIFwiLi8weDB4XCI7XG5pbXBvcnQgeDF4IGZyb20gXCIuLzB4MXhcIjtcbmltcG9ydCB4MnggZnJvbSBcIi4vMHgyeFwiO1xuaW1wb3J0IHgzeCBmcm9tIFwiLi8weDN4XCI7XG5pbXBvcnQgeDR4IGZyb20gXCIuLzB4NHhcIjtcbmltcG9ydCB4NXggZnJvbSBcIi4vMHg1eFwiO1xuaW1wb3J0IHg2eCBmcm9tIFwiLi8weDZ4XCI7XG5pbXBvcnQgeDd4IGZyb20gXCIuLzB4N3hcIjtcbmltcG9ydCB4OHggZnJvbSBcIi4vMHg4eFwiO1xuaW1wb3J0IHg5eCBmcm9tIFwiLi8weDl4XCI7XG5pbXBvcnQgeEF4IGZyb20gXCIuLzB4QXhcIjtcbmltcG9ydCB4QnggZnJvbSBcIi4vMHhCeFwiO1xuaW1wb3J0IHhDeCBmcm9tIFwiLi8weEN4XCI7XG5pbXBvcnQgeER4IGZyb20gXCIuLzB4RHhcIjtcbmltcG9ydCB4RXggZnJvbSBcIi4vMHhFeFwiO1xuaW1wb3J0IHhGeCBmcm9tIFwiLi8weEZ4XCI7XG5cbmNvbnN0IG9wY29kZXMgPSBbXS5jb25jYXQoXG4gIHgweCxcbiAgeDF4LFxuICB4MngsXG4gIHgzeCxcbiAgeDR4LFxuICB4NXgsXG4gIHg2eCxcbiAgeDd4LFxuICB4OHgsXG4gIHg5eCxcbiAgeEF4LFxuICB4QngsXG4gIHhDeCxcbiAgeER4LFxuICB4RXgsXG4gIHhGeFxuKTtcblxuZXhwb3J0IGRlZmF1bHQgb3Bjb2RlcztcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgaXNOb2RlanM6ICgpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIHJlcXVpcmUgIT09IFwidW5kZWZpbmVkXCJcbiAgfVxufVxuIiwiaW1wb3J0IHJlZ2lzdGVycyBmcm9tICcuL3JlZ2lzdGVycydcbmltcG9ydCBSYW0gZnJvbSAnLi9yYW0nXG5pbXBvcnQgb3Bjb2RlcyBmcm9tICcuL29wY29kZXMnXG5pbXBvcnQgVXRpbCBmcm9tICcuLi91dGlsJ1xuXG4vKiA2NTAyIENQVSAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ3B1IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5pbml0KClcbiAgfVxuXG4gIGluaXQoKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMgPSByZWdpc3RlcnNcbiAgICB0aGlzLm9wY29kZXMgPSBvcGNvZGVzXG4gICAgLy90aGlzLm9wY29kZXMgPSBvcGNvZGVzLm1hcChvcGNvZGUgPT4gb3Bjb2RlLmJpbmQodGhpcykpIC8vIOWRveS7pOS4gOimp1xuXG4gICAgdGhpcy5yYW0gPSBuZXcgUmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgdGhpcy5yYW0uY29ubmVjdChwYXJ0cylcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaW5pdCgpXG4gIH1cblxuICBydW4oaXNEZWJ1Zykge1xuICAgIGNvbnN0IGV4ZWN1dGUgPSBpc0RlYnVnID8gdGhpcy5kZWJ1Zy5iaW5kKHRoaXMpIDogdGhpcy5ldmFsLmJpbmQodGhpcylcblxuICAgIFV0aWwuaXNOb2RlanMoKSA/IHNldEludGVydmFsKGV4ZWN1dGUsIDEwMCkgOiBleGVjdXRlKClcbiAgfVxuXG4gIC8vIOWRveS7pOOCkuWHpueQhuOBmeOCi1xuICBldmFsKCkge1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgLy9jb25zdCBvcGNvZGUgPSB0aGlzLm1lbW9yeVtpXVxuICAgIGNvbnN0IG9wY29kZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcblxuICAgIHRoaXMub3Bjb2Rlc1tvcGNvZGVdLmNhbGwoKVxuXG4gICAgY29uc3QgZm4gPSB0aGlzLmV2YWwuYmluZCh0aGlzKVxuXG4gICAgaWYoIVV0aWwuaXNOb2RlanMoKSkgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShmbilcbiAgfVxuXG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgZGVidWcoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICAvL2NvbnN0IG9wY29kZSA9IHRoaXMubWVtb3J5W2ldXG4gICAgY29uc3Qgb3Bjb2RlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wY29kZXNbb3Bjb2RlXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY29uc29sZS5lcnJvcignTm90IGltcGxlbWVudGVkOiAnICsgb3Bjb2RlLnRvU3RyaW5nKDE2KSlcbiAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5vcGNvZGVzW29wY29kZV0pXG4gICAgfVxuXG4gICAgY29uc3QgZGVidWdTdHJpbmcgPSB0aGlzLm9wY29kZXNbb3Bjb2RlXS5iaW5kKHRoaXMpLmNhbGwoKVxuICAgIGNvbnNvbGUubG9nKGRlYnVnU3RyaW5nKVxuXG4gICAgY29uc3QgZm4gPSB0aGlzLmRlYnVnLmJpbmQodGhpcylcblxuICAgIGlmKCFVdGlsLmlzTm9kZWpzKCkpIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZm4pXG4gIH1cblxuICAvKiAweDgwMDB+44Gu44Oh44Oi44Oq44GrUk9N5YaF44GuUFJHLVJPTeOCkuiqreOBv+i+vOOCgCovXG4gIHNldCBwcmdSb20ocHJnUm9tKSB7XG4gICAgY29uc3Qgc3RhcnRBZGRyID0gMHg4MDAwXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZ1JvbS5sZW5ndGg7IGkrKykge1xuICAgICAgLy90aGlzLm1lbW9yeVtzdGFydEFkZHIraV0gPSBwcmdSb21baV1cbiAgICAgIHRoaXMucmFtLndyaXRlKHN0YXJ0QWRkciArIGksIHByZ1JvbVtpXSlcbiAgICB9XG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFZyYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4NDAwMClcbiAgICB0aGlzLnZwID0gbnVsbFxuICB9XG5cbiAgY29ubmVjdChwcHUpIHtcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ID0gcHB1LnJlZnJlc2hEaXNwbGF5LmJpbmQocHB1KVxuICB9XG5cbiAgd3JpdGVGcm9tQnVzKHZhbHVlKSB7XG4gICAgLy9jb25zb2xlLmxvZygndnJhbVskJyArIHRoaXMudnAudG9TdHJpbmcoMTYpICsgJ10gPSAnICsgU3RyaW5nLmZyb21DaGFyQ29kZSh2YWx1ZSkpXG4gICAgdGhpcy5tZW1vcnlbdGhpcy52cF0gPSB2YWx1ZVxuICAgIHRoaXMudnArK1xuICAgIHRoaXMucmVmcmVzaERpc3BsYXkgJiYgdGhpcy5yZWZyZXNoRGlzcGxheSgpXG4gIH1cblxuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIHRoaXMubWVtb3J5W2FkZHJdID0gdmFsdWVcbiAgfVxuXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCJpbXBvcnQgVnJhbSBmcm9tICcuL3ZyYW0nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBwdSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdCgpXG4gIH1cblxuICBpbml0KCkge1xuICAgIC8qIEFib3V0IFZSQU1cbiAgICAgKiAweDAwMDAgLSAweDBmZmYgOiBQYXR0ZXJuIHRhYmxlIDBcbiAgICAgKiAweDEwMDAgLSAweDFmZmYgOiBQYXR0ZXJuIHRhYmxlIDFcbiAgICAgKiAweDIwMDAgLSAweDIzYmYgOiBOYW1lIHRhYmxlIDBcbiAgICAgKiAweDIzYzAgLSAweDIzZmYgOiBBdHRyaWJ1dGUgdGFibGUgMFxuICAgICAqIDB4MjQwMCAtIDB4MjdiZiA6IE5hbWUgdGFibGUgMVxuICAgICAqIDB4MmJjMCAtIDB4MmJiZiA6IEF0dHJpYnV0ZSB0YWJsZSAxXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAyXG4gICAgICogMHgyYmMwIC0gMHgyYmZmIDogQXR0cmlidXRlIHRhYmxlIDJcbiAgICAgKiAweDJjMDAgLSAweDJmYmYgOiBOYW1lIHRhYmxlIDNcbiAgICAgKiAweDJmYzAgLSAweDJmZmYgOiBBdHRyaWJ1dGUgdGFibGUgM1xuICAgICAqIDB4MzAwMCAtIDB4M2VmZiA6IE1pcnJvciBvZiAweDIwMDAgLSAweDJmZmZcbiAgICAgKiAweDNmMDAgLSAweDNmMGYgOiBCYWNrZ3JvdW5kIHBhbGV0dGVcbiAgICAgKiAweDNmMTAgLSAweDNmMWYgOiBTcHJpdGUgcGFsZXR0ZVxuICAgICAqIDB4M2YyMCAtIDB4M2ZmZiA6IE1pcnJvciBvZiAweDNmMDAgMCAweDNmMWZcbiAgICAgKiAqL1xuICAgIHRoaXMudnJhbSA9IG5ldyBWcmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBpZiAocGFydHMuYnVzKSB7XG4gICAgICBwYXJ0cy5idXMuY29ubmVjdCh7IHZyYW06IHRoaXMudnJhbSB9KVxuICAgIH1cblxuICAgIGlmIChwYXJ0cy5yZW5kZXJlcikge1xuICAgICAgdGhpcy5yZW5kZXJlciA9IHBhcnRzLnJlbmRlcmVyXG4gICAgICB0aGlzLnZyYW0uY29ubmVjdCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIC8qICQyMDAwIC0gJDIzQkbjga7jg43jg7zjg6Djg4bjg7zjg5bjg6vjgpLmm7TmlrDjgZnjgosgKi9cbiAgcmVmcmVzaERpc3BsYXkoKSB7XG4gICAgLyog44K/44Kk44OrKDh4OCnjgpIzMiozMOWAiyAqL1xuICAgIGZvciAobGV0IGkgPSAweDIwMDA7IGkgPD0gMHgyM2JmOyBpKyspIHtcbiAgICAgIGNvbnN0IHRpbGVJZCA9IHRoaXMudnJhbS5yZWFkKGkpXG4gICAgICAvKiDjgr/jgqTjg6vjgpLmjIflrpogKi9cbiAgICAgIGNvbnN0IHRpbGUgPSB0aGlzLnRpbGVzW3RpbGVJZF1cbiAgICAgIC8qIOOCv+OCpOODq+OBjOS9v+eUqOOBmeOCi+ODkeODrOODg+ODiOOCkuWPluW+lyAqL1xuICAgICAgY29uc3QgcGFsZXR0ZUlkID0gdGhpcy5zZWxlY3RQYWxldHRlKHRpbGVJZClcbiAgICAgIGNvbnN0IHBhbGV0dGUgPSB0aGlzLnNlbGVjdEJhY2tncm91bmRQYWxldHRlcyhwYWxldHRlSWQpXG5cbiAgICAgIC8qIOOCv+OCpOODq+OBqOODkeODrOODg+ODiOOCklJlbmRlcmVy44Gr5rih44GZICovXG4gICAgICB0aGlzLnJlbmRlcmVyLndyaXRlKHRpbGUsIHBhbGV0dGUpXG4gICAgfVxuICB9XG5cbiAgLyogMHgwMDAwIC0gMHgxZmZm44Gu44Oh44Oi44Oq44GrQ0hSLVJPTeOCkuiqreOBv+i+vOOCgCAqL1xuICBzZXQgY2hyUm9tKGNoclJvbSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hyUm9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnZyYW0ud3JpdGUoaSwgY2hyUm9tW2ldKVxuICAgIH1cblxuICAgIC8qIENIUumgmOWfn+OBi+OCieOCv+OCpOODq+OCkuaKveWHuuOBl+OBpuOBiuOBjyAqL1xuICAgIHRoaXMuZXh0cmFjdFRpbGVzKClcbiAgfVxuXG4gIC8vIDh4OOOBruOCv+OCpOODq+OCkuOBmeOBueOBpnZyYW3jga5DSFLjgYvjgonmir3lh7rjgZfjgabjgYrjgY9cbiAgZXh0cmFjdFRpbGVzKCkge1xuICAgIHRoaXMudGlsZXMgPSBbXVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMHgxZmZmOyApIHtcbiAgICAgIC8vIOOCv+OCpOODq+OBruS4i+S9jeODk+ODg+ODiFxuICAgICAgY29uc3QgbG93ZXJCaXRMaW5lcyA9IFtdXG4gICAgICBmb3IgKGxldCBoID0gMDsgaCA8IDg7IGgrKykge1xuICAgICAgICBsZXQgYnl0ZSA9IHRoaXMudnJhbS5yZWFkKGkrKylcbiAgICAgICAgY29uc3QgbGluZSA9IFtdXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0KVxuICAgICAgICAgIGJ5dGUgPSBieXRlID4+IDFcbiAgICAgICAgfVxuXG4gICAgICAgIGxvd2VyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIrkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGhpZ2hlckJpdExpbmVzID0gW11cbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGxldCBieXRlID0gdGhpcy52cmFtLnJlYWQoaSsrKVxuICAgICAgICBjb25zdCBsaW5lID0gW11cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgICAgICBjb25zdCBiaXQgPSBieXRlICYgMHgwMVxuICAgICAgICAgIGxpbmUudW5zaGlmdChiaXQgPDwgMSlcbiAgICAgICAgICBieXRlID0gYnl0ZSA+PiAxXG4gICAgICAgIH1cblxuICAgICAgICBoaWdoZXJCaXRMaW5lcy5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIC8vIOS4iuS9jeODk+ODg+ODiOOBqOS4i+S9jeODk+ODg+ODiOOCkuWQiOaIkOOBmeOCi1xuICAgICAgY29uc3QgcGVyZmVjdEJpdHMgPSBbXVxuICAgICAgZm9yIChsZXQgaCA9IDA7IGggPCA4OyBoKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgICAgICBjb25zdCBwZXJmZWN0Qml0ID0gbG93ZXJCaXRMaW5lc1toXVtqXSB8IGhpZ2hlckJpdExpbmVzW2hdW2pdXG4gICAgICAgICAgcGVyZmVjdEJpdHMucHVzaChwZXJmZWN0Qml0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnRpbGVzLnB1c2gocGVyZmVjdEJpdHMpXG4gICAgfVxuICB9XG5cbiAgLyog5bGe5oCn44OG44O844OW44Or44GL44KJ6Kmy5b2T44OR44Os44OD44OI44Gu55Wq5Y+344KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdFBhbGV0dGUobikge1xuICAgIGNvbnN0IGJsb2NrUG9zaXRpb24gPSAoKG4gLSAobiAlIDY0KSkgLyA2NCkgKiA4ICsgKChuICUgNjQpIC0gKG4gJSA0KSkgLyA0XG4gICAgY29uc3QgYml0UG9zaXRpb24gPSBuICUgNFxuICAgIGNvbnN0IHN0YXJ0ID0gMHgyM2MwXG5cbiAgICBjb25zdCBibG9jayA9IHRoaXMudnJhbS5yZWFkKHN0YXJ0ICsgYmxvY2tQb3NpdGlvbilcbiAgICBjb25zdCBiaXQgPSAoYmxvY2sgPj4gYml0UG9zaXRpb24pICYgMHgwM1xuXG4gICAgcmV0dXJuIGJpdFxuICB9XG5cbiAgLyogJDNGMDAtJDNGMEbjgYvjgonjg5Djg4Pjgq/jgrDjg6njgqbjg7Pjg4ko6IOM5pmvKeODkeODrOODg+ODiOOCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RCYWNrZ3JvdW5kUGFsZXR0ZXMobnVtYmVyKSB7XG4gICAgY29uc3QgcGFsZXR0ZSA9IFtdXG5cbiAgICBjb25zdCBzdGFydCA9IDB4M2YwMCArIG51bWJlciAqIDRcbiAgICBjb25zdCBlbmQgPSAweDNmMDAgKyBudW1iZXIgKiA0ICsgNFxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxuXG4gIC8qICQzRjEwLSQzRjFG44GL44KJ44K544OX44Op44Kk44OI44OR44Os44OD44OI44KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdFNwcml0ZVBhbGV0dHMobnVtYmVyKSB7XG4gICAgY29uc3QgcGFsZXR0ZSA9IFtdXG5cbiAgICBjb25zdCBzdGFydCA9IDB4M2YxMCArIG51bWJlciAqIDRcbiAgICBjb25zdCBlbmQgPSAweDNmMTAgKyBudW1iZXIgKiA0ICsgNFxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnVzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5idWZmZXIgPSB7fVxuICAgIHRoaXMudnJhbUFkZHJfID0gW11cbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy52cmFtICYmICh0aGlzLnZyYW0gPSBwYXJ0cy52cmFtKVxuICB9XG5cbiAgLyogQ1BV5YG044GL44KJ44Gu44G/44GX44GL6ICD5oWu44GX44Gm44Gq44GEICovXG4gIHdyaXRlKGFkZHIsIHZhbHVlKSB7XG4gICAgc3dpdGNoIChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgdGhpcy52cmFtQWRkciA9IHZhbHVlXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDB4MjAwNzpcbiAgICAgICAgdGhpcy52cmFtLndyaXRlRnJvbUJ1cyh2YWx1ZSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuYnVmZmVyW2FkZHJdID0gdmFsdWVcbiAgICB9XG4gIH1cblxuICByZWFkKGFkZHIpIHtcbiAgICBzd2l0Y2ggKGFkZHIpIHtcbiAgICAgIGNhc2UgMHgyMDA2OlxuICAgICAgICByZXR1cm4gdGhpcy52cmFtQWRkclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVzIG9mIHRoaXMgYWRkciBpcyBOb3QgaW1wbGVtZW50ZWQnKVxuICAgIH1cbiAgfVxuXG4gIHNldCB2cmFtQWRkcihhZGRyKSB7XG4gICAgaWYgKHRoaXMudnJhbUFkZHJfLmxlbmd0aCA8IDEpIHtcbiAgICAgIHRoaXMudnJhbUFkZHJfLnB1c2goYWRkcilcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKVxuICAgICAgdGhpcy52cmFtLnZwID0gdGhpcy52cmFtQWRkclxuICAgICAgdGhpcy52cmFtQWRkcl8ubGVuZ3RoID0gMFxuICAgIH1cbiAgfVxuXG4gIGdldCB2cmFtQWRkcigpIHtcbiAgICByZXR1cm4gKHRoaXMudnJhbUFkZHJfWzBdIDw8IDgpICsgdGhpcy52cmFtQWRkcl9bMV1cbiAgfVxufVxuIiwiaW1wb3J0IENwdSBmcm9tICcuL2NwdSdcbmltcG9ydCBQcHUgZnJvbSAnLi9wcHUnXG5pbXBvcnQgQnVzIGZyb20gJy4vYnVzJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBOZXMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNwdSA9IG5ldyBDcHUoKVxuICAgIHRoaXMucHB1ID0gbmV3IFBwdSgpXG4gICAgdGhpcy5idXMgPSBuZXcgQnVzKClcbiAgICB0aGlzLnBwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICAgIHRoaXMuY3B1LmNvbm5lY3QoeyBidXM6IHRoaXMuYnVzIH0pXG4gIH1cblxuICBjb25uZWN0KHJlbmRlcmVyKSB7XG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IHJlbmRlcmVyIH0pXG4gIH1cblxuICBnZXQgcm9tKCkge1xuICAgIHJldHVybiB0aGlzLl9yb21cbiAgfVxuXG4gIHNldCByb20ocm9tKSB7XG4gICAgdGhpcy5fcm9tID0gcm9tXG4gIH1cblxuICBydW4oaXNEZWJ1Zykge1xuICAgIHRoaXMuY3B1LnByZ1JvbSA9IHRoaXMucm9tLnByZ1JvbVxuICAgIHRoaXMucHB1LmNoclJvbSA9IHRoaXMucm9tLmNoclJvbVxuXG4gICAgdGhpcy5jcHUucnVuKGlzRGVidWcpXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvbSB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmNoZWNrKGRhdGEpXG4gICAgdGhpcy5kYXRhID0gZGF0YVxuICB9XG5cbiAgY2hlY2soZGF0YSkge1xuICAgIGlmICghdGhpcy5pc05lc1JvbShkYXRhKSkgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGlzIG5vdCBORVMgUk9NLicpXG4gIH1cblxuICBnZXQgTkVTX1JPTV9IRUFERVJfU0laRSgpIHtcbiAgICByZXR1cm4gMHgxMFxuICB9XG5cbiAgZ2V0IFNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5ORVNfUk9NX0hFQURFUl9TSVpFICsgdGhpcy5TSVpFX09GX1BSR19ST01cbiAgfVxuXG4gIGdldCBFTkRfQUREUkVTU19PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSArIHRoaXMuU0laRV9PRl9DSFJfUk9NXG4gIH1cblxuICAvKiBQUkcgUk9N44Gu44K144Kk44K644KS5Y+W5b6X44GZ44KLXG4gICAqKiBST03jg5jjg4Pjg4Djga4x44GL44KJ5pWw44GI44GmNUJ5dGXnm67jga7lgKTjgasxNktpKOOCreODkynjgpLjgYvjgZHjgZ/jgrXjgqTjgrogKi9cbiAgZ2V0IFNJWkVfT0ZfUFJHX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhWzRdICogMHg0MDAwXG4gIH1cblxuICAvKiBQUkcgUk9N44Gr5ZCM44GYKi9cbiAgZ2V0IFNJWkVfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhWzVdICogMHgyMDAwXG4gIH1cblxuICAvKiBST03jgYvjgolwcmdST03jgavoqbLlvZPjgZnjgovjgajjgZPjgo3jgpLliIfjgorlh7rjgZlcbiAgICoqIHByZ1JPTeOBr+ODmOODg+ODgOmgmOWfn+OBruasoeOBrkJ5dGXjgYvjgonlp4vjgb7jgosgKi9cbiAgZ2V0IHByZ1JvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKFxuICAgICAgdGhpcy5ORVNfUk9NX0hFQURFUl9TSVpFLFxuICAgICAgdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00gLSAxXG4gICAgKVxuICB9XG5cbiAgLyogUk9N44GL44KJY2hyUk9N44Gr6Kmy5b2T44GZ44KL44Go44GT44KN44KS5YiH44KK5Ye644GZXG4gICAqKiBjaHJSb23jga9wcmdSb23jga7lvozjgYvjgonlp4vjgb7jgosgKi9cbiAgZ2V0IGNoclJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKFxuICAgICAgdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00sXG4gICAgICB0aGlzLkVORF9BRERSRVNTX09GX0NIUl9ST00gLSAxXG4gICAgKVxuICB9XG5cbiAgLyog44OH44O844K/44Gu44OY44OD44OA44GrJ05FUyfjgYzjgYLjgovjgYvjganjgYbjgYvjgadORVPjga5ST03jgYvliKTliKXjgZnjgosgKi9cbiAgaXNOZXNSb20oZGF0YSkge1xuICAgIGNvbnN0IGhlYWRlciA9IGRhdGEuc2xpY2UoMCwgMylcbiAgICBjb25zdCBoZWFkZXJTdHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGhlYWRlcilcblxuICAgIHJldHVybiBoZWFkZXJTdHIgPT09ICdORVMnXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IFtcbiAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICBbMHgyNywgMHgxYiwgMHg4Zl0sXG4gIFsweDAwLCAweDAwLCAweGFiXSxcbiAgWzB4NDcsIDB4MDAsIDB4OWZdLFxuICBbMHg4ZiwgMHgwMCwgMHg3N10sXG4gIFsweGFiLCAweDAwLCAweDEzXSxcbiAgWzB4YTcsIDB4MDAsIDB4MDBdLFxuICBbMHg3ZiwgMHgwYiwgMHgwMF0sXG4gIFsweDQzLCAweDJmLCAweDAwXSxcbiAgWzB4MDAsIDB4NDcsIDB4MDBdLFxuICBbMHgwMCwgMHg1MSwgMHgwMF0sXG4gIFsweDAwLCAweDNmLCAweDE3XSxcbiAgWzB4MWIsIDB4M2YsIDB4NWZdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHhiYywgMHhiYywgMHhiY10sXG4gIFsweDAwLCAweDczLCAweGVmXSxcbiAgWzB4MjMsIDB4M2IsIDB4ZWZdLFxuICBbMHg4MywgMHgwMCwgMHhmM10sXG4gIFsweGJmLCAweDAwLCAweGJmXSxcbiAgWzB4ZTcsIDB4MDAsIDB4NWJdLFxuICBbMHhkYiwgMHgyYiwgMHgwMF0sXG4gIFsweGNiLCAweDRmLCAweDBmXSxcbiAgWzB4OGIsIDB4NzMsIDB4MDBdLFxuICBbMHgwMCwgMHg5NywgMHgwMF0sXG4gIFsweDAwLCAweGFiLCAweDAwXSxcbiAgWzB4MDAsIDB4OTMsIDB4M2JdLFxuICBbMHgwMCwgMHg4MywgMHg4Yl0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweGZmLCAweGZmLCAweGZmXSxcbiAgWzB4M2YsIDB4YmYsIDB4ZmZdLFxuICBbMHg1ZiwgMHg3MywgMHhmZl0sXG4gIFsweGE3LCAweDhiLCAweGZkXSxcbiAgWzB4ZjcsIDB4N2IsIDB4ZmZdLFxuICBbMHhmZiwgMHg3NywgMHhiN10sXG4gIFsweGZmLCAweDc3LCAweDYzXSxcbiAgWzB4ZmYsIDB4OWIsIDB4M2JdLFxuICBbMHhmMywgMHhiZiwgMHgzZl0sXG4gIFsweDgzLCAweGQzLCAweDEzXSxcbiAgWzB4NGYsIDB4ZGYsIDB4NGJdLFxuICBbMHg1OCwgMHhmOCwgMHg5OF0sXG4gIFsweDAwLCAweGViLCAweGRiXSxcbiAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4ZmYsIDB4ZmYsIDB4ZmZdLFxuICBbMHhhYiwgMHhlNywgMHhmZl0sXG4gIFsweGM3LCAweGQ3LCAweGZmXSxcbiAgWzB4ZDcsIDB4Y2IsIDB4ZmZdLFxuICBbMHhmZiwgMHhjNywgMHhmZl0sXG4gIFsweGZmLCAweGM3LCAweGRiXSxcbiAgWzB4ZmYsIDB4YmYsIDB4YjNdLFxuICBbMHhmZiwgMHhkYiwgMHhhYl0sXG4gIFsweGZmLCAweGU3LCAweGEzXSxcbiAgWzB4ZTMsIDB4ZmYsIDB4YTNdLFxuICBbMHhhYiwgMHhmMywgMHhiZl0sXG4gIFsweGIzLCAweGZmLCAweGNmXSxcbiAgWzB4OWYsIDB4ZmYsIDB4ZjNdLFxuICBbMHhiYywgMHhiYywgMHhiY10sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdXG5dXG4iLCJpbXBvcnQgY29sb3JzIGZyb20gJy4vY29sb3JzJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSZW5kZXJlciB7XG4gIGNvbnN0cnVjdG9yKGlkKSB7XG4gICAgaWYoIWlkKSB0aHJvdyBuZXcgRXJyb3IoJ0lkIG9mIGNhbnZhcyB0YWcgaXNuXFwndCBzcGVjaWZpZWQuJylcblxuICAgIGxldCBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZClcbiAgICB0aGlzLmNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIHRoaXMucG9pbnRlciA9IDBcbiAgICB0aGlzLndpZHRoID0gMzJcbiAgICB0aGlzLmhlaWdodCA9IDMwXG4gIH1cblxuICB3cml0ZSh0aWxlLCBwYWxldHRlKSB7XG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmdlbmVyYXRlVGlsZUltYWdlKHRpbGUsIHBhbGV0dGUpXG4gICAgY29uc3QgeCA9ICh0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSAqIDhcbiAgICBjb25zdCB5ID0gKCh0aGlzLnBvaW50ZXIgLSAodGhpcy5wb2ludGVyICUgdGhpcy53aWR0aCkpIC8gdGhpcy53aWR0aCkgKiA4XG5cbiAgICBpZiAodGhpcy5wb2ludGVyIDwgdGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0IC0gMSkge1xuICAgICAgdGhpcy5wb2ludGVyKytcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wb2ludGVyID0gMFxuICAgIH1cblxuICAgIHRoaXMuY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2UsIHgsIHkpXG4gIH1cblxuICBnZW5lcmF0ZVRpbGVJbWFnZSh0aWxlLCBwYWxldHRlKSB7XG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlSW1hZ2VEYXRhKDgsIDgpXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY0OyBpKyspIHtcbiAgICAgIGNvbnN0IGJpdCA9IHRpbGVbaV1cbiAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5jb2xvcihwYWxldHRlW2JpdF0pXG5cbiAgICAgIGltYWdlLmRhdGFbaSAqIDRdID0gY29sb3JbMF1cbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAxXSA9IGNvbG9yWzFdXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgMl0gPSBjb2xvclsyXVxuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDNdID0gMjU1IC8vIOmAj+aYjuW6plxuICAgIH1cblxuICAgIHJldHVybiBpbWFnZVxuICB9XG5cbiAgY29sb3IoY29sb3JJZCkge1xuICAgIHJldHVybiBjb2xvcnNbY29sb3JJZF1cbiAgfVxufVxuIiwiaW1wb3J0IE5lc18gZnJvbSBcIi4vbmVzXCI7XG5pbXBvcnQgUm9tXyBmcm9tIFwiLi9yb21cIjtcbmltcG9ydCBSZW5kZXJlcl8gZnJvbSBcIi4vcmVuZGVyZXJcIjtcblxuZXhwb3J0IGNvbnN0IE5lcyA9IE5lc187XG5leHBvcnQgY29uc3QgUm9tID0gUm9tXztcbmV4cG9ydCBjb25zdCBSZW5kZXJlciA9IFJlbmRlcmVyXztcbiJdLCJuYW1lcyI6WyJVdGlsIiwiTmVzIiwiTmVzXyIsIlJvbSIsIlJvbV8iLCJSZW5kZXJlciIsIlJlbmRlcmVyXyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0JBQWU7RUFDZixFQUFFLEdBQUcsRUFBRSxJQUFJO0VBQ1gsRUFBRSxNQUFNLEVBQUUsSUFBSTtFQUNkLEVBQUUsTUFBTSxFQUFFLElBQUk7RUFDZCxFQUFFLEVBQUUsRUFBRSxNQUFNO0VBQ1osRUFBRSxNQUFNLEVBQUU7RUFDVjtFQUNBLElBQUksU0FBUyxFQUFFLENBQUM7RUFDaEIsSUFBSSxTQUFTLEVBQUUsQ0FBQztFQUNoQixJQUFJLFNBQVMsRUFBRSxDQUFDO0VBQ2hCLElBQUksTUFBTSxFQUFFLENBQUM7RUFDYixJQUFJLFFBQVEsRUFBRSxDQUFDO0VBQ2YsSUFBSSxVQUFVLEVBQUUsQ0FBQztFQUNqQixJQUFJLEtBQUssRUFBRSxDQUFDO0VBQ1osSUFBSSxNQUFNLEVBQUUsQ0FBQztFQUNiLEdBQUc7RUFDSCxFQUFFLEVBQUUsRUFBRSxNQUFNO0VBQ1osQ0FBQzs7RUNqQmMsTUFBTSxHQUFHLENBQUM7RUFDekIsRUFBRSxXQUFXLEdBQUc7RUFDaEIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBQztFQUN6QyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUNqQixJQUFJLEtBQUssQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFDO0VBQ3ZDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0VBQ3JCLElB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QUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUN0QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztFQUMvQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRztFQUNIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUN0QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztFQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0VBQ2xDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDN0MsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQ2hELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztFQUNoRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7RUFDbEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0VBQ2xDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztFQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7RUFDeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUM7RUFDL0IsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ3hDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztFQUMvQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztFQUMvQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztFQUN2QyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ2hDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0VBQ3ZDLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxPQUFPLElBQUksQ0FBQztFQUNoQixHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksT0FBTyxJQUFJLENBQUM7RUFDaEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ2xELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUNsRCxJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7RUFDNUIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO0VBQzVCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7RUFDeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3JELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztFQUM1QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ3hDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNyRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7RUFDNUIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDbEUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDbEUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQ2hELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztFQUV6QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7RUFDdkMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLENBQUM7RUFDOUQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQ2hELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDOztFQUV4QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUM7RUFDNUQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztFQUNyRCxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQzs7RUFFM0MsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0VBQ3ZDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0VBQzlELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7RUFDckQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUM7O0VBRTFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQztFQUM1RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDOUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUN0RCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDOUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUN0RCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO0VBQzdCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQzs7RUFFdEQsSUFBSSxJQUFJLFlBQVksRUFBRTtFQUN0QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztFQUMvQixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO0VBQ3pDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVB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O0VBQ0EsRUFBRSxLQUFLLEdBQUc7RUFDVixJQUFJLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3BDO0VBQ0EsSUFBSSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7O0VBRXRDLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssVUFBVSxFQUFFO0VBQ3BELE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFDO0VBQzlELE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFDO0VBQ3pDLEtBQUs7O0VBRUwsSUFBSSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUU7RUFDOUQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBQzs7RUFFNUIsSUFBSSxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7O0VBRXBDLElBQUksR0FBRyxDQUFDQSxNQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsRUFBQztFQUN6RCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7RUFDckIsSUFBSSxNQUFNLFNBQVMsR0FBRyxPQUFNOztFQUU1QixJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQzVDO0VBQ0EsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxD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QUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFB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
