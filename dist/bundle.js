(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.NesPack = {})));
}(this, (function (exports) { 'use strict';

  class Register {
    constructor() {
      this.acc_ = 0x00; // アキュムレータ：汎用演算
      this.indexX_ = 0x00; // アドレッシング、カウンタ等に用いる
      this.indexY_ = 0x00; // 上に同じ
      this.sp_ =  0x01fd; // スタックポインタ $0100-$01FF, 初期値は0x01fdっぽい
      this.status_ = 0x34;
      /*
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
      }
      */
      this.pc = 0x8000; // プログラムカウンタ
    }

    get statusAllRawBits() {
      return this.status_
    }

    get acc() {
      return this.acc_
    }

    set acc(value) {
      this.acc_ = value;
    }

    get indexX() {
      return this.indexX_
    }

    set indexX(value) {
      this.indexX_ = value;
    }

    get sp() {
      return this.sp_
    }

    set sp(value) {
      this.sp_ = value;
    }

    get statusNegative() {
      return this.status_ >> 7
    }

    set statusNegative(bit) {
      this.status_ = this.status_ | bit << 7;
    }

    get statusOverflow() {
      return this.status_ >> 6 & 0x01
    }

    set statusOverflow(bit) {
      this.status_ = this.status_ | bit << 6;
    }

    get statusReserved() {
      return this.status_ >> 5 & 0x01
    }

    set statusReserved(bit) {
      this.status_ = this.status_ | bit << 5;
    }

    get statusBreak() {
      return this.status_ >> 4 & 0x01
    }

    set statusBreak(bit) {
      this.status_ = this.status_ | bit << 4;
    }

    get statusDecimal() {
      return this.status_ >> 3 & 0x01
    }

    set statusDecimal(bit) {
      this.status_ = this.status_ | bit << 3;
    }

    get statusInterrupt() {
      return this.status_ >> 2 & 0x01
    }

    set statusInterrupt(bit) {
      this.status_ = this.status_ | bit << 2;
    }

    get statusZero() {
      return this.status_ >> 1 & 0x01
    }

    set statusZero(bit) {
      this.status_ = this.status_ | bit << 1;
    }

    get statusCarry() {
      return this.status_ & 0x01
    }

    set statusCarry(bit) {
      this.status_ = this.status_ | bit;
    }
  }

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

  class Util {
    static isNegative(value) {
      return value >> 7
    }

    static isZero(value) {
      return (value === 0x00) & 1
    }

    static msb(value) {
      return value >> 7
    }

    static lsb(value) {
      return value & 0x01
    }
  }

  var Instructions = {
    /* LD* (Load memory[addr) to * register)
     * フラグ
     *   - negative : 計算結果が負の値のとき1そうでなければ0(accの7bit目と同じ値になる)
     *   - zero : 計算結果がゼロのとき1そうでなければ0
     * */
    LDA: function(addr) {
      const value = this.ram.read(addr);
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },
    /* レジスタindexXにdataをロードする */
    LDX: function(addr) {
      const value = this.ram.read(addr);
      this.registers.indexX = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    LDY: function(addr) {
      const value = this.ram.read(addr);
      this.registers.indexY = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
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
     *   - negative
     *   - zero
     * */
    TAX: function() {
      const value = this.registers.acc;
      this.registers.indexX = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    TAY: function() {
      const value = this.registers.acc;
      this.registers.indexY = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    TSX: function() {
      const value = this.registers.sp;
      this.registers.indexX = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    TXA: function() {
      const value = this.registers.indexX;
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    TXS: function() {
      const value = this.registers.indexX;
      this.registers.sp = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    TYA: function() {
      const value = this.registers.indexY;
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* acc & memory[addr)
     * フラグ
     *   - negative
     *   - zero
     * */
    AND: function(addr) {
      const value = this.registers.acc & this.ram.read(addr);
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Aまたはメモリを左へシフト
     * フラグ
     *   - negative
     *   - zero
     *   - carry
     * */
    ASL: function(addr) {
      const value = this.ram.read(addr);
      const msb = Util.msb(value);
      this.ram.write(addr, value << 1);
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
      this.registers.statusCarry = msb;
    },

    /* accまたはメモリを右へシフト
     * フラグ
     *   - negative
     *   - zero
     *   - carry
     * */
    LSR: function(addr) {
      const value = this.ram.read(addr);
      const lsb = Util.lsb(value);
      this.ram.write(addr, value >> 1);
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
      this.registers.statusCarry = lsb;
    },

    /* AとメモリをAND演算してフラグを操作する
     * 演算結果は捨てる
     * */
    BIT: function(addr) {
      const memory = this.ram.read(addr);

      this.registers.statusZero = (this.registers.acc & memory);
      this.registers.statusNegative = memory >> 7;
      this.registers.statusOverflow = memory >> 6 & 0x01;
    },

    /* Aとメモリを比較演算してフラグを操作
     * 演算結果は捨てる
     * A == mem -> Z = 0
     * A >= mem -> C = 1
     * A <= mem -> C = 0
     * */
    CMP: function(addr) {
      const result = this.registers.acc - this.ram.read(addr);

      if(result === 0) {
        this.registers.statusZero = 1;
      } else {
        this.registers.statusZero = 0;
        if(result > 0) {
          this.registers.statusCarry = 1;
        } else {
          this.registers.statusCarry = 0;
        }
      }
    },

    /* Xとメモリを比較演算 */
    CPX: function() {},

    /* Yとメモリを比較演算*/
    CPY: function() {},

    /* *をインクリメントする
     * フラグ
     *   - negative
     *   - zero
     * */
    /* メモリをインクリメントする*/
    INC: function(addr) {
      this.ram.write(addr, this.ram.read(addr) + 1);
      const value = this.ram.read(addr);
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* メモリをデクリメント */
    DEC: function(addr) {
      this.ram.write(addr, this.ram.read(addr) - 1);
      const value = this.ram.read(addr);
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Xをインクリメントする */
    INX: function() {
      this.registers.indexX++;
        const value = this.registers.indexX;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Yをインクリメントする */
    INY: function() {
      this.registers.indexY++;
        const value = this.registers.indexY;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Xをデクリメント */
    DEX: function() {
      this.registers.indexX--;
        const value = this.registers.indexX;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Yをデクリメント*/
    DEY: function() {
      this.registers.indexY--;
        const value = this.registers.indexY;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
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
      const carry = this.registers.statusCarry;
      const msb = this.ram.read(addr) >> 7;

      this.registers.statusCarry = msb;
      this.ram.write(addr, (this.ram.read(addr) << 1) | carry);
    },

    /* accを左へローテートする
     * 実装を考えて、accの場合をROLと分離した
     * */
    RLA: function() {
      const carry = this.registers.statusCarry;
      const msb = this.registers.acc >> 7;

      this.registers.statusCarry = msb;
      this.registers.acc = (this.registers.acc << 1) | carry;
    },

    /* メモリを右へローテートする */
    ROR: function(addr) {
      const carry = this.registers.statusCarry << 7;
      const lsb = this.ram.read(addr) & 0x01;

      this.registers.statusCarry = lsb;
      this.ram.write(addr, (this.ram.read(addr) >> 1) | carry);
    },

    /* accを右へローテートする
     * 実装を考えてaccの場合をRORと分離した
     * */
    RRA: function() {
      const carry = this.registers.statusCarry << 7;
      const lsb = this.registers.acc & 0x01;

      this.registers.statusCarry = lsb;
      this.registers.acc = (this.registers.acc >> 1) | carry;
    },

         /* acc + memory + carryFlag
          * フラグ
          *   - negative
          *   - overflow
          *   - zero
          *   - carry
          * */
    ADC: function(addr) {
      const added = this.registers.acc + this.ram.read(addr);
      this.registers.acc = added + this.registers.statusCarry;
      this.registers.statusCarry = (added > 0xff) & 1;
    },

    /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
    SBC: function(addr) {
      const subed = this.registers.acc - this.ram.read(addr);
      this.registers.acc = subed - this.registers.statusCarry;
      this.registers.statusCarry = (subed < 0x00) & 1;
    },

    /* accをスタックにプッシュ */
    PHA: function() {},

    /* ステータス・レジスタをスタックにプッシュ */
    PHP: function() {
      this.stackPush(this.registers.statusAllRawBits);
    },

    /* スタックからaccにポップアップする */
    PLA: function() {
      this.registers.acc = this.stackPop();
    },

    /* スタックからPにポップアップする */
    PLP: function() {},

    /* アドレスへジャンプする */
    JMP: function(addr) {
      this.registers.pc = addr;
    },

    /* サブルーチンを呼び出す
     * プログラムカウンタをスタックに積み、addrにジャンプする
     * */
    JSR: function(addr) {
      const highAddr = this.registers.pc >> 8;
      const lowAddr = this.registers.pc & 0x00ff;

      this.stackPush(lowAddr);
      this.stackPush(highAddr);
      this.registers.pc = addr;
    },

    /* サブルーチンから復帰する */
    RTS: function() {
      const highAddr = this.stackPop();
      const lowAddr = this.stackPop();
      const addr = highAddr << 8 | lowAddr;
      this.registers.pc = addr;
    },

    /* 割り込みルーチンから復帰する */
    RTI: function() {},

    /* キャリーフラグがクリアされているときにブランチする */
    BCC: function(addr) {
      const isBranchable = !this.registers.statusCarry;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* キャリーフラグがセットされているときにブランチする */
    BCS: function(addr) {
      const isBranchable = this.registers.statusCarry;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ゼロフラグがセットされているときにブランチする */
    BEQ: function(addr) {
      const isBranchable = this.registers.statusZero;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ゼロフラグがクリアされているときにブランチする*/
    BNE: function(addr) {
      const isBranchable = !this.registers.statusZero;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ネガティブフラグがセットされているときにブランチする */
    BMI: function(addr) {
      const isBranchable = this.registers.statusNegative;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ネガティブフラグがクリアされているときにブランチする */
    BPL: function(addr) {
      const isBranchable = !this.registers.statusNegative;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* オーバーフローフラグがクリアされているときにブランチする*/
    BVC: function(addr) {
      const isBranchable = !this.registers.statusOverflow;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* オーバーフローフラグがセットされているときにブランチする */
    BVS: function(addr) {
      const isBranchable = this.registers.statusOverflow;

      if (isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* キャリーフラグをセットする */
    SEC: function() {
      this.registers.statusCarry = 1;
    },

    /* キャリーフラグをクリアします */
    CLC: function() {
      this.registers.statusCarry = 0;
    },

    /* IRQ割り込みを許可する */
    CLI: function() {},

    /* オーバーフローフラグをクリアする */
    CLV: function() {},

    /* BCDモードに設定する NESには実装されていない */
    SED: function() {
      this.registers.statusDecimal = 1;
    },

    /* BCDモードから通常モードに戻る NESには実装されていない */
    CLD: function() {
      this.registers.statusDecimal = 0;
    },

    /* IRQ割り込みを禁止する
     * フラグ
     * interrupt をセットする
     * */
  SEI: function() {
         this.registers.statusInterrupt = 1;
       },

       /* ソフトウェア割り込みを起こす*/
       BRK: function() {
         this.registers.statusBreak = 1;
       },

       /* 空の命令を実行する */
       NOP: function() {
         // 何もしない
       }
  };

  class Util$1 {
    static debugString(instruction, addressing, value_) {
      let prefix = '$';
      let postfix = '';

      if (!addressing) {
        prefix = '';
      } else if (addressing.name === 'bound immediate') {
        prefix = '#$';
      }

      let value;
      if (value_ === undefined) {
        value = '';
      } else {
        value = value_.toString(16);
      }

      const chars = [
        instruction.name.split(' ')[1],
        ' ',
        prefix,
        value,
        postfix
      ].join('');

      return chars
    }
  }

  /* 0x00 - 0x0F */
  var x0x = [
    /* 0x00: BRK */
    function () {
      const BRK = Instructions.BRK.bind(this);

      BRK();

      return Util$1.debugString(BRK)
    }, '1', '2', '3', '4', '5', '6', '7',
    /* 0x08: PHP*/
    function() {
      const PHP = Instructions.PHP.bind(this);

      PHP();

      return Util$1.debugString(PHP)
    }, '', '', '', '', '', '', ''
  ];

  var Addressing = {
    /* 8bitの即値なのでアドレスをそのまま返す */
    immediate: function() {
      const addr = this.registers.pc++;
      return addr
    },

    /* アドレスaddr(8bit)を返す */
    zeropage: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_);
      return addr
    },

    /* (アドレスaddr + レジスタindexX)(8bit)を返す */
    zeropageX: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_) + this.registers.indexX;
      return addr & 0xff
    },

    /* 上と同じでindexYに替えるだけ*/
    zeropageY: function() {
      const addr_ = this.registers.pc++;
      const addr = this.ram.read(addr_) + this.registers.indexY;
      return addr & 0xff
    },

    /* zeropageのaddrが16bit版 */
    absolute: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = lowAddr | (highAddr << 8);

      return addr & 0xffff
    },

    absoluteX: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | (highAddr << 8)) + this.registers.indexX;

      return addr & 0xffff
    },

    absoluteY: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | (highAddr << 8)) + this.registers.indexY;

      return addr & 0xffff
    },

    indirect: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr_ = lowAddr | (highAddr << 8);
      const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);

      return addr & 0xffff
    },

    indexIndirect: function() {
      const addr__ = this.registers.pc++;
      let addr_ = this.ram.read(addr__) + this.registers.indexX;
      addr_ = addr_ & 0x00ff;

      const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);

      return addr & 0xffff
    },

    indirectIndex: function() {
      const addr__ = this.registers.pc++;
      const addr_ = this.ram.read(addr__);

      let addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8);
      addr = addr + this.registers.indexY;

      return addr & 0xffff
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

      return addr
    }
  };

  /* 0x10 - 0x1F */
  var x1x = [
    /* 0x10 BPL relative */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BPL = Instructions.BPL.bind(this);
      BPL(addr);

      return Util$1.debugString(BPL)
    }, '1', '2', '3', '4', '5', '6', '7',
    /* 0x18 CLC */
    function() {
      const CLC = Instructions.CLC.bind(this);

      return Util$1.debugString(CLC)
    }, '', '', '', '', '', '', ''
  ];

  /* 0x20 - 0x2F */
  var x2x = [
    /* 0x20: JSR Absolute*/
    function () {
      const absolute = Addressing.absolute.bind(this);
      const addr = absolute();

      const JSR = Instructions.JSR.bind(this);

      JSR(addr);

      return Util$1.debugString(JSR, absolute, addr)
    }, '1', '2', '3',
    /* 0x24: BIT */
    function() {
      const zeropage = Addressing.zeropage.bind(this);
      const addr = zeropage();

      const BIT = Instructions.BIT.bind(this);

      BIT(addr);

      return Util$1.debugString(BIT, zeropage, addr)
    }, '5', '6', '7', '8',
    /* 0x29: AND Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const AND = Instructions.AND.bind(this);

      AND(addr);

      return Util$1.debugString(AND, immediate, addr)
    }, '', '', '', '', '', ''
  ];

  /* 0x30 - 0x3F */
  var x3x = [
    '0', '1', '2', '3', '4', '5', '6', '7',
    /* 0x38: SEC */
    function () {
      const SEC = Instructions.SEC.bind(this);

      SEC();

      return Util$1.debugString(SEC)
    }, '', '', '', '', '', '', ''];

  /* 0x40 - 0x4F */
  var x4x = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'a',
    'b',
    /* 0x4c: JMP Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);
      const addr = absolute();

      const JMP = Instructions.JMP.bind(this);
      JMP(addr);

      return Util$1.debugString(JMP, absolute, addr)
    },
    'd',
    'e',
    'f'
  ];

  /* 0x50 - 0x5F */
  var x5x = [
    /* 0x50: BVC relative */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BVC = Instructions.BVC.bind(this);
      BVC(addr);

      return Util$1.debugString(BVC, relative, addr)
    }, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ];

  //import Addressing from '../addressing'

  /* 0x60 - 0x6F */
  var x6x = [
    /* 0x60: RTS */
    function() {
      const RTS = Instructions.RTS.bind(this);
      RTS();

      return Util$1.debugString(RTS)
    }, '1', '2', '3', '4', '5', '6', '7',
    /* 0x68: PLA */
    function() {
      const PLA = Instructions.PLA.bind(this);
      PLA();

      return Util$1.debugString(PLA)
    }, '', '', '', '', '', '', ''
  ];

  /* 0x70 - 0x7F */
  var x7x = [
    /* 0x70: BVS */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BVS = Instructions.BVS.bind(this);
      BVS(addr);

      return Util$1.debugString(BVS, relative, addr)
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x78: SEI */
    function() {
      const SEI = Instructions.SEI.bind(this);

      SEI();

      return Util$1.debugString(SEI)
    },
    '9',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f'
  ];

  /* 0x80 - 0x8F */
  var x8x = [
    '0',
    '1',
    '2',
    '3',
    '4',
    /* 0x85: STA zeropage */
    function() {
      const zeropage = Addressing.zeropage.bind(this);

      const addr = zeropage();
      const STA = Instructions.STA.bind(this);

      STA(addr);

      return Util$1.debugString(STA, zeropage, addr)
    },
    /* 0x86: STX Zeropage */
    function() {
      const zeropage = Addressing.zeropage.bind(this);

      const addr = zeropage();
      const STX = Instructions.STX.bind(this);

      STX(addr);

      return Util$1.debugString(STX, zeropage, addr)
    },
    '7',
    /* 0x88: DEY */
    function() {
      const DEY = Instructions.DEY.bind(this);

      DEY();

      return Util$1.debugString(DEY)
    },
    '9',
    'a',
    'b',
    'c',
    /* 0x8d: STA Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);

      const addr = absolute();
      const STA = Instructions.STA.bind(this);

      STA(addr);

      return Util$1.debugString(STA, absolute, addr)
    },
    'e',
    'f'
  ];

  /* 0x90 - 0x9F */
  var x9x = [
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BCC = Instructions.BCC.bind(this);

      BCC(addr);

      return Util$1.debugString(BCC, relative, addr)
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    /* 9A: TXS Implied*/
    function() {
      const TXS = Instructions.TXS.bind(this);
      TXS();

      return Util$1.debugString(TXS)
    },
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xA0 - 0xAF */
  var xAx = [
    /* 0xA0: LDY Immediate*/
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDY = Instructions.LDY.bind(this);
      LDY(addr);

      return Util$1.debugString(LDY, immediate, this.ram.read(addr))
    },
    '1',
    /* 0xA2: LDX Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDX = Instructions.LDX.bind(this);
      LDX(addr);

      return Util$1.debugString(LDX, immediate, this.ram.read(addr))
    },
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',

    /* 0xA9: LDA Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, immediate, this.ram.read(addr))
    },
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xb0 - 0xbF */
  var xBx = [
    /* 0xb0: BCS */
    function() {
      const relative = Addressing.relative.bind(this);

      const addr = relative();

      const BCS = Instructions.BCS.bind(this);
      BCS(addr);

      return Util$1.debugString(BCS, relative, addr)
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'a',
    'b',
    'c',
    /* 0xbd: LDA Absolutem X */
    function() {
      const absoluteX = Addressing.absoluteX.bind(this);
      const addr = absoluteX();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, absoluteX, addr)
    },
    'e',
    'f'
  ];

  /* 0xc0 - 0xcF */
  var xCx = ['0', '1', '2', '3', '4', '5', '6', '7', '8',
    /* 0xc9: CMP immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const CMP = Instructions.CMP.bind(this);
      CMP(addr);

      return Util$1.debugString(CMP, immediate, addr)
    }, '', '', '', '', '', ''
  ];

  /* 0xd0 - 0xdF */
  var xDx = [
    /* 0xd0: BNE */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BNE = Instructions.BNE.bind(this);
      BNE(addr);

      return Util$1.debugString(BNE, relative, addr)
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0xd8: CLD */
    function() {
      const CLD = Instructions.CLD.bind(this);
      CLD();

      return Util$1.debugString(CLD)
    },
    '9',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f'
  ];

  //import Addressing from '../addressing'

  /* 0xe0 - 0xeF */
  var xEx = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0xe8: INX */
    function() {
      const INX = Instructions.INX.bind(this);

      INX();

      return Util$1.debugString(INX)
    },
    '9',
    /* 0xea: NOP */
    function() {
      //何もしない
      return Util$1.debugString(Instructions.NOP.bind(this))
    },
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xf0 - 0xff */
  var xFx = [
    /* 0xf0: BEQ */
    function() {
      const relative = Addressing.relative.bind(this);
      const addr = relative();

      const BEQ = Instructions.BEQ.bind(this);
      BEQ(addr);

      return Util$1.debugString(BEQ, relative, addr)
    }, '1', '2', '3', '4', '5', '6', '7',
    /* 0xf8: SED */
    function () {
      const SED = Instructions.SED.bind(this);

      SED();

      return Util$1.debugString(SED)
    }, '', '', '', '', '', '', ''
  ];

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
      return typeof process !== 'undefined' && typeof require !== 'undefined'
    }
  };

  /* 6502 CPU */
  class Cpu {
    constructor(isDebug) {
      this.init();
      this.isDebug = isDebug;
    }

    init() {
      this.registers = new Register();
      //this.opcodes = opcodes
      this.opcodes = opcodes.map(opcode => {
        return typeof opcode === 'function' ? opcode.bind(this) : opcode
      });

      this.ram = new Ram();
    }

    connect(parts) {
      parts.bus && this.ram.connect(parts);
    }

    reset() {
      this.init();
      this.run();
    }

    run() {
      const execute = this.isDebug ? this.debug.bind(this) : this.eval.bind(this);

      Util$2.isNodejs() ? setInterval(execute, 100) : execute();
    }

    // 命令を処理する
    eval() {
      const addr = this.registers.pc++;
      const opcode = this.ram.read(addr);

      this.opcodes[opcode].call();

      const fn = this.eval.bind(this);

      if (!Util$2.isNodejs()) window.requestAnimationFrame(fn);
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

      const debugString = this.opcodes[opcode].call();
      console.log('$' + addr.toString(16) + ':' + debugString);

      const fn = this.debug.bind(this);

      if (!Util$2.isNodejs()) window.requestAnimationFrame(fn);
    }

    /* 0x8000~のメモリにROM内のPRG-ROMを読み込む*/
    set prgRom(prgRom) {
      //this.interruptVectors(prgRom)
      const startAddr = 0xffff - prgRom.length;
      this.registers.pc = startAddr;

      for (let i = 0; i < prgRom.length; i++) {
        //this.memory[startAddr+i] = prgRom[i]
        this.ram.write(startAddr + i, prgRom[i]);
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
      this.ram.write(this.registers.sp, value);
      this.registers.sp--;
    }

    stackPop() {
      return this.ram.read(++this.registers.sp)
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
    constructor(isDebug) {
      this.cpu = new Cpu(isDebug);
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

    get NUMBER_OF_PRG_ROM_BLOCKS() {
      //console.log('Number of PRG-ROM blocks: ' + this.data[4])
      return this.data[4]
    }

    get NUMBER_OF_CHR_ROM_BLOCKS() {
      //console.log('Number of CHR-ROM blocks: ' + this.data[5])
      return this.data[5]
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
      return this.NUMBER_OF_PRG_ROM_BLOCKS * 0x4000
    }

    /* PRG ROMに同じ*/
    get SIZE_OF_CHR_ROM() {
      return this.NUMBER_OF_CHR_ROM_BLOCKS * 0x2000
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
      if (!id) throw new Error("Id of canvas tag isn't specified.")

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvaW5zdHJ1Y3Rpb25zL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzL3V0aWwuanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgweC5qcyIsIi4uL3NyYy9jcHUvYWRkcmVzc2luZy9pbmRleC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgzeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy91dGlsLmpzIiwiLi4vc3JjL2NwdS9jcHUuanMiLCIuLi9zcmMvcHB1L3ZyYW0uanMiLCIuLi9zcmMvcHB1L3BwdS5qcyIsIi4uL3NyYy9idXMvaW5kZXguanMiLCIuLi9zcmMvbmVzLmpzIiwiLi4vc3JjL3JvbS9pbmRleC5qcyIsIi4uL3NyYy9yZW5kZXJlci9jb2xvcnMuanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVnaXN0ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFjY18gPSAweDAwIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICAgIHRoaXMuaW5kZXhYXyA9IDB4MDAgLy8g44Ki44OJ44Os44OD44K344Oz44Kw44CB44Kr44Km44Oz44K/562J44Gr55So44GE44KLXG4gICAgdGhpcy5pbmRleFlfID0gMHgwMCAvLyDkuIrjgavlkIzjgZhcbiAgICB0aGlzLnNwXyA9ICAweDAxZmQgLy8g44K544K/44OD44Kv44Od44Kk44Oz44K/ICQwMTAwLSQwMUZGLCDliJ3mnJ/lgKTjga8weDAxZmTjgaPjgb3jgYRcbiAgICB0aGlzLnN0YXR1c18gPSAweDM0XG4gICAgLypcbiAgICBzdGF0dXM6IHtcbiAgICAgIC8vIOOCueODhuODvOOCv+OCueODrOOCuOOCueOCv++8mkNQVeOBruWQhOeorueKtuaFi+OCkuS/neaMgeOBmeOCi1xuICAgICAgbmVnYXRpdmVfOiAwLFxuICAgICAgb3ZlcmZsb3dfOiAwLFxuICAgICAgcmVzZXJ2ZWRfOiAxLFxuICAgICAgYnJlYWtfOiAxLCAvLyDlibLjgorovrzjgb9CUkvnmbrnlJ/mmYLjgat0cnVlLElSUeeZuueUn+aZguOBq2ZhbHNlXG4gICAgICBkZWNpbWFsXzogMCxcbiAgICAgIGludGVycnVwdF86IDEsXG4gICAgICB6ZXJvXzogMCxcbiAgICAgIGNhcnJ5XzogMFxuICAgIH1cbiAgICAqL1xuICAgIHRoaXMucGMgPSAweDgwMDAgLy8g44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/XG4gIH1cblxuICBnZXQgc3RhdHVzQWxsUmF3Qml0cygpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfXG4gIH1cblxuICBnZXQgYWNjKCkge1xuICAgIHJldHVybiB0aGlzLmFjY19cbiAgfVxuXG4gIHNldCBhY2ModmFsdWUpIHtcbiAgICB0aGlzLmFjY18gPSB2YWx1ZVxuICB9XG5cbiAgZ2V0IGluZGV4WCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRleFhfXG4gIH1cblxuICBzZXQgaW5kZXhYKHZhbHVlKSB7XG4gICAgdGhpcy5pbmRleFhfID0gdmFsdWVcbiAgfVxuXG4gIGdldCBzcCgpIHtcbiAgICByZXR1cm4gdGhpcy5zcF9cbiAgfVxuXG4gIHNldCBzcCh2YWx1ZSkge1xuICAgIHRoaXMuc3BfID0gdmFsdWVcbiAgfVxuXG4gIGdldCBzdGF0dXNOZWdhdGl2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfID4+IDdcbiAgfVxuXG4gIHNldCBzdGF0dXNOZWdhdGl2ZShiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCBiaXQgPDwgN1xuICB9XG5cbiAgZ2V0IHN0YXR1c092ZXJmbG93KCkge1xuICAgIHJldHVybiB0aGlzLnN0YXR1c18gPj4gNiAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNPdmVyZmxvdyhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCBiaXQgPDwgNlxuICB9XG5cbiAgZ2V0IHN0YXR1c1Jlc2VydmVkKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXR1c18gPj4gNSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNSZXNlcnZlZChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCBiaXQgPDwgNVxuICB9XG5cbiAgZ2V0IHN0YXR1c0JyZWFrKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXR1c18gPj4gNCAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNCcmVhayhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCBiaXQgPDwgNFxuICB9XG5cbiAgZ2V0IHN0YXR1c0RlY2ltYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzXyA+PiAzICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0RlY2ltYWwoYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgYml0IDw8IDNcbiAgfVxuXG4gIGdldCBzdGF0dXNJbnRlcnJ1cHQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzXyA+PiAyICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0ludGVycnVwdChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCBiaXQgPDwgMlxuICB9XG5cbiAgZ2V0IHN0YXR1c1plcm8oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzXyA+PiAxICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c1plcm8oYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgYml0IDw8IDFcbiAgfVxuXG4gIGdldCBzdGF0dXNDYXJyeSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0NhcnJ5KGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IGJpdFxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4MTAwMDApXG4gIH1cblxuICAvKiBNZW1vcnkgbWFwcGVkIEkvT+OBp+OBguOCi+OBn+OCge+8jOODkOOCuShCdXMp44KS5o6l57aa44GX44Gm44GK44GPXG4gICAqIFBQVeetieOBuOOBr0J1c+OCkumAmuOBl+OBpuODh+ODvOOCv+OBruOChOOCiuWPluOCiuOCkuihjOOBhlxuICAgKiAqL1xuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmICh0aGlzLmJ1cyA9IHBhcnRzLmJ1cylcbiAgfVxuXG4gIC8qVE9ETyDlkITjg53jg7zjg4goYWRkcinjgavjgqLjgq/jgrvjgrnjgYzjgYLjgaPjgZ/loLTlkIjjgavjga/jg5Djgrnjgavmm7jjgY3ovrzjgoAgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBpZiAoYWRkciA+PSAweDIwMDAgJiYgYWRkciA8PSAweDIwMDcpIHtcbiAgICAgIHRoaXMuYnVzLndyaXRlKGFkZHIsIHZhbHVlKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8g6YCa5bi444Gu44Oh44Oi44Oq44Ki44Kv44K744K5XG4gICAgdGhpcy5tZW1vcnlbYWRkcl0gPSB2YWx1ZVxuICB9XG5cbiAgLypUT0RPIOOCs+ODs+ODiOODreODvOODqeeUqOOBruODneODvOODiCAqL1xuICByZWFkKGFkZHIpIHtcbiAgICByZXR1cm4gdGhpcy5tZW1vcnlbYWRkcl1cbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBpc05lZ2F0aXZlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID4+IDdcbiAgfVxuXG4gIHN0YXRpYyBpc1plcm8odmFsdWUpIHtcbiAgICByZXR1cm4gKHZhbHVlID09PSAweDAwKSAmIDFcbiAgfVxuXG4gIHN0YXRpYyBtc2IodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPj4gN1xuICB9XG5cbiAgc3RhdGljIGxzYih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAmIDB4MDFcbiAgfVxufVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8qIExEKiAoTG9hZCBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZSA6IOioiOeul+e1kOaenOOBjOiyoOOBruWApOOBruOBqOOBjTHjgZ3jgYbjgafjgarjgZHjgozjgbAwKGFjY+OBrjdiaXTnm67jgajlkIzjgZjlgKTjgavjgarjgospXG4gICAqICAgLSB6ZXJvIDog6KiI566X57WQ5p6c44GM44K844Ot44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDBcbiAgICogKi9cbiAgTERBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG4gIC8qIOODrOOCuOOCueOCv2luZGV4WOOBq2RhdGHjgpLjg63jg7zjg4njgZnjgosgKi9cbiAgTERYOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgTERZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogU1QqIChTdG9yZSBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44Kw5pON5L2c44Gv54Sh44GXXG4gICAqICovXG4gIFNUQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgfSxcblxuICBTVFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFgpXG4gIH0sXG5cbiAgU1RZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKVxuICB9LFxuXG4gIC8qIFQqKiAoVHJhbnNmZXIgKiByZWdpc3RlciB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICovXG4gIFRBWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2NcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUQVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFNYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLnNwXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFhBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRYUzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zcCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRZQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBhY2MgJiBtZW1vcnlbYWRkcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gemVyb1xuICAgKiAqL1xuICBBTkQ6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBB44G+44Gf44Gv44Oh44Oi44Oq44KS5bem44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIEFTTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IG1zYiA9IFV0aWwubXNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlIDw8IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gIH0sXG5cbiAgLyogYWNj44G+44Gf44Gv44Oh44Oi44Oq44KS5Y+z44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIExTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IGxzYiA9IFV0aWwubHNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlID4+IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkkFOROa8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nOOBmeOCi1xuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogKi9cbiAgQklUOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgbWVtb3J5ID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgJiBtZW1vcnkpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBtZW1vcnkgPj4gN1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gbWVtb3J5ID4+IDYgJiAweDAxXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkuavlOi8g+a8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nFxuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogQSA9PSBtZW0gLT4gWiA9IDBcbiAgICogQSA+PSBtZW0gLT4gQyA9IDFcbiAgICogQSA8PSBtZW0gLT4gQyA9IDBcbiAgICogKi9cbiAgQ01QOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5yZWdpc3RlcnMuYWNjIC0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgaWYocmVzdWx0ID09PSAwKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gMFxuICAgICAgaWYocmVzdWx0ID4gMCkge1xuICAgICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDFcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMFxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKiBY44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XICovXG4gIENQWDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBZ44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XKi9cbiAgQ1BZOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qICrjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gemVyb1xuICAgKiAqL1xuICAvKiDjg6Hjg6Ljg6rjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosqL1xuICBJTkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpICsgMSlcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS44OH44Kv44Oq44Oh44Oz44OIICovXG4gIERFQzogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmFtLnJlYWQoYWRkcikgLSAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBY44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYKytcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIFnjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosgKi9cbiAgSU5ZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkrK1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogWOOCkuODh+OCr+ODquODoeODs+ODiCAqL1xuICBERVg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WC0tXG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBZ44KS44OH44Kv44Oq44Oh44Oz44OIKi9cbiAgREVZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFktLVxuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogYWNj44Go44Oh44Oi44Oq44KS6KuW55CGWE9S5ryU566X44GX44GmYWNj44Gr57WQ5p6c44KS6L+U44GZKi9cbiAgRU9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5yZWdpc3RlcnMuYWNjIF4gdGhpcy5yYW0ucmVhZChhZGRyKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhk9S5ryU566X44GX44Gm57WQ5p6c44KSQeOBuOi/lOOBmSAqL1xuICBPUkE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB0aGlzLnJlZ2lzdGVycy5hY2MgfCB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS5bem44G444Ot44O844OG44O844OI44GZ44KLICovXG4gIFJPTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGNhcnJ5ID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnlcbiAgICBjb25zdCBtc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpID4+IDdcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgKHRoaXMucmFtLnJlYWQoYWRkcikgPDwgMSkgfCBjYXJyeSlcbiAgfSxcblxuICAvKiBhY2PjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgotcbiAgICog5a6f6KOF44KS6ICD44GI44Gm44CBYWNj44Gu5aC05ZCI44KSUk9M44Go5YiG6Zui44GX44GfXG4gICAqICovXG4gIFJMQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FycnkgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuICAgIGNvbnN0IG1zYiA9IHRoaXMucmVnaXN0ZXJzLmFjYyA+PiA3XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IG1zYlxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgPDwgMSkgfCBjYXJyeVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuWPs+OBuOODreODvOODhuODvOODiOOBmeOCiyAqL1xuICBST1I6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5IDw8IDdcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpICYgMHgwMVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSBsc2JcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCAodGhpcy5yYW0ucmVhZChhZGRyKSA+PiAxKSB8IGNhcnJ5KVxuICB9LFxuXG4gIC8qIGFjY+OCkuWPs+OBuOODreODvOODhuODvOODiOOBmeOCi1xuICAgKiDlrp/oo4XjgpLogIPjgYjjgaZhY2Pjga7loLTlkIjjgpJST1LjgajliIbpm6LjgZfjgZ9cbiAgICogKi9cbiAgUlJBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5IDw8IDdcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJlZ2lzdGVycy5hY2MgJiAweDAxXG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IGxzYlxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgPj4gMSkgfCBjYXJyeVxuICB9LFxuXG4gICAgICAgLyogYWNjICsgbWVtb3J5ICsgY2FycnlGbGFnXG4gICAgICAgICog44OV44Op44KwXG4gICAgICAgICogICAtIG5lZ2F0aXZlXG4gICAgICAgICogICAtIG92ZXJmbG93XG4gICAgICAgICogICAtIHplcm9cbiAgICAgICAgKiAgIC0gY2FycnlcbiAgICAgICAgKiAqL1xuICBBREM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBhZGRlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyArIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBhZGRlZCArIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAoYWRkZWQgPiAweGZmKSAmIDFcbiAgfSxcblxuICAvKiAoYWNjIC0g44Oh44Oi44OqIC0g44Kt44Oj44Oq44O844OV44Op44KwKeOCkua8lOeul+OBl+OBpmFjY+OBuOi/lOOBmSAqL1xuICBTQkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBzdWJlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyAtIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBzdWJlZCAtIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAoc3ViZWQgPCAweDAwKSAmIDFcbiAgfSxcblxuICAvKiBhY2PjgpLjgrnjgr/jg4Pjgq/jgavjg5fjg4Pjgrfjg6UgKi9cbiAgUEhBOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCueODhuODvOOCv+OCueODu+ODrOOCuOOCueOCv+OCkuOCueOCv+ODg+OCr+OBq+ODl+ODg+OCt+ODpSAqL1xuICBQSFA6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhY2tQdXNoKHRoaXMucmVnaXN0ZXJzLnN0YXR1c0FsbFJhd0JpdHMpXG4gIH0sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJYWNj44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMQTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5zdGFja1BvcCgpXG4gIH0sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJUOOBq+ODneODg+ODl+OCouODg+ODl+OBmeOCiyAqL1xuICBQTFA6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Ki44OJ44Os44K544G444K444Oj44Oz44OX44GZ44KLICovXG4gIEpNUDogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICB9LFxuXG4gIC8qIOOCteODluODq+ODvOODgeODs+OCkuWRvOOBs+WHuuOBmVxuICAgKiDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr/jgpLjgrnjgr/jg4Pjgq/jgavnqY3jgb/jgIFhZGRy44Gr44K444Oj44Oz44OX44GZ44KLXG4gICAqICovXG4gIEpTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yZWdpc3RlcnMucGMgPj4gOFxuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYyAmIDB4MDBmZlxuXG4gICAgdGhpcy5zdGFja1B1c2gobG93QWRkcilcbiAgICB0aGlzLnN0YWNrUHVzaChoaWdoQWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRTOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMuc3RhY2tQb3AoKVxuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnN0YWNrUG9wKClcbiAgICBjb25zdCBhZGRyID0gaGlnaEFkZHIgPDwgOCB8IGxvd0FkZHJcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgfSxcblxuICAvKiDlibLjgorovrzjgb/jg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRJOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCQ0M6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSAhdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnlcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkNTOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnlcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgrzjg63jg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkVROiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVyb1xuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCvOODreODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyovXG4gIEJORTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44ON44Ks44OG44Kj44OW44OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJNSTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44ON44Ks44OG44Kj44OW44OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJQTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyovXG4gIEJWQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvd1xuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCVlM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvd1xuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOCkuOCu+ODg+ODiOOBmeOCiyAqL1xuICBTRUM6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMVxuICB9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOCkuOCr+ODquOCouOBl+OBvuOBmSAqL1xuICBDTEM6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMFxuICB9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuioseWPr+OBmeOCiyAqL1xuICBDTEk6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44KS44Kv44Oq44Ki44GZ44KLICovXG4gIENMVjogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgavoqK3lrprjgZnjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIFNFRDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzRGVjaW1hbCA9IDFcbiAgfSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgYvjgonpgJrluLjjg6Ljg7zjg4njgavmiLvjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIENMRDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzRGVjaW1hbCA9IDBcbiAgfSxcblxuICAvKiBJUlHlibLjgorovrzjgb/jgpLnpoHmraLjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqIGludGVycnVwdCDjgpLjgrvjg4Pjg4jjgZnjgotcbiAgICogKi9cblNFSTogZnVuY3Rpb24oKSB7XG4gICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzSW50ZXJydXB0ID0gMVxuICAgICB9LFxuXG4gICAgIC8qIOOCveODleODiOOCpuOCp+OCouWJsuOCiui+vOOBv+OCkui1t+OBk+OBmSovXG4gICAgIEJSSzogZnVuY3Rpb24oKSB7XG4gICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQnJlYWsgPSAxXG4gICAgIH0sXG5cbiAgICAgLyog56m644Gu5ZG95Luk44KS5a6f6KGM44GZ44KLICovXG4gICAgIE5PUDogZnVuY3Rpb24oKSB7XG4gICAgICAgLy8g5L2V44KC44GX44Gq44GEXG4gICAgIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFV0aWwge1xuICBzdGF0aWMgZGVidWdTdHJpbmcoaW5zdHJ1Y3Rpb24sIGFkZHJlc3NpbmcsIHZhbHVlXykge1xuICAgIGxldCBwcmVmaXggPSAnJCdcbiAgICBsZXQgcG9zdGZpeCA9ICcnXG5cbiAgICBpZiAoIWFkZHJlc3NpbmcpIHtcbiAgICAgIHByZWZpeCA9ICcnXG4gICAgfSBlbHNlIGlmIChhZGRyZXNzaW5nLm5hbWUgPT09ICdib3VuZCBpbW1lZGlhdGUnKSB7XG4gICAgICBwcmVmaXggPSAnIyQnXG4gICAgfVxuXG4gICAgbGV0IHZhbHVlXG4gICAgaWYgKHZhbHVlXyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YWx1ZSA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gdmFsdWVfLnRvU3RyaW5nKDE2KVxuICAgIH1cblxuICAgIGNvbnN0IGNoYXJzID0gW1xuICAgICAgaW5zdHJ1Y3Rpb24ubmFtZS5zcGxpdCgnICcpWzFdLFxuICAgICAgJyAnLFxuICAgICAgcHJlZml4LFxuICAgICAgdmFsdWUsXG4gICAgICBwb3N0Zml4XG4gICAgXS5qb2luKCcnKVxuXG4gICAgcmV0dXJuIGNoYXJzXG4gIH1cbn1cbiIsImltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuLy9pbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDAwIC0gMHgwRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDAwOiBCUksgKi9cbiAgZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IEJSSyA9IEluc3RydWN0aW9ucy5CUksuYmluZCh0aGlzKVxuXG4gICAgQlJLKClcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJSSylcbiAgfSwgJzEnLCAnMicsICczJywgJzQnLCAnNScsICc2JywgJzcnLFxuICAvKiAweDA4OiBQSFAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBQSFAgPSBJbnN0cnVjdGlvbnMuUEhQLmJpbmQodGhpcylcblxuICAgIFBIUCgpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhQSFApXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8qIDhiaXTjga7ljbPlgKTjgarjga7jgafjgqLjg4njg6zjgrnjgpLjgZ3jga7jgb7jgb7ov5TjgZkgKi9cbiAgaW1tZWRpYXRlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIHJldHVybiBhZGRyXG4gIH0sXG5cbiAgLyog44Ki44OJ44Os44K5YWRkcig4Yml0KeOCkui/lOOBmSAqL1xuICB6ZXJvcGFnZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pXG4gICAgcmV0dXJuIGFkZHJcbiAgfSxcblxuICAvKiAo44Ki44OJ44Os44K5YWRkciArIOODrOOCuOOCueOCv2luZGV4WCkoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2VYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICByZXR1cm4gYWRkciAmIDB4ZmZcbiAgfSxcblxuICAvKiDkuIrjgajlkIzjgZjjgadpbmRleFnjgavmm7/jgYjjgovjgaDjgZEqL1xuICB6ZXJvcGFnZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuICAgIHJldHVybiBhZGRyICYgMHhmZlxuICB9LFxuXG4gIC8qIHplcm9wYWdl44GuYWRkcuOBjDE2Yml054mIICovXG4gIGFic29sdXRlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOClcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBhYnNvbHV0ZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKVxuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZChoaWdoQWRkcl8pXG5cbiAgICBjb25zdCBhZGRyID0gKGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOCkpICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIGluZGlyZWN0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkcl8gPSBsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRleEluZGlyZWN0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgbGV0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgYWRkcl8gPSBhZGRyXyAmIDB4MDBmZlxuXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRpcmVjdEluZGV4OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJhbS5yZWFkKGFkZHJfXylcblxuICAgIGxldCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCAodGhpcy5yYW0ucmVhZChhZGRyXyArIDEpIDw8IDgpXG4gICAgYWRkciA9IGFkZHIgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgLyogKOODl+ODreOCsOODqeODoOOCq+OCpuODs+OCvyArIOOCquODleOCu+ODg+ODiCnjgpLov5TjgZnjgIJcbiAgICog44Kq44OV44K744OD44OI44Gu6KiI566X44Gn44Gv56ym5Y+35LuY44GN44Gu5YCk44GM5L2/55So44GV44KM44KL44CCXG4gICAqIOespuWPt+S7mOOBjeOBruWApOOBr1xuICAgKiAgIC0xMjgoMHg4MCkgfiAtMSAoMHhmZilcbiAgICogICAwKDB4MDApIH4gMTI3KDB4N2YpXG4gICAqICovXG4gIHJlbGF0aXZlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBzaWduZWROdW1iZXIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuXG4gICAgbGV0IGFkZHIgPVxuICAgICAgc2lnbmVkTnVtYmVyID49IDB4ODBcbiAgICAgICAgPyB0aGlzLnJlZ2lzdGVycy5wYyArIHNpZ25lZE51bWJlciAtIDB4MTAwXG4gICAgICAgIDogdGhpcy5yZWdpc3RlcnMucGMgKyBzaWduZWROdW1iZXJcblxuICAgIHJldHVybiBhZGRyXG4gIH1cbn1cbiIsImltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgxMCAtIDB4MUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgxMCBCUEwgcmVsYXRpdmUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmVsYXRpdmUgPSBBZGRyZXNzaW5nLnJlbGF0aXZlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gcmVsYXRpdmUoKVxuXG4gICAgY29uc3QgQlBMID0gSW5zdHJ1Y3Rpb25zLkJQTC5iaW5kKHRoaXMpXG4gICAgQlBMKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhCUEwpXG4gIH0sICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JyxcbiAgLyogMHgxOCBDTEMgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgQ0xDID0gSW5zdHJ1Y3Rpb25zLkNMQy5iaW5kKHRoaXMpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhDTEMpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4MjAgLSAweDJGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4MjA6IEpTUiBBYnNvbHV0ZSovXG4gIGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBhYnNvbHV0ZSA9IEFkZHJlc3NpbmcuYWJzb2x1dGUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSBhYnNvbHV0ZSgpXG5cbiAgICBjb25zdCBKU1IgPSBJbnN0cnVjdGlvbnMuSlNSLmJpbmQodGhpcylcblxuICAgIEpTUihhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoSlNSLCBhYnNvbHV0ZSwgYWRkcilcbiAgfSwgJzEnLCAnMicsICczJyxcbiAgLyogMHgyNDogQklUICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHplcm9wYWdlID0gQWRkcmVzc2luZy56ZXJvcGFnZS5iaW5kKHRoaXMpXG4gICAgY29uc3QgYWRkciA9IHplcm9wYWdlKClcblxuICAgIGNvbnN0IEJJVCA9IEluc3RydWN0aW9ucy5CSVQuYmluZCh0aGlzKVxuXG4gICAgQklUKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhCSVQsIHplcm9wYWdlLCBhZGRyKVxuICB9LCAnNScsICc2JywgJzcnLCAnOCcsXG4gIC8qIDB4Mjk6IEFORCBJbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaW1tZWRpYXRlID0gQWRkcmVzc2luZy5pbW1lZGlhdGUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKVxuXG4gICAgY29uc3QgQU5EID0gSW5zdHJ1Y3Rpb25zLkFORC5iaW5kKHRoaXMpXG5cbiAgICBBTkQoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEFORCwgaW1tZWRpYXRlLCBhZGRyKVxuICB9LCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJpbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbi8vaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgzMCAtIDB4M0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJzAnLCAnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsXG4gIC8qIDB4Mzg6IFNFQyAqL1xuICBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgU0VDID0gSW5zdHJ1Y3Rpb25zLlNFQy5iaW5kKHRoaXMpXG5cbiAgICBTRUMoKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoU0VDKVxuICB9LCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJ11cbiIsImltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg0MCAtIDB4NEYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJzAnLFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gICc4JyxcbiAgJzknLFxuICAnYScsXG4gICdiJyxcbiAgLyogMHg0YzogSk1QIEFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFic29sdXRlID0gQWRkcmVzc2luZy5hYnNvbHV0ZS5iaW5kKHRoaXMpXG4gICAgY29uc3QgYWRkciA9IGFic29sdXRlKClcblxuICAgIGNvbnN0IEpNUCA9IEluc3RydWN0aW9ucy5KTVAuYmluZCh0aGlzKVxuICAgIEpNUChhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoSk1QLCBhYnNvbHV0ZSwgYWRkcilcbiAgfSxcbiAgJ2QnLFxuICAnZScsXG4gICdmJ1xuXVxuIiwiaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDUwIC0gMHg1RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDUwOiBCVkMgcmVsYXRpdmUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmVsYXRpdmUgPSBBZGRyZXNzaW5nLnJlbGF0aXZlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gcmVsYXRpdmUoKVxuXG4gICAgY29uc3QgQlZDID0gSW5zdHJ1Y3Rpb25zLkJWQy5iaW5kKHRoaXMpXG4gICAgQlZDKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhCVkMsIHJlbGF0aXZlLCBhZGRyKVxuICB9LCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCIvL2ltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg2MCAtIDB4NkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg2MDogUlRTICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFJUUyA9IEluc3RydWN0aW9ucy5SVFMuYmluZCh0aGlzKVxuICAgIFJUUygpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhSVFMpXG4gIH0sICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JyxcbiAgLyogMHg2ODogUExBICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFBMQSA9IEluc3RydWN0aW9ucy5QTEEuYmluZCh0aGlzKVxuICAgIFBMQSgpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhQTEEpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4NzAgLSAweDdGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4NzA6IEJWUyAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSByZWxhdGl2ZSgpXG5cbiAgICBjb25zdCBCVlMgPSBJbnN0cnVjdGlvbnMuQlZTLmJpbmQodGhpcylcbiAgICBCVlMoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJWUywgcmVsYXRpdmUsIGFkZHIpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHg3ODogU0VJICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFNFSSA9IEluc3RydWN0aW9ucy5TRUkuYmluZCh0aGlzKVxuXG4gICAgU0VJKClcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFNFSSlcbiAgfSxcbiAgJzknLFxuICAnYScsXG4gICdiJyxcbiAgJ2MnLFxuICAnZCcsXG4gICdlJyxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ODAgLSAweDhGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJyxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAvKiAweDg1OiBTVEEgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgemVyb3BhZ2UgPSBBZGRyZXNzaW5nLnplcm9wYWdlLmJpbmQodGhpcylcblxuICAgIGNvbnN0IGFkZHIgPSB6ZXJvcGFnZSgpXG4gICAgY29uc3QgU1RBID0gSW5zdHJ1Y3Rpb25zLlNUQS5iaW5kKHRoaXMpXG5cbiAgICBTVEEoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFNUQSwgemVyb3BhZ2UsIGFkZHIpXG4gIH0sXG4gIC8qIDB4ODY6IFNUWCBaZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB6ZXJvcGFnZSA9IEFkZHJlc3NpbmcuemVyb3BhZ2UuYmluZCh0aGlzKVxuXG4gICAgY29uc3QgYWRkciA9IHplcm9wYWdlKClcbiAgICBjb25zdCBTVFggPSBJbnN0cnVjdGlvbnMuU1RYLmJpbmQodGhpcylcblxuICAgIFNUWChhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoU1RYLCB6ZXJvcGFnZSwgYWRkcilcbiAgfSxcbiAgJzcnLFxuICAvKiAweDg4OiBERVkgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgREVZID0gSW5zdHJ1Y3Rpb25zLkRFWS5iaW5kKHRoaXMpXG5cbiAgICBERVkoKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoREVZKVxuICB9LFxuICAnOScsXG4gICdhJyxcbiAgJ2InLFxuICAnYycsXG4gIC8qIDB4OGQ6IFNUQSBBYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhYnNvbHV0ZSA9IEFkZHJlc3NpbmcuYWJzb2x1dGUuYmluZCh0aGlzKVxuXG4gICAgY29uc3QgYWRkciA9IGFic29sdXRlKClcbiAgICBjb25zdCBTVEEgPSBJbnN0cnVjdGlvbnMuU1RBLmJpbmQodGhpcylcblxuICAgIFNUQShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoU1RBLCBhYnNvbHV0ZSwgYWRkcilcbiAgfSxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbC5qcydcblxuLyogMHg5MCAtIDB4OUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgcmVsYXRpdmUgPSBBZGRyZXNzaW5nLnJlbGF0aXZlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gcmVsYXRpdmUoKVxuXG4gICAgY29uc3QgQkNDID0gSW5zdHJ1Y3Rpb25zLkJDQy5iaW5kKHRoaXMpXG5cbiAgICBCQ0MoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJDQywgcmVsYXRpdmUsIGFkZHIpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgJzgnLFxuICAnOScsXG4gIC8qIDlBOiBUWFMgSW1wbGllZCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFRYUyA9IEluc3RydWN0aW9ucy5UWFMuYmluZCh0aGlzKVxuICAgIFRYUygpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhUWFMpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJ1xuXVxuIiwiaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweEEwIC0gMHhBRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweEEwOiBMRFkgSW1tZWRpYXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaW1tZWRpYXRlID0gQWRkcmVzc2luZy5pbW1lZGlhdGUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKVxuXG4gICAgY29uc3QgTERZID0gSW5zdHJ1Y3Rpb25zLkxEWS5iaW5kKHRoaXMpXG4gICAgTERZKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMRFksIGltbWVkaWF0ZSwgdGhpcy5yYW0ucmVhZChhZGRyKSlcbiAgfSxcbiAgJzEnLFxuICAvKiAweEEyOiBMRFggSW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGltbWVkaWF0ZSA9IEFkZHJlc3NpbmcuaW1tZWRpYXRlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gaW1tZWRpYXRlKClcblxuICAgIGNvbnN0IExEWCA9IEluc3RydWN0aW9ucy5MRFguYmluZCh0aGlzKVxuICAgIExEWChhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERYLCBpbW1lZGlhdGUsIHRoaXMucmFtLnJlYWQoYWRkcikpXG4gIH0sXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAnOCcsXG5cbiAgLyogMHhBOTogTERBIEltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBpbW1lZGlhdGUgPSBBZGRyZXNzaW5nLmltbWVkaWF0ZS5iaW5kKHRoaXMpXG4gICAgY29uc3QgYWRkciA9IGltbWVkaWF0ZSgpXG5cbiAgICBjb25zdCBMREEgPSBJbnN0cnVjdGlvbnMuTERBLmJpbmQodGhpcylcbiAgICBMREEoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKExEQSwgaW1tZWRpYXRlLCB0aGlzLnJhbS5yZWFkKGFkZHIpKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4YjAgLSAweGJGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4YjA6IEJDUyAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKVxuXG4gICAgY29uc3QgYWRkciA9IHJlbGF0aXZlKClcblxuICAgIGNvbnN0IEJDUyA9IEluc3RydWN0aW9ucy5CQ1MuYmluZCh0aGlzKVxuICAgIEJDUyhhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoQkNTLCByZWxhdGl2ZSwgYWRkcilcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAnOCcsXG4gICc5JyxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgLyogMHhiZDogTERBIEFic29sdXRlbSBYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFic29sdXRlWCA9IEFkZHJlc3NpbmcuYWJzb2x1dGVYLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGVYKClcblxuICAgIGNvbnN0IExEQSA9IEluc3RydWN0aW9ucy5MREEuYmluZCh0aGlzKVxuICAgIExEQShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERBLCBhYnNvbHV0ZVgsIGFkZHIpXG4gIH0sXG4gICdlJyxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4YzAgLSAweGNGICovXG5leHBvcnQgZGVmYXVsdCBbJzAnLCAnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsICc4JyxcbiAgLyogMHhjOTogQ01QIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBpbW1lZGlhdGUgPSBBZGRyZXNzaW5nLmltbWVkaWF0ZS5iaW5kKHRoaXMpXG4gICAgY29uc3QgYWRkciA9IGltbWVkaWF0ZSgpXG5cbiAgICBjb25zdCBDTVAgPSBJbnN0cnVjdGlvbnMuQ01QLmJpbmQodGhpcylcbiAgICBDTVAoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKENNUCwgaW1tZWRpYXRlLCBhZGRyKVxuICB9LCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSByZWxhdGl2ZSgpXG5cbiAgICBjb25zdCBCTkUgPSBJbnN0cnVjdGlvbnMuQk5FLmJpbmQodGhpcylcbiAgICBCTkUoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJORSwgcmVsYXRpdmUsIGFkZHIpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHhkODogQ0xEICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IENMRCA9IEluc3RydWN0aW9ucy5DTEQuYmluZCh0aGlzKVxuICAgIENMRCgpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhDTEQpXG4gIH0sXG4gICc5JyxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgJ2QnLFxuICAnZScsXG4gICdmJ1xuXVxuIiwiLy9pbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZTAgLSAweGVGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJyxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweGU4OiBJTlggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgSU5YID0gSW5zdHJ1Y3Rpb25zLklOWC5iaW5kKHRoaXMpXG5cbiAgICBJTlgoKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoSU5YKVxuICB9LFxuICAnOScsXG4gIC8qIDB4ZWE6IE5PUCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICAvL+S9leOCguOBl+OBquOBhFxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEluc3RydWN0aW9ucy5OT1AuYmluZCh0aGlzKSlcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZjAgLSAweGZmICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZjA6IEJFUSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSByZWxhdGl2ZSgpXG5cbiAgICBjb25zdCBCRVEgPSBJbnN0cnVjdGlvbnMuQkVRLmJpbmQodGhpcylcbiAgICBCRVEoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJFUSwgcmVsYXRpdmUsIGFkZHIpXG4gIH0sICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JyxcbiAgLyogMHhmODogU0VEICovXG4gIGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBTRUQgPSBJbnN0cnVjdGlvbnMuU0VELmJpbmQodGhpcylcblxuICAgIFNFRCgpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhTRUQpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICcnXG5dXG4iLCJpbXBvcnQgeDB4IGZyb20gJy4vMHgweCdcbmltcG9ydCB4MXggZnJvbSAnLi8weDF4J1xuaW1wb3J0IHgyeCBmcm9tICcuLzB4MngnXG5pbXBvcnQgeDN4IGZyb20gJy4vMHgzeCdcbmltcG9ydCB4NHggZnJvbSAnLi8weDR4J1xuaW1wb3J0IHg1eCBmcm9tICcuLzB4NXgnXG5pbXBvcnQgeDZ4IGZyb20gJy4vMHg2eCdcbmltcG9ydCB4N3ggZnJvbSAnLi8weDd4J1xuaW1wb3J0IHg4eCBmcm9tICcuLzB4OHgnXG5pbXBvcnQgeDl4IGZyb20gJy4vMHg5eCdcbmltcG9ydCB4QXggZnJvbSAnLi8weEF4J1xuaW1wb3J0IHhCeCBmcm9tICcuLzB4QngnXG5pbXBvcnQgeEN4IGZyb20gJy4vMHhDeCdcbmltcG9ydCB4RHggZnJvbSAnLi8weER4J1xuaW1wb3J0IHhFeCBmcm9tICcuLzB4RXgnXG5pbXBvcnQgeEZ4IGZyb20gJy4vMHhGeCdcblxuY29uc3Qgb3Bjb2RlcyA9IFtdLmNvbmNhdChcbiAgeDB4LFxuICB4MXgsXG4gIHgyeCxcbiAgeDN4LFxuICB4NHgsXG4gIHg1eCxcbiAgeDZ4LFxuICB4N3gsXG4gIHg4eCxcbiAgeDl4LFxuICB4QXgsXG4gIHhCeCxcbiAgeEN4LFxuICB4RHgsXG4gIHhFeCxcbiAgeEZ4XG4pXG5cbmV4cG9ydCBkZWZhdWx0IG9wY29kZXNcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgaXNOb2RlanM6ICgpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJ1xuICB9XG59XG4iLCJpbXBvcnQgUmVnaXN0ZXJzIGZyb20gJy4vcmVnaXN0ZXJzJ1xuaW1wb3J0IFJhbSBmcm9tICcuL3JhbSdcbmltcG9ydCBvcGNvZGVzIGZyb20gJy4vb3Bjb2RlcydcbmltcG9ydCBVdGlsIGZyb20gJy4uL3V0aWwnXG5cbi8qIDY1MDIgQ1BVICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDcHUge1xuICBjb25zdHJ1Y3Rvcihpc0RlYnVnKSB7XG4gICAgdGhpcy5pbml0KClcbiAgICB0aGlzLmlzRGVidWcgPSBpc0RlYnVnXG4gIH1cblxuICBpbml0KCkge1xuICAgIHRoaXMucmVnaXN0ZXJzID0gbmV3IFJlZ2lzdGVycygpXG4gICAgLy90aGlzLm9wY29kZXMgPSBvcGNvZGVzXG4gICAgdGhpcy5vcGNvZGVzID0gb3Bjb2Rlcy5tYXAob3Bjb2RlID0+IHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb3Bjb2RlID09PSAnZnVuY3Rpb24nID8gb3Bjb2RlLmJpbmQodGhpcykgOiBvcGNvZGVcbiAgICB9KVxuXG4gICAgdGhpcy5yYW0gPSBuZXcgUmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgdGhpcy5yYW0uY29ubmVjdChwYXJ0cylcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaW5pdCgpXG4gICAgdGhpcy5ydW4oKVxuICB9XG5cbiAgcnVuKCkge1xuICAgIGNvbnN0IGV4ZWN1dGUgPSB0aGlzLmlzRGVidWcgPyB0aGlzLmRlYnVnLmJpbmQodGhpcykgOiB0aGlzLmV2YWwuYmluZCh0aGlzKVxuXG4gICAgVXRpbC5pc05vZGVqcygpID8gc2V0SW50ZXJ2YWwoZXhlY3V0ZSwgMTAwKSA6IGV4ZWN1dGUoKVxuICB9XG5cbiAgLy8g5ZG95Luk44KS5Yem55CG44GZ44KLXG4gIGV2YWwoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBvcGNvZGUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG5cbiAgICB0aGlzLm9wY29kZXNbb3Bjb2RlXS5jYWxsKClcblxuICAgIGNvbnN0IGZuID0gdGhpcy5ldmFsLmJpbmQodGhpcylcblxuICAgIGlmICghVXRpbC5pc05vZGVqcygpKSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZuKVxuICB9XG5cbiAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICBkZWJ1ZygpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIC8vY29uc3Qgb3Bjb2RlID0gdGhpcy5tZW1vcnlbaV1cbiAgICBjb25zdCBvcGNvZGUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG5cbiAgICBpZiAodHlwZW9mIHRoaXMub3Bjb2Rlc1tvcGNvZGVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdOb3QgaW1wbGVtZW50ZWQ6ICcgKyBvcGNvZGUudG9TdHJpbmcoMTYpKVxuICAgICAgY29uc29sZS5lcnJvcih0aGlzLm9wY29kZXNbb3Bjb2RlXSlcbiAgICB9XG5cbiAgICBjb25zdCBkZWJ1Z1N0cmluZyA9IHRoaXMub3Bjb2Rlc1tvcGNvZGVdLmNhbGwoKVxuICAgIGNvbnNvbGUubG9nKCckJyArIGFkZHIudG9TdHJpbmcoMTYpICsgJzonICsgZGVidWdTdHJpbmcpXG5cbiAgICBjb25zdCBmbiA9IHRoaXMuZGVidWcuYmluZCh0aGlzKVxuXG4gICAgaWYgKCFVdGlsLmlzTm9kZWpzKCkpIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZm4pXG4gIH1cblxuICAvKiAweDgwMDB+44Gu44Oh44Oi44Oq44GrUk9N5YaF44GuUFJHLVJPTeOCkuiqreOBv+i+vOOCgCovXG4gIHNldCBwcmdSb20ocHJnUm9tKSB7XG4gICAgLy90aGlzLmludGVycnVwdFZlY3RvcnMocHJnUm9tKVxuICAgIGNvbnN0IHN0YXJ0QWRkciA9IDB4ZmZmZiAtIHByZ1JvbS5sZW5ndGhcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IHN0YXJ0QWRkclxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmdSb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vdGhpcy5tZW1vcnlbc3RhcnRBZGRyK2ldID0gcHJnUm9tW2ldXG4gICAgICB0aGlzLnJhbS53cml0ZShzdGFydEFkZHIgKyBpLCBwcmdSb21baV0pXG4gICAgfVxuXG4gIH1cblxuICAvKiAvL1RPRE8g5Ymy44KK6L6844G/44OZ44Kv44K/44Gu6Kit5a6a44KS6KGM44GGXG4gICAqIE5NSVx0ICAgIDB4RkZGQVx0MHhGRkZCXG4gICAqIFJFU0VUXHQgIDB4RkZGQ1x0MHhGRkZEXG4gICAqIElSUeOAgUJSS1x0MHhGRkZFXHQweEZGRkZcbiAgICpcbiAgaW50ZXJydXB0VmVjdG9ycyhwcmdSb20pIHtcbiAgICBjb25zdCBzdGFydEFkZHIgPSAweGZmZmYgLSBwcmdSb20ubGVuZ3RoXG5cbiAgICBjb25zdCByZXNldEhpZ2hBZGRyID0gcHJnUm9tWzB4ZmZmYyAtIDB4YzAwMF1cbiAgICBjb25zdCByZXNldExvd0FkZHIgPSBwcmdSb21bMHhmZmZkIC0gMHhjMDAwXVxuICAgIGNvbnN0IFJFU0VUID0gcmVzZXRIaWdoQWRkciA8PCA4IHwgcmVzZXRMb3dBZGRyXG4gIH1cbiAgLyoqL1xuXG4gIC8qIOOCueOCv+ODg+OCr+mgmOWfn+OBq+WvvuOBmeOCi+aTjeS9nCovXG4gIHN0YWNrUHVzaCh2YWx1ZSkge1xuICAgIHRoaXMucmFtLndyaXRlKHRoaXMucmVnaXN0ZXJzLnNwLCB2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zcC0tXG4gIH1cblxuICBzdGFja1BvcCgpIHtcbiAgICByZXR1cm4gdGhpcy5yYW0ucmVhZCgrK3RoaXMucmVnaXN0ZXJzLnNwKVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBWcmFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5tZW1vcnkgPSBuZXcgVWludDhBcnJheSgweDQwMDApXG4gICAgdGhpcy52cCA9IG51bGxcbiAgfVxuXG4gIGNvbm5lY3QocHB1KSB7XG4gICAgdGhpcy5yZWZyZXNoRGlzcGxheSA9IHBwdS5yZWZyZXNoRGlzcGxheS5iaW5kKHBwdSlcbiAgfVxuXG4gIHdyaXRlRnJvbUJ1cyh2YWx1ZSkge1xuICAgIC8vY29uc29sZS5sb2coJ3ZyYW1bJCcgKyB0aGlzLnZwLnRvU3RyaW5nKDE2KSArICddID0gJyArIFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpKVxuICAgIHRoaXMubWVtb3J5W3RoaXMudnBdID0gdmFsdWVcbiAgICB0aGlzLnZwKytcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ICYmIHRoaXMucmVmcmVzaERpc3BsYXkoKVxuICB9XG5cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlXG4gIH1cblxuICByZWFkKGFkZHIpIHtcbiAgICByZXR1cm4gdGhpcy5tZW1vcnlbYWRkcl1cbiAgfVxufVxuIiwiaW1wb3J0IFZyYW0gZnJvbSAnLi92cmFtJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcHUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmluaXQoKVxuICB9XG5cbiAgaW5pdCgpIHtcbiAgICAvKiBBYm91dCBWUkFNXG4gICAgICogMHgwMDAwIC0gMHgwZmZmIDogUGF0dGVybiB0YWJsZSAwXG4gICAgICogMHgxMDAwIC0gMHgxZmZmIDogUGF0dGVybiB0YWJsZSAxXG4gICAgICogMHgyMDAwIC0gMHgyM2JmIDogTmFtZSB0YWJsZSAwXG4gICAgICogMHgyM2MwIC0gMHgyM2ZmIDogQXR0cmlidXRlIHRhYmxlIDBcbiAgICAgKiAweDI0MDAgLSAweDI3YmYgOiBOYW1lIHRhYmxlIDFcbiAgICAgKiAweDJiYzAgLSAweDJiYmYgOiBBdHRyaWJ1dGUgdGFibGUgMVxuICAgICAqIDB4MmMwMCAtIDB4MmZiZiA6IE5hbWUgdGFibGUgMlxuICAgICAqIDB4MmJjMCAtIDB4MmJmZiA6IEF0dHJpYnV0ZSB0YWJsZSAyXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAzXG4gICAgICogMHgyZmMwIC0gMHgyZmZmIDogQXR0cmlidXRlIHRhYmxlIDNcbiAgICAgKiAweDMwMDAgLSAweDNlZmYgOiBNaXJyb3Igb2YgMHgyMDAwIC0gMHgyZmZmXG4gICAgICogMHgzZjAwIC0gMHgzZjBmIDogQmFja2dyb3VuZCBwYWxldHRlXG4gICAgICogMHgzZjEwIC0gMHgzZjFmIDogU3ByaXRlIHBhbGV0dGVcbiAgICAgKiAweDNmMjAgLSAweDNmZmYgOiBNaXJyb3Igb2YgMHgzZjAwIDAgMHgzZjFmXG4gICAgICogKi9cbiAgICB0aGlzLnZyYW0gPSBuZXcgVnJhbSgpXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgaWYgKHBhcnRzLmJ1cykge1xuICAgICAgcGFydHMuYnVzLmNvbm5lY3QoeyB2cmFtOiB0aGlzLnZyYW0gfSlcbiAgICB9XG5cbiAgICBpZiAocGFydHMucmVuZGVyZXIpIHtcbiAgICAgIHRoaXMucmVuZGVyZXIgPSBwYXJ0cy5yZW5kZXJlclxuICAgICAgdGhpcy52cmFtLmNvbm5lY3QodGhpcylcbiAgICB9XG4gIH1cblxuICAvKiAkMjAwMCAtICQyM0JG44Gu44ON44O844Og44OG44O844OW44Or44KS5pu05paw44GZ44KLICovXG4gIHJlZnJlc2hEaXNwbGF5KCkge1xuICAgIC8qIOOCv+OCpOODqyg4eDgp44KSMzIqMzDlgIsgKi9cbiAgICBmb3IgKGxldCBpID0gMHgyMDAwOyBpIDw9IDB4MjNiZjsgaSsrKSB7XG4gICAgICBjb25zdCB0aWxlSWQgPSB0aGlzLnZyYW0ucmVhZChpKVxuICAgICAgLyog44K/44Kk44Or44KS5oyH5a6aICovXG4gICAgICBjb25zdCB0aWxlID0gdGhpcy50aWxlc1t0aWxlSWRdXG4gICAgICAvKiDjgr/jgqTjg6vjgYzkvb/nlKjjgZnjgovjg5Hjg6zjg4Pjg4jjgpLlj5blvpcgKi9cbiAgICAgIGNvbnN0IHBhbGV0dGVJZCA9IHRoaXMuc2VsZWN0UGFsZXR0ZSh0aWxlSWQpXG4gICAgICBjb25zdCBwYWxldHRlID0gdGhpcy5zZWxlY3RCYWNrZ3JvdW5kUGFsZXR0ZXMocGFsZXR0ZUlkKVxuXG4gICAgICAvKiDjgr/jgqTjg6vjgajjg5Hjg6zjg4Pjg4jjgpJSZW5kZXJlcuOBq+a4oeOBmSAqL1xuICAgICAgdGhpcy5yZW5kZXJlci53cml0ZSh0aWxlLCBwYWxldHRlKVxuICAgIH1cbiAgfVxuXG4gIC8qIDB4MDAwMCAtIDB4MWZmZuOBruODoeODouODquOBq0NIUi1ST03jgpLoqq3jgb/ovrzjgoAgKi9cbiAgc2V0IGNoclJvbShjaHJSb20pIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoclJvbS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy52cmFtLndyaXRlKGksIGNoclJvbVtpXSlcbiAgICB9XG5cbiAgICAvKiBDSFLpoJjln5/jgYvjgonjgr/jgqTjg6vjgpLmir3lh7rjgZfjgabjgYrjgY8gKi9cbiAgICB0aGlzLmV4dHJhY3RUaWxlcygpXG4gIH1cblxuICAvLyA4eDjjga7jgr/jgqTjg6vjgpLjgZnjgbnjgaZ2cmFt44GuQ0hS44GL44KJ5oq95Ye644GX44Gm44GK44GPXG4gIGV4dHJhY3RUaWxlcygpIHtcbiAgICB0aGlzLnRpbGVzID0gW11cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDB4MWZmZjsgKSB7XG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIvkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGxvd2VyQml0TGluZXMgPSBbXVxuICAgICAgZm9yIChsZXQgaCA9IDA7IGggPCA4OyBoKyspIHtcbiAgICAgICAgbGV0IGJ5dGUgPSB0aGlzLnZyYW0ucmVhZChpKyspXG4gICAgICAgIGNvbnN0IGxpbmUgPSBbXVxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IGJpdCA9IGJ5dGUgJiAweDAxXG4gICAgICAgICAgbGluZS51bnNoaWZ0KGJpdClcbiAgICAgICAgICBieXRlID0gYnl0ZSA+PiAxXG4gICAgICAgIH1cblxuICAgICAgICBsb3dlckJpdExpbmVzLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgLy8g44K/44Kk44Or44Gu5LiK5L2N44OT44OD44OIXG4gICAgICBjb25zdCBoaWdoZXJCaXRMaW5lcyA9IFtdXG4gICAgICBmb3IgKGxldCBoID0gMDsgaCA8IDg7IGgrKykge1xuICAgICAgICBsZXQgYnl0ZSA9IHRoaXMudnJhbS5yZWFkKGkrKylcbiAgICAgICAgY29uc3QgbGluZSA9IFtdXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0IDw8IDEpXG4gICAgICAgICAgYnl0ZSA9IGJ5dGUgPj4gMVxuICAgICAgICB9XG5cbiAgICAgICAgaGlnaGVyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDkuIrkvY3jg5Pjg4Pjg4jjgajkuIvkvY3jg5Pjg4Pjg4jjgpLlkIjmiJDjgZnjgotcbiAgICAgIGNvbnN0IHBlcmZlY3RCaXRzID0gW11cbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgcGVyZmVjdEJpdCA9IGxvd2VyQml0TGluZXNbaF1bal0gfCBoaWdoZXJCaXRMaW5lc1toXVtqXVxuICAgICAgICAgIHBlcmZlY3RCaXRzLnB1c2gocGVyZmVjdEJpdClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy50aWxlcy5wdXNoKHBlcmZlY3RCaXRzKVxuICAgIH1cbiAgfVxuXG4gIC8qIOWxnuaAp+ODhuODvOODluODq+OBi+OCieipsuW9k+ODkeODrOODg+ODiOOBrueVquWPt+OCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RQYWxldHRlKG4pIHtcbiAgICBjb25zdCBibG9ja1Bvc2l0aW9uID0gKChuIC0gKG4gJSA2NCkpIC8gNjQpICogOCArICgobiAlIDY0KSAtIChuICUgNCkpIC8gNFxuICAgIGNvbnN0IGJpdFBvc2l0aW9uID0gbiAlIDRcbiAgICBjb25zdCBzdGFydCA9IDB4MjNjMFxuXG4gICAgY29uc3QgYmxvY2sgPSB0aGlzLnZyYW0ucmVhZChzdGFydCArIGJsb2NrUG9zaXRpb24pXG4gICAgY29uc3QgYml0ID0gKGJsb2NrID4+IGJpdFBvc2l0aW9uKSAmIDB4MDNcblxuICAgIHJldHVybiBiaXRcbiAgfVxuXG4gIC8qICQzRjAwLSQzRjBG44GL44KJ44OQ44OD44Kv44Kw44Op44Km44Oz44OJKOiDjOaZrynjg5Hjg6zjg4Pjg4jjgpLlj5blvpfjgZnjgosgKi9cbiAgc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMDAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjAwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgcGFsZXR0ZS5wdXNoKHRoaXMudnJhbS5yZWFkKGkpKVxuICAgIH1cblxuICAgIHJldHVybiBwYWxldHRlXG4gIH1cblxuICAvKiAkM0YxMC0kM0YxRuOBi+OCieOCueODl+ODqeOCpOODiOODkeODrOODg+ODiOOCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RTcHJpdGVQYWxldHRzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMTAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjEwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgcGFsZXR0ZS5wdXNoKHRoaXMudnJhbS5yZWFkKGkpKVxuICAgIH1cblxuICAgIHJldHVybiBwYWxldHRlXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1cyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuYnVmZmVyID0ge31cbiAgICB0aGlzLnZyYW1BZGRyXyA9IFtdXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMudnJhbSAmJiAodGhpcy52cmFtID0gcGFydHMudnJhbSlcbiAgfVxuXG4gIC8qIENQVeWBtOOBi+OCieOBruOBv+OBl+OBi+iAg+aFruOBl+OBpuOBquOBhCAqL1xuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIHN3aXRjaCAoYWRkcikge1xuICAgICAgY2FzZSAweDIwMDY6XG4gICAgICAgIHRoaXMudnJhbUFkZHIgPSB2YWx1ZVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAweDIwMDc6XG4gICAgICAgIHRoaXMudnJhbS53cml0ZUZyb21CdXModmFsdWUpXG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmJ1ZmZlclthZGRyXSA9IHZhbHVlXG4gICAgfVxuICB9XG5cbiAgcmVhZChhZGRyKSB7XG4gICAgc3dpdGNoIChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgcmV0dXJuIHRoaXMudnJhbUFkZHJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1cyBvZiB0aGlzIGFkZHIgaXMgTm90IGltcGxlbWVudGVkJylcbiAgICB9XG4gIH1cblxuICBzZXQgdnJhbUFkZHIoYWRkcikge1xuICAgIGlmICh0aGlzLnZyYW1BZGRyXy5sZW5ndGggPCAxKSB7XG4gICAgICB0aGlzLnZyYW1BZGRyXy5wdXNoKGFkZHIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudnJhbUFkZHJfLnB1c2goYWRkcilcbiAgICAgIHRoaXMudnJhbS52cCA9IHRoaXMudnJhbUFkZHJcbiAgICAgIHRoaXMudnJhbUFkZHJfLmxlbmd0aCA9IDBcbiAgICB9XG4gIH1cblxuICBnZXQgdnJhbUFkZHIoKSB7XG4gICAgcmV0dXJuICh0aGlzLnZyYW1BZGRyX1swXSA8PCA4KSArIHRoaXMudnJhbUFkZHJfWzFdXG4gIH1cbn1cbiIsImltcG9ydCBDcHUgZnJvbSAnLi9jcHUnXG5pbXBvcnQgUHB1IGZyb20gJy4vcHB1J1xuaW1wb3J0IEJ1cyBmcm9tICcuL2J1cydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTmVzIHtcbiAgY29uc3RydWN0b3IoaXNEZWJ1Zykge1xuICAgIHRoaXMuY3B1ID0gbmV3IENwdShpc0RlYnVnKVxuICAgIHRoaXMucHB1ID0gbmV3IFBwdSgpXG4gICAgdGhpcy5idXMgPSBuZXcgQnVzKClcbiAgICB0aGlzLnBwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICAgIHRoaXMuY3B1LmNvbm5lY3QoeyBidXM6IHRoaXMuYnVzIH0pXG4gIH1cblxuICBjb25uZWN0KHJlbmRlcmVyKSB7XG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IHJlbmRlcmVyIH0pXG4gIH1cblxuICBnZXQgcm9tKCkge1xuICAgIHJldHVybiB0aGlzLl9yb21cbiAgfVxuXG4gIHNldCByb20ocm9tKSB7XG4gICAgdGhpcy5fcm9tID0gcm9tXG4gIH1cblxuICBydW4oaXNEZWJ1Zykge1xuICAgIHRoaXMuY3B1LnByZ1JvbSA9IHRoaXMucm9tLnByZ1JvbVxuICAgIHRoaXMucHB1LmNoclJvbSA9IHRoaXMucm9tLmNoclJvbVxuXG4gICAgdGhpcy5jcHUucnVuKGlzRGVidWcpXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvbSB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmNoZWNrKGRhdGEpXG4gICAgdGhpcy5kYXRhID0gZGF0YVxuICB9XG5cbiAgY2hlY2soZGF0YSkge1xuICAgIGlmICghdGhpcy5pc05lc1JvbShkYXRhKSkgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGlzIG5vdCBORVMgUk9NLicpXG4gIH1cblxuICBnZXQgTkVTX1JPTV9IRUFERVJfU0laRSgpIHtcbiAgICByZXR1cm4gMHgxMFxuICB9XG5cbiAgZ2V0IE5VTUJFUl9PRl9QUkdfUk9NX0JMT0NLUygpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdOdW1iZXIgb2YgUFJHLVJPTSBibG9ja3M6ICcgKyB0aGlzLmRhdGFbNF0pXG4gICAgcmV0dXJuIHRoaXMuZGF0YVs0XVxuICB9XG5cbiAgZ2V0IE5VTUJFUl9PRl9DSFJfUk9NX0JMT0NLUygpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdOdW1iZXIgb2YgQ0hSLVJPTSBibG9ja3M6ICcgKyB0aGlzLmRhdGFbNV0pXG4gICAgcmV0dXJuIHRoaXMuZGF0YVs1XVxuICB9XG5cbiAgZ2V0IFNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5ORVNfUk9NX0hFQURFUl9TSVpFICsgdGhpcy5TSVpFX09GX1BSR19ST01cbiAgfVxuXG4gIGdldCBFTkRfQUREUkVTU19PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSArIHRoaXMuU0laRV9PRl9DSFJfUk9NXG4gIH1cblxuICAvKiBQUkcgUk9N44Gu44K144Kk44K644KS5Y+W5b6X44GZ44KLXG4gICAqKiBST03jg5jjg4Pjg4Djga4x44GL44KJ5pWw44GI44GmNUJ5dGXnm67jga7lgKTjgasxNktpKOOCreODkynjgpLjgYvjgZHjgZ/jgrXjgqTjgrogKi9cbiAgZ2V0IFNJWkVfT0ZfUFJHX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5OVU1CRVJfT0ZfUFJHX1JPTV9CTE9DS1MgKiAweDQwMDBcbiAgfVxuXG4gIC8qIFBSRyBST03jgavlkIzjgZgqL1xuICBnZXQgU0laRV9PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLk5VTUJFUl9PRl9DSFJfUk9NX0JMT0NLUyAqIDB4MjAwMFxuICB9XG5cbiAgLyogUk9N44GL44KJcHJnUk9N44Gr6Kmy5b2T44GZ44KL44Go44GT44KN44KS5YiH44KK5Ye644GZXG4gICAqKiBwcmdST03jga/jg5jjg4Pjg4DpoJjln5/jga7mrKHjga5CeXRl44GL44KJ5aeL44G+44KLICovXG4gIGdldCBwcmdSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZShcbiAgICAgIHRoaXMuTkVTX1JPTV9IRUFERVJfU0laRSxcbiAgICAgIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NIC0gMVxuICAgIClcbiAgfVxuXG4gIC8qIFJPTeOBi+OCiWNoclJPTeOBq+ipsuW9k+OBmeOCi+OBqOOBk+OCjeOCkuWIh+OCiuWHuuOBmVxuICAgKiogY2hyUm9t44GvcHJnUm9t44Gu5b6M44GL44KJ5aeL44G+44KLICovXG4gIGdldCBjaHJSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZShcbiAgICAgIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NLFxuICAgICAgdGhpcy5FTkRfQUREUkVTU19PRl9DSFJfUk9NIC0gMVxuICAgIClcbiAgfVxuXG4gIC8qIOODh+ODvOOCv+OBruODmOODg+ODgOOBqydORVMn44GM44GC44KL44GL44Gp44GG44GL44GnTkVT44GuUk9N44GL5Yik5Yil44GZ44KLICovXG4gIGlzTmVzUm9tKGRhdGEpIHtcbiAgICBjb25zdCBoZWFkZXIgPSBkYXRhLnNsaWNlKDAsIDMpXG4gICAgY29uc3QgaGVhZGVyU3RyID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBoZWFkZXIpXG5cbiAgICByZXR1cm4gaGVhZGVyU3RyID09PSAnTkVTJ1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBbXG4gIFsweDc1LCAweDc1LCAweDc1XSxcbiAgWzB4MjcsIDB4MWIsIDB4OGZdLFxuICBbMHgwMCwgMHgwMCwgMHhhYl0sXG4gIFsweDQ3LCAweDAwLCAweDlmXSxcbiAgWzB4OGYsIDB4MDAsIDB4NzddLFxuICBbMHhhYiwgMHgwMCwgMHgxM10sXG4gIFsweGE3LCAweDAwLCAweDAwXSxcbiAgWzB4N2YsIDB4MGIsIDB4MDBdLFxuICBbMHg0MywgMHgyZiwgMHgwMF0sXG4gIFsweDAwLCAweDQ3LCAweDAwXSxcbiAgWzB4MDAsIDB4NTEsIDB4MDBdLFxuICBbMHgwMCwgMHgzZiwgMHgxN10sXG4gIFsweDFiLCAweDNmLCAweDVmXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICBbMHgwMCwgMHg3MywgMHhlZl0sXG4gIFsweDIzLCAweDNiLCAweGVmXSxcbiAgWzB4ODMsIDB4MDAsIDB4ZjNdLFxuICBbMHhiZiwgMHgwMCwgMHhiZl0sXG4gIFsweGU3LCAweDAwLCAweDViXSxcbiAgWzB4ZGIsIDB4MmIsIDB4MDBdLFxuICBbMHhjYiwgMHg0ZiwgMHgwZl0sXG4gIFsweDhiLCAweDczLCAweDAwXSxcbiAgWzB4MDAsIDB4OTcsIDB4MDBdLFxuICBbMHgwMCwgMHhhYiwgMHgwMF0sXG4gIFsweDAwLCAweDkzLCAweDNiXSxcbiAgWzB4MDAsIDB4ODMsIDB4OGJdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHhmZiwgMHhmZiwgMHhmZl0sXG4gIFsweDNmLCAweGJmLCAweGZmXSxcbiAgWzB4NWYsIDB4NzMsIDB4ZmZdLFxuICBbMHhhNywgMHg4YiwgMHhmZF0sXG4gIFsweGY3LCAweDdiLCAweGZmXSxcbiAgWzB4ZmYsIDB4NzcsIDB4YjddLFxuICBbMHhmZiwgMHg3NywgMHg2M10sXG4gIFsweGZmLCAweDliLCAweDNiXSxcbiAgWzB4ZjMsIDB4YmYsIDB4M2ZdLFxuICBbMHg4MywgMHhkMywgMHgxM10sXG4gIFsweDRmLCAweGRmLCAweDRiXSxcbiAgWzB4NTgsIDB4ZjgsIDB4OThdLFxuICBbMHgwMCwgMHhlYiwgMHhkYl0sXG4gIFsweDc1LCAweDc1LCAweDc1XSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweGZmLCAweGZmLCAweGZmXSxcbiAgWzB4YWIsIDB4ZTcsIDB4ZmZdLFxuICBbMHhjNywgMHhkNywgMHhmZl0sXG4gIFsweGQ3LCAweGNiLCAweGZmXSxcbiAgWzB4ZmYsIDB4YzcsIDB4ZmZdLFxuICBbMHhmZiwgMHhjNywgMHhkYl0sXG4gIFsweGZmLCAweGJmLCAweGIzXSxcbiAgWzB4ZmYsIDB4ZGIsIDB4YWJdLFxuICBbMHhmZiwgMHhlNywgMHhhM10sXG4gIFsweGUzLCAweGZmLCAweGEzXSxcbiAgWzB4YWIsIDB4ZjMsIDB4YmZdLFxuICBbMHhiMywgMHhmZiwgMHhjZl0sXG4gIFsweDlmLCAweGZmLCAweGYzXSxcbiAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXVxuXVxuIiwiaW1wb3J0IGNvbG9ycyBmcm9tICcuL2NvbG9ycydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVuZGVyZXIge1xuICBjb25zdHJ1Y3RvcihpZCkge1xuICAgIGlmICghaWQpIHRocm93IG5ldyBFcnJvcihcIklkIG9mIGNhbnZhcyB0YWcgaXNuJ3Qgc3BlY2lmaWVkLlwiKVxuXG4gICAgbGV0IGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKVxuICAgIHRoaXMuY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgdGhpcy5wb2ludGVyID0gMFxuICAgIHRoaXMud2lkdGggPSAzMlxuICAgIHRoaXMuaGVpZ2h0ID0gMzBcbiAgfVxuXG4gIHdyaXRlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuZ2VuZXJhdGVUaWxlSW1hZ2UodGlsZSwgcGFsZXR0ZSlcbiAgICBjb25zdCB4ID0gKHRoaXMucG9pbnRlciAlIHRoaXMud2lkdGgpICogOFxuICAgIGNvbnN0IHkgPSAoKHRoaXMucG9pbnRlciAtICh0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSkgLyB0aGlzLndpZHRoKSAqIDhcblxuICAgIGlmICh0aGlzLnBvaW50ZXIgPCB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgLSAxKSB7XG4gICAgICB0aGlzLnBvaW50ZXIrK1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBvaW50ZXIgPSAwXG4gICAgfVxuXG4gICAgdGhpcy5jb250ZXh0LnB1dEltYWdlRGF0YShpbWFnZSwgeCwgeSlcbiAgfVxuXG4gIGdlbmVyYXRlVGlsZUltYWdlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuY29udGV4dC5jcmVhdGVJbWFnZURhdGEoOCwgOClcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjQ7IGkrKykge1xuICAgICAgY29uc3QgYml0ID0gdGlsZVtpXVxuICAgICAgY29uc3QgY29sb3IgPSB0aGlzLmNvbG9yKHBhbGV0dGVbYml0XSlcblxuICAgICAgaW1hZ2UuZGF0YVtpICogNF0gPSBjb2xvclswXVxuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDFdID0gY29sb3JbMV1cbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAyXSA9IGNvbG9yWzJdXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgM10gPSAyNTUgLy8g6YCP5piO5bqmXG4gICAgfVxuXG4gICAgcmV0dXJuIGltYWdlXG4gIH1cblxuICBjb2xvcihjb2xvcklkKSB7XG4gICAgcmV0dXJuIGNvbG9yc1tjb2xvcklkXVxuICB9XG59XG4iLCJpbXBvcnQgTmVzXyBmcm9tICcuL25lcydcbmltcG9ydCBSb21fIGZyb20gJy4vcm9tJ1xuaW1wb3J0IFJlbmRlcmVyXyBmcm9tICcuL3JlbmRlcmVyJ1xuXG5leHBvcnQgY29uc3QgTmVzID0gTmVzX1xuZXhwb3J0IGNvbnN0IFJvbSA9IFJvbV9cbmV4cG9ydCBjb25zdCBSZW5kZXJlciA9IFJlbmRlcmVyX1xuIl0sIm5hbWVzIjpbIlV0aWwiLCJSZWdpc3RlcnMiLCJOZXMiLCJOZXNfIiwiUm9tIiwiUm9tXyIsIlJlbmRlcmVyIiwiUmVuZGVyZXJfIl0sIm1hcHBpbmdzIjoiOzs7Ozs7RUFBZSxNQUFNLFFBQVEsQ0FBQztFQUM5QixFQUFFLFdBQVcsR0FBRztFQUNoQixJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtFQUNwQixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSTtFQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSTtFQUN2QixJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksT0FBTTtFQUN0QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSTtFQUN2QjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxPQUFNO0VBQ3BCLEdBQUc7O0VBRUgsRUFBRSxJQUFJLGdCQUFnQixHQUFHO0VBQ3pCLElBQUksT0FBTyxJQUFJLENBQUMsT0FBTztFQUN2QixHQUFHOztFQUVILEVBQUUsSUFBSSxHQUFHLEdBQUc7RUFDWixJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUk7RUFDcEIsR0FBRzs7RUFFSCxFQUFFLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRTtFQUNqQixJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBSztFQUNyQixHQUFHOztFQUVILEVBQUUsSUFBSSxNQUFNLEdBQUc7RUFDZixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU87RUFDdkIsR0FBRzs7RUFFSCxFQUFFLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtFQUNwQixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBSztFQUN4QixHQUFHOztFQUVILEVBQUUsSUFBSSxFQUFFLEdBQUc7RUFDWCxJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUc7RUFDbkIsR0FBRzs7RUFFSCxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRTtFQUNoQixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUNwQixHQUFHOztFQUVILEVBQUUsSUFBSSxjQUFjLEdBQUc7RUFDdkIsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQztFQUM1QixHQUFHOztFQUVILEVBQUUsSUFBSSxjQUFjLENBQUMsR0FBRyxFQUFFO0VBQzFCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLGNBQWMsR0FBRztFQUN2QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxjQUFjLENBQUMsR0FBRyxFQUFFO0VBQzFCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLGNBQWMsR0FBRztFQUN2QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxjQUFjLENBQUMsR0FBRyxFQUFFO0VBQzFCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLFdBQVcsR0FBRztFQUNwQixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFO0VBQ3ZCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLGFBQWEsR0FBRztFQUN0QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFO0VBQ3pCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLGVBQWUsR0FBRztFQUN4QixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxlQUFlLENBQUMsR0FBRyxFQUFFO0VBQzNCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLFVBQVUsR0FBRztFQUNuQixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxHQUFHOztFQUVILEVBQUUsSUFBSSxVQUFVLENBQUMsR0FBRyxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxFQUFDO0VBQzFDLEdBQUc7O0VBRUgsRUFBRSxJQUFJLFdBQVcsR0FBRztFQUNwQixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0VBQzlCLEdBQUc7O0VBRUgsRUFBRSxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUU7RUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBRztFQUNyQyxHQUFHO0VBQ0gsQ0FBQzs7RUNsSGMsTUFBTSxHQUFHLENBQUM7RUFDekIsRUFBRSxXQUFXLEdBQUc7RUFDaEIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBQztFQUN6QyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUNqQixJQUFJLEtBQUssQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFDO0VBQ3ZDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0VBQ3JCLElBQUksSUFBSSxJQUFJLElBQUksTUFBTSxJQUFJLElBQUksSUFBSSxNQUFNLEVBQUU7RUFDMUMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFDO0VBQ2pDLE1BQU0sTUFBTTtFQUNaLEtBQUs7O0VBRUw7RUFDQSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBSztFQUM3QixHQUFHOztFQUVIO0VBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFO0VBQ2IsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0VBQzVCLEdBQUc7RUFDSCxDQUFDOztFQzNCYyxNQUFNLElBQUksQ0FBQztFQUMxQixFQUFFLE9BQU8sVUFBVSxDQUFDLEtBQUssRUFBRTtFQUMzQixJQUFJLE9BQU8sS0FBSyxJQUFJLENBQUM7RUFDckIsR0FBRzs7RUFFSCxFQUFFLE9BQU8sTUFBTSxDQUFDLEtBQUssRUFBRTtFQUN2QixJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUM7RUFDL0IsR0FBRzs7RUFFSCxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssRUFBRTtFQUNwQixJQUFJLE9BQU8sS0FBSyxJQUFJLENBQUM7RUFDckIsR0FBRzs7RUFFSCxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssRUFBRTtFQUNwQixJQUFJLE9BQU8sS0FBSyxHQUFHLElBQUk7RUFDdkIsR0FBRztFQUNILENBQUM7O0FDZEQscUJBQWU7RUFDZjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHO0VBQ0g7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLE1BQUs7RUFDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFDO0VBQzVDLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUM7RUFDL0MsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBQztFQUMvQyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFFO0VBQ25DLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsTUFBSztFQUM3QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUM7RUFDL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBQztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQztFQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFDO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQzs7RUFFdEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFNLEVBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxNQUFNLElBQUksRUFBQztFQUMvQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsS0FBSTtFQUN0RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDOztFQUUzRCxJQUFJLEdBQUcsTUFBTSxLQUFLLENBQUMsRUFBRTtFQUNyQixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLEVBQUM7RUFDbkMsS0FBSyxNQUFNO0VBQ1gsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxFQUFDO0VBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0VBQ3JCLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUN0QyxPQUFPLE1BQU07RUFDYixRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLEVBQUM7RUFDdEMsT0FBTztFQUNQLEtBQUs7RUFDTCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0VBQ2pELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0VBQ2pELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLE1BQU0sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLE1BQU0sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLE1BQU0sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLE1BQU0sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDakUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ2pFLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBVztFQUM1QyxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7O0VBRXhDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBRztFQUNwQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUM7RUFDNUQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXO0VBQzVDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksRUFBQzs7RUFFdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksTUFBSztFQUMxRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsSUFBSSxFQUFDO0VBQ2pELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSTs7RUFFMUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBQztFQUM1RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsSUFBSSxFQUFDO0VBQ2pELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsS0FBSTs7RUFFekMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksTUFBSztFQUMxRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXO0VB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QVMsQ0FBQyxFQUFFLEdBQUU7RUFDeEMsSUFBSSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUM7O0VBRTNDLElBQUksTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUU7RUFDekMsSUFBSSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUM7O0VBRTdDLElBQUksTUFBTSxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTs7RUFFcEUsSUFBSSxPQUFPLElBQUksR0FBRyxNQUFNO0VBQ3hCLEdBQUc7O0VBRUgsRUFBRSxRQUFRLEVBQUUsV0FBVztFQUN2QixJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3hDLElBQUksTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDOztFQUUzQyxJQUFJLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3pDLElBQUksTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDOztFQUU3QyxJQUFJLE1BQU0sS0FBSyxHQUFHLE9BQU8sSUFBSSxRQUFRLElBQUksQ0FBQyxFQUFDO0VBQzNDLElBQUksTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQzs7RUFFdkUsSUFBSSxPQUFPLElBQUksR0FBRyxNQUFNO0VBQ3hCLEdBQUc7O0VBRUgsRUFBRSxhQUFhLEVBQUUsV0FBVztFQUM1QixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3RDLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQzdELElBQUksS0FBSyxHQUFHLEtBQUssR0FBRyxPQUFNOztFQUUxQixJQUFJLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUM7O0VBRXZFLElBQUksT0FBTyxJQUFJLEdBQUcsTUFBTTtFQUN4QixHQUFHOztFQUVILEVBQUUsYUFBYSxFQUFFLFdBQVc7RUFDNUIsSUFBSSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRTtFQUN0QyxJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQzs7RUFFdkMsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDO0VBQ3JFLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07O0VBRXZDLElBQUksT0FBTyxJQUFJLEdBQUcsTUFBTTtFQUN4QixHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsUUFBUSxFQUFFLFdBQVc7RUFDdkIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRTtFQUNyQyxJQUFJLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUss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QUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFB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
