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
      this.sp_ = 0x01fd; // スタックポインタ $0100-$01FF, 初期値は0x01fdっぽい
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

    debugString() {
      return [
        this.statusNegative,
        this.statusOverflow,
        this.statusReserved,
        this.statusBreak,
        this.statusDecimal,
        this.statusInterrupt,
        this.statusZero,
        this.statusCarry
      ].join(' ')
    }

    get statusAllRawBits() {
      return this.status_
    }

    set statusAllRawBits(bits) {
      this.status_ = bits;
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
      this.status_ = this.status_ & 0x7f; // 0111 1111
      this.status_ = this.status_ | (bit << 7);
    }

    get statusOverflow() {
      return (this.status_ >> 6) & 0x01
    }

    set statusOverflow(bit) {
      this.status_ = this.status_ & 0xbf; // 1011 1111
      this.status_ = this.status_ | (bit << 6);
    }

    get statusReserved() {
      return (this.status_ >> 5) & 0x01
    }

    set statusReserved(bit) {
      this.status_ = this.status_ & 0xdf; // 1101 1111
      this.status_ = this.status_ | (bit << 5);
    }

    get statusBreak() {
      return (this.status_ >> 4) & 0x01
    }

    set statusBreak(bit) {
      this.status_ = this.status_ & 0xef; // 1110 1111
      this.status_ = this.status_ | (bit << 4);
    }

    get statusDecimal() {
      return (this.status_ >> 3) & 0x01
    }

    set statusDecimal(bit) {
      this.status_ = this.status_ & 0xf7; // 1111 0111
      this.status_ = this.status_ | (bit << 3);
    }

    get statusInterrupt() {
      return (this.status_ >> 2) & 0x01
    }

    set statusInterrupt(bit) {
      this.status_ = this.status_ & 0xfb; // 1111 1011
      this.status_ = this.status_ | (bit << 2);
    }

    get statusZero() {
      return (this.status_ >> 1) & 0x01
    }

    set statusZero(bit) {
      this.status_ = this.status_ & 0xfd; // 1111 1101
      this.status_ = this.status_ | (bit << 1);
    }

    get statusCarry() {
      return this.status_ & 0x01
    }

    set statusCarry(bit) {
      this.status_ = this.status_ & 0xfe; // 1111 1110
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

  var Addressing = {
    implied: function() {
      return null
    },
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

  class Util {
    static isNegative(value) {
      return value >> 7
    }

    static isZero(value) {
      return value === 0x00 & 1
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

    /* *をインクリメント・デクリメントする
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

    /* accとメモリを論理OR演算して結果をaccへ返す */
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
    PHA: function() {
      this.stackPush(this.registers.acc);
    },

    /* ステータス・レジスタをスタックにプッシュ */
    PHP: function() {
      this.stackPush(this.registers.statusAllRawBits);
    },

    /* スタックからaccにポップアップする */
    PLA: function() {
      this.registers.acc = this.stackPop();
    },

    /* スタックからPにポップアップする */
    PLP: function() {
      this.registers.allRawBits = this.stackPop();
    },

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
    CLV: function() {
      this.registers.statusOverflow = 0;
    },

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
    static debugString(instruction, addressing, value_, addrOfOpcode) {
      let prefix = '$';
      let value;

      if (addressing.name === 'bound immediate') {
        prefix = '#$';
        value = this.ram.read(value_);
      } else if(addressing.name === 'bound implied') {
        prefix = '';
        value = '';
      } else {
        value = value_;
      }

      if (value === null || value === undefined) {
        value = '';
      } else {
        value = value.toString(16);
      }

      const chars = [
        this.registers.debugString(),
        ': $' + addrOfOpcode.toString(16),
        ' ',
        instruction.name.split(' ')[1],
        ' ',
        addressing.name.split(' ')[1],
        ' ',
        prefix,
        value
      ].join('');

      // eslint-disable-next-line no-console
      console.log(chars);
    }

    static execute(instructionName, addressingName) {
      let addrOfOpcode;
      if(this.isDebug) {
        addrOfOpcode = this.registers.pc - 1;
      }

      const addressing = Addressing[addressingName].bind(this);
      const addr = addressing.call();

      const instruction = Instructions[instructionName].bind(this, addr);
      instruction.call();

      if(this.isDebug) {
        Util$1.debugString.call(this, instruction, addressing, addr, addrOfOpcode);
      }

    }
  }

  /* 0x00 - 0x0F */
  var x0x = [
    /* 0x00: BRK implied */
    function() {
      Util$1.execute.call(this, 'BRK', 'implied');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    /* 0x06 ASL zeropage */
    function() {
      Util$1.execute.call(this, 'ASL', 'zeropage');
    },
    '7',
    /* 0x08: PHP*/
    function() {
      Util$1.execute.call(this, 'PHP', 'implied');
    },
    /* 0x09: ORA immediate */
    function() {
      Util$1.execute.call(this, 'ORA', 'immediate');
    },
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0x10 - 0x1F */
  var x1x = [
    /* 0x10 BPL relative */
    function() {
      Util$1.execute.call(this, 'BPL', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x18 CLC implied */
    function() {
      Util$1.execute.call(this, 'CLC', 'implied');
    },
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0x20 - 0x2F */
  var x2x = [
    /* 0x20: JSR absolute*/
    function() {
      Util$1.execute.call(this, 'JSR', 'absolute');
    },
    /* 0x21: INC indexIndirect */
    function() {
      Util$1.execute.call(this, 'INC', 'indexIndirect');
    },
    '2',
    '3',
    /* 0x24: BIT zeropage */
    function() {
      Util$1.execute.call(this, 'BIT', 'zeropage');
    },
    '5',
    '6',
    '7',
    /* 0x28: PLP implied */
    function() {
      Util$1.execute.call(this, 'PLP', 'implied');
    },
    /* 0x29: AND Immediate */
    function() {
      Util$1.execute.call(this, 'AND', 'immediate');
    },
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0x30 - 0x3F */
  var x3x = [
    /* 0x30: BMI relative */
    function() {
      Util$1.execute.call(this, 'BMI', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x38: SEC implied */
    function() {
      Util$1.execute.call(this, 'SEC', 'implied');
    },
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

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
    /* 0x48: PHA implied */
    function() {
      Util$1.execute.call(this, 'PHA', 'implied');
    },
    '9',
    'a',
    'b',
    /* 0x4c: JMP Absolute */
    function() {
      Util$1.execute.call(this, 'JMP', 'absolute');
    },
    'd',
    'e',
    'f'
  ];

  /* 0x50 - 0x5F */
  var x5x = [
    /* 0x50: BVC relative */
    function() {
      Util$1.execute.call(this, 'BVC', 'relative');
    },
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0x60 - 0x6F */
  var x6x = [
    /* 0x60: RTS implied */
    function() {
      Util$1.execute.call(this, 'RTS', 'implied');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x68: PLA implied */
    function() {
      Util$1.execute.call(this, 'PLA', 'implied');
    },
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0x70 - 0x7F */
  var x7x = [
    /* 0x70: BVS relative */
    function() {
      Util$1.execute.call(this, 'BVS', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x78: SEI implied */
    function() {
      Util$1.execute.call(this, 'SEI', 'implied');
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
      Util$1.execute.call(this, 'STA', 'zeropage');
    },
    /* 0x86: STX Zeropage */
    function() {
      Util$1.execute.call(this, 'STX', 'zeropage');
    },
    '7',
    /* 0x88: DEY implied */
    function() {
      Util$1.execute.call(this, 'DEY', 'implied');
    },
    '9',
    'a',
    'b',
    'c',
    /* 0x8d: STA absolute */
    function() {
      Util$1.execute.call(this, 'STA', 'absolute');
    },
    'e',
    'f'
  ];

  /* 0x90 - 0x9F */
  var x9x = [
    /* 0x90: BCC relative*/
    function() {
      Util$1.execute.call(this, 'BCC', 'relative');
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
    /* 9A: TXS implied */
    function() {
      Util$1.execute.call(this, 'TXS', 'implied');
    },
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xA0 - 0xAF */
  var xAx = [
    /* 0xA0: LDY immediate*/
    function() {
      Util$1.execute.call(this, 'LDY', 'immediate');
    },
    '1',
    /* 0xA2: LDX immediate */
    function() {
      Util$1.execute.call(this, 'LDX', 'immediate');
    },
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',

    /* 0xA9: LDA immediate */
    function() {
      Util$1.execute.call(this, 'LDA', 'immediate');
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
    /* 0xb0: BCS implied */
    function() {
      Util$1.execute.call(this, 'BCS', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0xb8: CLV implied */
    function () {
      Util$1.execute.call(this, 'CLV', 'implied');
    },
    '9',
    'a',
    'b',
    'c',
    /* 0xbd: LDA AbsoluteX */
    function() {
      Util$1.execute.call(this, 'LDA', 'absoluteX');
    },
    'e',
    'f'
  ];

  /* 0xc0 - 0xcF */
  var xCx = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    /* 0xc9: CMP immediate */
    function() {
      Util$1.execute.call(this, 'CMP', 'immediate');
    },
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xd0 - 0xdF */
  var xDx = [
    /* 0xd0: BNE relative */
    function() {
      Util$1.execute.call(this, 'BNE', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0xd8: CLD implied */
    function() {
      Util$1.execute.call(this, 'CLD', 'implied');
    },
    '9',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f'
  ];

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
    /* 0xe8: INX implied */
    function() {
      Util$1.execute.call(this, 'INX', 'implied');
    },
    '9',
    /* 0xea: NOP implied */
    function() {
      Util$1.execute.call(this, 'NOP', 'implied');
    },
    '',
    '',
    '',
    '',
    ''
  ];

  /* 0xf0 - 0xff */
  var xFx = [
    /* 0xf0: BEQ relative */
    function() {
      Util$1.execute.call(this, 'BEQ', 'relative');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    /* 0xf6: INC zeropageX */
    function() {
      Util$1.execute.call(this, 'INC', 'zeropageX');
    },
    '7',
    /* 0xf8: SED implied */
    function() {
      Util$1.execute.call(this, 'SED', 'implied');
    },
    '',
    '',
    '',
    '',
    '',
    '',
    ''
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
      const execute = this.eval.bind(this);

      Util$2.isNodejs() ? setInterval(execute, 50) : execute();
    }

    // 命令を処理する
    eval() {
      const addr = this.registers.pc++;
      const opcode = this.ram.read(addr);

      if(typeof this.opcodes[opcode] !== 'function') {
        throw new Error('0x' + opcode.toString(16) + ' is not implemented')
      }

      this.opcodes[opcode].call();

      if (!Util$2.isNodejs()) {
        const fn = this.eval.bind(this);
        window.requestAnimationFrame(fn);
      }
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

    run() {
      this.cpu.prgRom = this.rom.prgRom;
      this.ppu.chrRom = this.rom.chrRom;

      this.cpu.run();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9hZGRyZXNzaW5nL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvaW5zdHJ1Y3Rpb25zL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzL3V0aWwuanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgweC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgzeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy91dGlsLmpzIiwiLi4vc3JjL2NwdS9jcHUuanMiLCIuLi9zcmMvcHB1L3ZyYW0uanMiLCIuLi9zcmMvcHB1L3BwdS5qcyIsIi4uL3NyYy9idXMvaW5kZXguanMiLCIuLi9zcmMvbmVzLmpzIiwiLi4vc3JjL3JvbS9pbmRleC5qcyIsIi4uL3NyYy9yZW5kZXJlci9jb2xvcnMuanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVnaXN0ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFjY18gPSAweDAwIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICAgIHRoaXMuaW5kZXhYXyA9IDB4MDAgLy8g44Ki44OJ44Os44OD44K344Oz44Kw44CB44Kr44Km44Oz44K/562J44Gr55So44GE44KLXG4gICAgdGhpcy5pbmRleFlfID0gMHgwMCAvLyDkuIrjgavlkIzjgZhcbiAgICB0aGlzLnNwXyA9IDB4MDFmZCAvLyDjgrnjgr/jg4Pjgq/jg53jgqTjg7Pjgr8gJDAxMDAtJDAxRkYsIOWIneacn+WApOOBrzB4MDFmZOOBo+OBveOBhFxuICAgIHRoaXMuc3RhdHVzXyA9IDB4MzRcbiAgICAvKlxuICAgIHN0YXR1czoge1xuICAgICAgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgICBuZWdhdGl2ZV86IDAsXG4gICAgICBvdmVyZmxvd186IDAsXG4gICAgICByZXNlcnZlZF86IDEsXG4gICAgICBicmVha186IDEsIC8vIOWJsuOCiui+vOOBv0JSS+eZuueUn+aZguOBq3RydWUsSVJR55m655Sf5pmC44GrZmFsc2VcbiAgICAgIGRlY2ltYWxfOiAwLFxuICAgICAgaW50ZXJydXB0XzogMSxcbiAgICAgIHplcm9fOiAwLFxuICAgICAgY2FycnlfOiAwXG4gICAgfVxuICAgICovXG4gICAgdGhpcy5wYyA9IDB4ODAwMCAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr9cbiAgfVxuXG4gIGRlYnVnU3RyaW5nKCkge1xuICAgIHJldHVybiBbXG4gICAgICB0aGlzLnN0YXR1c05lZ2F0aXZlLFxuICAgICAgdGhpcy5zdGF0dXNPdmVyZmxvdyxcbiAgICAgIHRoaXMuc3RhdHVzUmVzZXJ2ZWQsXG4gICAgICB0aGlzLnN0YXR1c0JyZWFrLFxuICAgICAgdGhpcy5zdGF0dXNEZWNpbWFsLFxuICAgICAgdGhpcy5zdGF0dXNJbnRlcnJ1cHQsXG4gICAgICB0aGlzLnN0YXR1c1plcm8sXG4gICAgICB0aGlzLnN0YXR1c0NhcnJ5XG4gICAgXS5qb2luKCcgJylcbiAgfVxuXG4gIGdldCBzdGF0dXNBbGxSYXdCaXRzKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXR1c19cbiAgfVxuXG4gIHNldCBzdGF0dXNBbGxSYXdCaXRzKGJpdHMpIHtcbiAgICB0aGlzLnN0YXR1c18gPSBiaXRzXG4gIH1cblxuICBnZXQgYWNjKCkge1xuICAgIHJldHVybiB0aGlzLmFjY19cbiAgfVxuXG4gIHNldCBhY2ModmFsdWUpIHtcbiAgICB0aGlzLmFjY18gPSB2YWx1ZVxuICB9XG5cbiAgZ2V0IGluZGV4WCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRleFhfXG4gIH1cblxuICBzZXQgaW5kZXhYKHZhbHVlKSB7XG4gICAgdGhpcy5pbmRleFhfID0gdmFsdWVcbiAgfVxuXG4gIGdldCBzcCgpIHtcbiAgICByZXR1cm4gdGhpcy5zcF9cbiAgfVxuXG4gIHNldCBzcCh2YWx1ZSkge1xuICAgIHRoaXMuc3BfID0gdmFsdWVcbiAgfVxuXG4gIGdldCBzdGF0dXNOZWdhdGl2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfID4+IDdcbiAgfVxuXG4gIHNldCBzdGF0dXNOZWdhdGl2ZShiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweDdmIC8vIDAxMTEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNylcbiAgfVxuXG4gIGdldCBzdGF0dXNPdmVyZmxvdygpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA2KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNPdmVyZmxvdyhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGJmIC8vIDEwMTEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNilcbiAgfVxuXG4gIGdldCBzdGF0dXNSZXNlcnZlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA1KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNSZXNlcnZlZChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGRmIC8vIDExMDEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNSlcbiAgfVxuXG4gIGdldCBzdGF0dXNCcmVhaygpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA0KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNCcmVhayhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGVmIC8vIDExMTAgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNClcbiAgfVxuXG4gIGdldCBzdGF0dXNEZWNpbWFsKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDMpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0RlY2ltYWwoYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfICYgMHhmNyAvLyAxMTExIDAxMTFcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCAoYml0IDw8IDMpXG4gIH1cblxuICBnZXQgc3RhdHVzSW50ZXJydXB0KCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDIpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0ludGVycnVwdChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGZiIC8vIDExMTEgMTAxMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgMilcbiAgfVxuXG4gIGdldCBzdGF0dXNaZXJvKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDEpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c1plcm8oYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfICYgMHhmZCAvLyAxMTExIDExMDFcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCAoYml0IDw8IDEpXG4gIH1cblxuICBnZXQgc3RhdHVzQ2FycnkoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzXyAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNDYXJyeShiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGZlIC8vIDExMTEgMTExMFxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IGJpdFxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4MTAwMDApXG4gIH1cblxuICAvKiBNZW1vcnkgbWFwcGVkIEkvT+OBp+OBguOCi+OBn+OCge+8jOODkOOCuShCdXMp44KS5o6l57aa44GX44Gm44GK44GPXG4gICAqIFBQVeetieOBuOOBr0J1c+OCkumAmuOBl+OBpuODh+ODvOOCv+OBruOChOOCiuWPluOCiuOCkuihjOOBhlxuICAgKiAqL1xuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmICh0aGlzLmJ1cyA9IHBhcnRzLmJ1cylcbiAgfVxuXG4gIC8qVE9ETyDlkITjg53jg7zjg4goYWRkcinjgavjgqLjgq/jgrvjgrnjgYzjgYLjgaPjgZ/loLTlkIjjgavjga/jg5Djgrnjgavmm7jjgY3ovrzjgoAgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBpZiAoYWRkciA+PSAweDIwMDAgJiYgYWRkciA8PSAweDIwMDcpIHtcbiAgICAgIHRoaXMuYnVzLndyaXRlKGFkZHIsIHZhbHVlKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8g6YCa5bi444Gu44Oh44Oi44Oq44Ki44Kv44K744K5XG4gICAgdGhpcy5tZW1vcnlbYWRkcl0gPSB2YWx1ZVxuICB9XG5cbiAgLypUT0RPIOOCs+ODs+ODiOODreODvOODqeeUqOOBruODneODvOODiCAqL1xuICByZWFkKGFkZHIpIHtcbiAgICByZXR1cm4gdGhpcy5tZW1vcnlbYWRkcl1cbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICBpbXBsaWVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9LFxuICAvKiA4Yml044Gu5Y2z5YCk44Gq44Gu44Gn44Ki44OJ44Os44K544KS44Gd44Gu44G+44G+6L+U44GZICovXG4gIGltbWVkaWF0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICByZXR1cm4gYWRkclxuICB9LFxuXG4gIC8qIOOCouODieODrOOCuWFkZHIoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2U6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuICAgIHJldHVybiBhZGRyXG4gIH0sXG5cbiAgLyogKOOCouODieODrOOCuWFkZHIgKyDjg6zjgrjjgrnjgr9pbmRleFgpKDhiaXQp44KS6L+U44GZICovXG4gIHplcm9wYWdlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmXG4gIH0sXG5cbiAgLyog5LiK44Go5ZCM44GY44GnaW5kZXhZ44Gr5pu/44GI44KL44Gg44GRKi9cbiAgemVyb3BhZ2VZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICByZXR1cm4gYWRkciAmIDB4ZmZcbiAgfSxcblxuICAvKiB6ZXJvcGFnZeOBrmFkZHLjgYwxNmJpdOeJiCAqL1xuICBhYnNvbHV0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGFkZHIgPSBsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpXG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIGFic29sdXRlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGFkZHIgPSAobG93QWRkciB8IChoaWdoQWRkciA8PCA4KSkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGFkZHJfID0gbG93QWRkciB8IChoaWdoQWRkciA8PCA4KVxuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSB8ICh0aGlzLnJhbS5yZWFkKGFkZHJfICsgMSkgPDwgOClcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgaW5kZXhJbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGxldCBhZGRyXyA9IHRoaXMucmFtLnJlYWQoYWRkcl9fKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIGFkZHJfID0gYWRkcl8gJiAweDAwZmZcblxuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSB8ICh0aGlzLnJhbS5yZWFkKGFkZHJfICsgMSkgPDwgOClcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgaW5kaXJlY3RJbmRleDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pXG5cbiAgICBsZXQgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KVxuICAgIGFkZHIgPSBhZGRyICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIC8qICjjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr8gKyDjgqrjg5Xjgrvjg4Pjg4gp44KS6L+U44GZ44CCXG4gICAqIOOCquODleOCu+ODg+ODiOOBruioiOeul+OBp+OBr+espuWPt+S7mOOBjeOBruWApOOBjOS9v+eUqOOBleOCjOOCi+OAglxuICAgKiDnrKblj7fku5jjgY3jga7lgKTjga9cbiAgICogICAtMTI4KDB4ODApIH4gLTEgKDB4ZmYpXG4gICAqICAgMCgweDAwKSB+IDEyNygweDdmKVxuICAgKiAqL1xuICByZWxhdGl2ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3Qgc2lnbmVkTnVtYmVyID0gdGhpcy5yYW0ucmVhZChhZGRyXylcblxuICAgIGxldCBhZGRyID1cbiAgICAgIHNpZ25lZE51bWJlciA+PSAweDgwXG4gICAgICAgID8gdGhpcy5yZWdpc3RlcnMucGMgKyBzaWduZWROdW1iZXIgLSAweDEwMFxuICAgICAgICA6IHRoaXMucmVnaXN0ZXJzLnBjICsgc2lnbmVkTnVtYmVyXG5cbiAgICByZXR1cm4gYWRkclxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVdGlsIHtcbiAgc3RhdGljIGlzTmVnYXRpdmUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPj4gN1xuICB9XG5cbiAgc3RhdGljIGlzWmVybyh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gMHgwMCAmIDFcbiAgfVxuXG4gIHN0YXRpYyBtc2IodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPj4gN1xuICB9XG5cbiAgc3RhdGljIGxzYih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAmIDB4MDFcbiAgfVxufVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8qIExEKiAoTG9hZCBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZSA6IOioiOeul+e1kOaenOOBjOiyoOOBruWApOOBruOBqOOBjTHjgZ3jgYbjgafjgarjgZHjgozjgbAwKGFjY+OBrjdiaXTnm67jgajlkIzjgZjlgKTjgavjgarjgospXG4gICAqICAgLSB6ZXJvIDog6KiI566X57WQ5p6c44GM44K844Ot44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDBcbiAgICogKi9cbiAgTERBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG4gIC8qIOODrOOCuOOCueOCv2luZGV4WOOBq2RhdGHjgpLjg63jg7zjg4njgZnjgosgKi9cbiAgTERYOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgTERZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogU1QqIChTdG9yZSBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44Kw5pON5L2c44Gv54Sh44GXXG4gICAqICovXG4gIFNUQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgfSxcblxuICBTVFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFgpXG4gIH0sXG5cbiAgU1RZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKVxuICB9LFxuXG4gIC8qIFQqKiAoVHJhbnNmZXIgKiByZWdpc3RlciB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICovXG4gIFRBWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2NcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUQVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFNYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLnNwXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFhBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRYUzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zcCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRZQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBhY2MgJiBtZW1vcnlbYWRkcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gemVyb1xuICAgKiAqL1xuICBBTkQ6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBB44G+44Gf44Gv44Oh44Oi44Oq44KS5bem44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIEFTTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IG1zYiA9IFV0aWwubXNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlIDw8IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gIH0sXG5cbiAgLyogYWNj44G+44Gf44Gv44Oh44Oi44Oq44KS5Y+z44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIExTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IGxzYiA9IFV0aWwubHNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlID4+IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkkFOROa8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nOOBmeOCi1xuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogKi9cbiAgQklUOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgbWVtb3J5ID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgJiBtZW1vcnkpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBtZW1vcnkgPj4gN1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gbWVtb3J5ID4+IDYgJiAweDAxXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkuavlOi8g+a8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nFxuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogQSA9PSBtZW0gLT4gWiA9IDBcbiAgICogQSA+PSBtZW0gLT4gQyA9IDFcbiAgICogQSA8PSBtZW0gLT4gQyA9IDBcbiAgICogKi9cbiAgQ01QOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5yZWdpc3RlcnMuYWNjIC0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgaWYocmVzdWx0ID09PSAwKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gMFxuICAgICAgaWYocmVzdWx0ID4gMCkge1xuICAgICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDFcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMFxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKiBY44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XICovXG4gIENQWDogZnVuY3Rpb24oKSB7fSxcblxuICAvKiBZ44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566XKi9cbiAgQ1BZOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qICrjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjg7vjg4fjgq/jg6rjg6Hjg7Pjg4jjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gemVyb1xuICAgKiAqL1xuICAvKiDjg6Hjg6Ljg6rjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosqL1xuICBJTkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpICsgMSlcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS44OH44Kv44Oq44Oh44Oz44OIICovXG4gIERFQzogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmFtLnJlYWQoYWRkcikgLSAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBY44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYKytcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBZ44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKytcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBY44KS44OH44Kv44Oq44Oh44Oz44OIICovXG4gIERFWDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYLS1cbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBZ44KS44OH44Kv44Oq44Oh44Oz44OIKi9cbiAgREVZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFktLVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhlhPUua8lOeul+OBl+OBpmFjY+OBq+e1kOaenOOCkui/lOOBmSovXG4gIEVPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHRoaXMucmVnaXN0ZXJzLmFjYyBeIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgfSxcblxuICAvKiBhY2Pjgajjg6Hjg6Ljg6rjgpLoq5bnkIZPUua8lOeul+OBl+OBpue1kOaenOOCkmFjY+OBuOi/lOOBmSAqL1xuICBPUkE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB0aGlzLnJlZ2lzdGVycy5hY2MgfCB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS5bem44G444Ot44O844OG44O844OI44GZ44KLICovXG4gIFJPTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGNhcnJ5ID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnlcbiAgICBjb25zdCBtc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpID4+IDdcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgKHRoaXMucmFtLnJlYWQoYWRkcikgPDwgMSkgfCBjYXJyeSlcbiAgfSxcblxuICAvKiBhY2PjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgotcbiAgICog5a6f6KOF44KS6ICD44GI44Gm44CBYWNj44Gu5aC05ZCI44KSUk9M44Go5YiG6Zui44GX44GfXG4gICAqICovXG4gIFJMQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FycnkgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuICAgIGNvbnN0IG1zYiA9IHRoaXMucmVnaXN0ZXJzLmFjYyA+PiA3XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IG1zYlxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgPDwgMSkgfCBjYXJyeVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuWPs+OBuOODreODvOODhuODvOODiOOBmeOCiyAqL1xuICBST1I6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5IDw8IDdcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJhbS5yZWFkKGFkZHIpICYgMHgwMVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSBsc2JcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCAodGhpcy5yYW0ucmVhZChhZGRyKSA+PiAxKSB8IGNhcnJ5KVxuICB9LFxuXG4gIC8qIGFjY+OCkuWPs+OBuOODreODvOODhuODvOODiOOBmeOCi1xuICAgKiDlrp/oo4XjgpLogIPjgYjjgaZhY2Pjga7loLTlkIjjgpJST1LjgajliIbpm6LjgZfjgZ9cbiAgICogKi9cbiAgUlJBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5IDw8IDdcbiAgICBjb25zdCBsc2IgPSB0aGlzLnJlZ2lzdGVycy5hY2MgJiAweDAxXG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IGxzYlxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9ICh0aGlzLnJlZ2lzdGVycy5hY2MgPj4gMSkgfCBjYXJyeVxuICB9LFxuXG4gICAgICAgLyogYWNjICsgbWVtb3J5ICsgY2FycnlGbGFnXG4gICAgICAgICog44OV44Op44KwXG4gICAgICAgICogICAtIG5lZ2F0aXZlXG4gICAgICAgICogICAtIG92ZXJmbG93XG4gICAgICAgICogICAtIHplcm9cbiAgICAgICAgKiAgIC0gY2FycnlcbiAgICAgICAgKiAqL1xuICBBREM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBhZGRlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyArIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBhZGRlZCArIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAoYWRkZWQgPiAweGZmKSAmIDFcbiAgfSxcblxuICAvKiAoYWNjIC0g44Oh44Oi44OqIC0g44Kt44Oj44Oq44O844OV44Op44KwKeOCkua8lOeul+OBl+OBpmFjY+OBuOi/lOOBmSAqL1xuICBTQkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBzdWJlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyAtIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBzdWJlZCAtIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAoc3ViZWQgPCAweDAwKSAmIDFcbiAgfSxcblxuICAvKiBhY2PjgpLjgrnjgr/jg4Pjgq/jgavjg5fjg4Pjgrfjg6UgKi9cbiAgUEhBOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YWNrUHVzaCh0aGlzLnJlZ2lzdGVycy5hY2MpXG4gIH0sXG5cbiAgLyog44K544OG44O844K/44K544O744Os44K444K544K/44KS44K544K/44OD44Kv44Gr44OX44OD44K344OlICovXG4gIFBIUDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGFja1B1c2godGhpcy5yZWdpc3RlcnMuc3RhdHVzQWxsUmF3Qml0cylcbiAgfSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolhY2Pjgavjg53jg4Pjg5fjgqLjg4Pjg5fjgZnjgosgKi9cbiAgUExBOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB0aGlzLnN0YWNrUG9wKClcbiAgfSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolQ44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMUDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWxsUmF3Qml0cyA9IHRoaXMuc3RhY2tQb3AoKVxuICB9LFxuXG4gIC8qIOOCouODieODrOOCueOBuOOCuOODo+ODs+ODl+OBmeOCiyAqL1xuICBKTVA6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgpLlkbzjgbPlh7rjgZlcbiAgICog44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/44KS44K544K/44OD44Kv44Gr56mN44G/44CBYWRkcuOBq+OCuOODo+ODs+ODl+OBmeOCi1xuICAgKiAqL1xuICBKU1I6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjID4+IDhcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yZWdpc3RlcnMucGMgJiAweDAwZmZcblxuICAgIHRoaXMuc3RhY2tQdXNoKGxvd0FkZHIpXG4gICAgdGhpcy5zdGFja1B1c2goaGlnaEFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gIH0sXG5cbiAgLyog44K144OW44Or44O844OB44Oz44GL44KJ5b6p5biw44GZ44KLICovXG4gIFJUUzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnN0YWNrUG9wKClcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5zdGFja1BvcCgpXG4gICAgY29uc3QgYWRkciA9IGhpZ2hBZGRyIDw8IDggfCBsb3dBZGRyXG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gIH0sXG5cbiAgLyog5Ymy44KK6L6844G/44Or44O844OB44Oz44GL44KJ5b6p5biw44GZ44KLICovXG4gIFJUSTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkNDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJDUzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44K844Ot44OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJFUTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm9cblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgrzjg63jg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosqL1xuICBCTkU6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSAhdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVyb1xuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOODjeOCrOODhuOCo+ODluODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCTUk6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOODjeOCrOODhuOCo+ODluODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCUEw6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSAhdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmVcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgqrjg7zjg5Djg7zjg5Xjg63jg7zjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosqL1xuICBCVkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSAhdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3dcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgqrjg7zjg5Djg7zjg5Xjg63jg7zjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQlZTOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3dcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgrvjg4Pjg4jjgZnjgosgKi9cbiAgU0VDOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDFcbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgq/jg6rjgqLjgZfjgb7jgZkgKi9cbiAgQ0xDOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDBcbiAgfSxcblxuICAvKiBJUlHlibLjgorovrzjgb/jgpLoqLHlj6/jgZnjgosgKi9cbiAgQ0xJOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOCkuOCr+ODquOCouOBmeOCiyAqL1xuICBDTFY6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMFxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBq+ioreWumuOBmeOCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgU0VEOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNEZWNpbWFsID0gMVxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBi+OCiemAmuW4uOODouODvOODieOBq+aIu+OCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgQ0xEOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNEZWNpbWFsID0gMFxuICB9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuemgeatouOBmeOCi1xuICAgKiDjg5Xjg6njgrBcbiAgICogaW50ZXJydXB0IOOCkuOCu+ODg+ODiOOBmeOCi1xuICAgKiAqL1xuICBTRUk6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0ludGVycnVwdCA9IDFcbiAgfSxcblxuICAvKiDjgr3jg5Xjg4jjgqbjgqfjgqLlibLjgorovrzjgb/jgpLotbfjgZPjgZkqL1xuICBCUks6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0JyZWFrID0gMVxuICB9LFxuXG4gIC8qIOepuuOBruWRveS7pOOCkuWun+ihjOOBmeOCiyAqL1xuICBOT1A6IGZ1bmN0aW9uKCkge1xuICAgIC8vIOS9leOCguOBl+OBquOBhFxuICB9XG59XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFV0aWwge1xuICBzdGF0aWMgZGVidWdTdHJpbmcoaW5zdHJ1Y3Rpb24sIGFkZHJlc3NpbmcsIHZhbHVlXywgYWRkck9mT3Bjb2RlKSB7XG4gICAgbGV0IHByZWZpeCA9ICckJ1xuICAgIGxldCB2YWx1ZVxuXG4gICAgaWYgKGFkZHJlc3NpbmcubmFtZSA9PT0gJ2JvdW5kIGltbWVkaWF0ZScpIHtcbiAgICAgIHByZWZpeCA9ICcjJCdcbiAgICAgIHZhbHVlID0gdGhpcy5yYW0ucmVhZCh2YWx1ZV8pXG4gICAgfSBlbHNlIGlmKGFkZHJlc3NpbmcubmFtZSA9PT0gJ2JvdW5kIGltcGxpZWQnKSB7XG4gICAgICBwcmVmaXggPSAnJ1xuICAgICAgdmFsdWUgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlX1xuICAgIH1cblxuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YWx1ZSA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoMTYpXG4gICAgfVxuXG4gICAgY29uc3QgY2hhcnMgPSBbXG4gICAgICB0aGlzLnJlZ2lzdGVycy5kZWJ1Z1N0cmluZygpLFxuICAgICAgJzogJCcgKyBhZGRyT2ZPcGNvZGUudG9TdHJpbmcoMTYpLFxuICAgICAgJyAnLFxuICAgICAgaW5zdHJ1Y3Rpb24ubmFtZS5zcGxpdCgnICcpWzFdLFxuICAgICAgJyAnLFxuICAgICAgYWRkcmVzc2luZy5uYW1lLnNwbGl0KCcgJylbMV0sXG4gICAgICAnICcsXG4gICAgICBwcmVmaXgsXG4gICAgICB2YWx1ZVxuICAgIF0uam9pbignJylcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgY29uc29sZS5sb2coY2hhcnMpXG4gIH1cblxuICBzdGF0aWMgZXhlY3V0ZShpbnN0cnVjdGlvbk5hbWUsIGFkZHJlc3NpbmdOYW1lKSB7XG4gICAgbGV0IGFkZHJPZk9wY29kZVxuICAgIGlmKHRoaXMuaXNEZWJ1Zykge1xuICAgICAgYWRkck9mT3Bjb2RlID0gdGhpcy5yZWdpc3RlcnMucGMgLSAxXG4gICAgfVxuXG4gICAgY29uc3QgYWRkcmVzc2luZyA9IEFkZHJlc3NpbmdbYWRkcmVzc2luZ05hbWVdLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gYWRkcmVzc2luZy5jYWxsKClcblxuICAgIGNvbnN0IGluc3RydWN0aW9uID0gSW5zdHJ1Y3Rpb25zW2luc3RydWN0aW9uTmFtZV0uYmluZCh0aGlzLCBhZGRyKVxuICAgIGluc3RydWN0aW9uLmNhbGwoKVxuXG4gICAgaWYodGhpcy5pc0RlYnVnKSB7XG4gICAgICBVdGlsLmRlYnVnU3RyaW5nLmNhbGwodGhpcywgaW5zdHJ1Y3Rpb24sIGFkZHJlc3NpbmcsIGFkZHIsIGFkZHJPZk9wY29kZSlcbiAgICB9XG5cbiAgfVxufVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDAwIC0gMHgwRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDAwOiBCUksgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQlJLJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgLyogMHgwNiBBU0wgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FTTCcsICd6ZXJvcGFnZScpXG4gIH0sXG4gICc3JyxcbiAgLyogMHgwODogUEhQKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BIUCcsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHgwOTogT1JBIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnT1JBJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgxMCAtIDB4MUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgxMCBCUEwgcmVsYXRpdmUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JQTCcsICdyZWxhdGl2ZScpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHgxOCBDTEMgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ0xDJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDIwIC0gMHgyRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDIwOiBKU1IgYWJzb2x1dGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSlNSJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgLyogMHgyMTogSU5DIGluZGV4SW5kaXJlY3QgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0lOQycsICdpbmRleEluZGlyZWN0JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gIC8qIDB4MjQ6IEJJVCB6ZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQklUJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHgyODogUExQIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BMUCcsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHgyOTogQU5EIEltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQU5EJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgzMCAtIDB4M0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgzMDogQk1JIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCTUknLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4Mzg6IFNFQyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTRUMnLCAnaW1wbGllZCcpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4NDAgLSAweDRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJyxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweDQ4OiBQSEEgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUEhBJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnOScsXG4gICdhJyxcbiAgJ2InLFxuICAvKiAweDRjOiBKTVAgQWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0pNUCcsICdhYnNvbHV0ZScpXG4gIH0sXG4gICdkJyxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg1MCAtIDB4NUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg1MDogQlZDIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCVkMnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4NjAgLSAweDZGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4NjA6IFJUUyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdSVFMnLCAnaW1wbGllZCcpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHg2ODogUExBIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BMQScsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg3MDogQlZTIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCVlMnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4Nzg6IFNFSSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTRUknLCAnaW1wbGllZCcpXG4gIH0sXG4gICc5JyxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgJ2QnLFxuICAnZScsXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDgwIC0gMHg4RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHg4NTogU1RBIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVEEnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweDg2OiBTVFggWmVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUWCcsICd6ZXJvcGFnZScpXG4gIH0sXG4gICc3JyxcbiAgLyogMHg4ODogREVZIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFWScsICdpbXBsaWVkJylcbiAgfSxcbiAgJzknLFxuICAnYScsXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweDhkOiBTVEEgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUQScsICdhYnNvbHV0ZScpXG4gIH0sXG4gICdlJyxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwuanMnXG5cbi8qIDB4OTAgLSAweDlGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4OTA6IEJDQyByZWxhdGl2ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCQ0MnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gICc4JyxcbiAgJzknLFxuICAvKiA5QTogVFhTIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1RYUycsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4QTAgLSAweEFGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4QTA6IExEWSBpbW1lZGlhdGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERZJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcxJyxcbiAgLyogMHhBMjogTERYIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERYJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAnOCcsXG5cbiAgLyogMHhBOTogTERBIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERBJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhiMCAtIDB4YkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhiMDogQkNTIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JDUycsICdyZWxhdGl2ZScpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHhiODogQ0xWIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24gKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTFYnLCAnaW1wbGllZCcpXG4gIH0sXG4gICc5JyxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgLyogMHhiZDogTERBIEFic29sdXRlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERBJywgJ2Fic29sdXRlWCcpXG4gIH0sXG4gICdlJyxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4YzAgLSAweGNGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJyxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAnOCcsXG4gIC8qIDB4Yzk6IENNUCBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NNUCcsICdpbW1lZGlhdGUnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQk5FJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweGQ4OiBDTEQgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ0xEJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnOScsXG4gICdhJyxcbiAgJ2InLFxuICAnYycsXG4gICdkJyxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhlMCAtIDB4ZUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJzAnLFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4ZTg6IElOWCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdJTlgnLCAnaW1wbGllZCcpXG4gIH0sXG4gICc5JyxcbiAgLyogMHhlYTogTk9QIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ05PUCcsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZjAgLSAweGZmICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZjA6IEJFUSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQkVRJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gIC8qIDB4ZjY6IElOQyB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0lOQycsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4Zjg6IFNFRCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTRUQnLCAnaW1wbGllZCcpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgeDB4IGZyb20gJy4vMHgweCdcbmltcG9ydCB4MXggZnJvbSAnLi8weDF4J1xuaW1wb3J0IHgyeCBmcm9tICcuLzB4MngnXG5pbXBvcnQgeDN4IGZyb20gJy4vMHgzeCdcbmltcG9ydCB4NHggZnJvbSAnLi8weDR4J1xuaW1wb3J0IHg1eCBmcm9tICcuLzB4NXgnXG5pbXBvcnQgeDZ4IGZyb20gJy4vMHg2eCdcbmltcG9ydCB4N3ggZnJvbSAnLi8weDd4J1xuaW1wb3J0IHg4eCBmcm9tICcuLzB4OHgnXG5pbXBvcnQgeDl4IGZyb20gJy4vMHg5eCdcbmltcG9ydCB4QXggZnJvbSAnLi8weEF4J1xuaW1wb3J0IHhCeCBmcm9tICcuLzB4QngnXG5pbXBvcnQgeEN4IGZyb20gJy4vMHhDeCdcbmltcG9ydCB4RHggZnJvbSAnLi8weER4J1xuaW1wb3J0IHhFeCBmcm9tICcuLzB4RXgnXG5pbXBvcnQgeEZ4IGZyb20gJy4vMHhGeCdcblxuY29uc3Qgb3Bjb2RlcyA9IFtdLmNvbmNhdChcbiAgeDB4LFxuICB4MXgsXG4gIHgyeCxcbiAgeDN4LFxuICB4NHgsXG4gIHg1eCxcbiAgeDZ4LFxuICB4N3gsXG4gIHg4eCxcbiAgeDl4LFxuICB4QXgsXG4gIHhCeCxcbiAgeEN4LFxuICB4RHgsXG4gIHhFeCxcbiAgeEZ4XG4pXG5cbmV4cG9ydCBkZWZhdWx0IG9wY29kZXNcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgaXNOb2RlanM6ICgpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJ1xuICB9XG59XG4iLCJpbXBvcnQgUmVnaXN0ZXJzIGZyb20gJy4vcmVnaXN0ZXJzJ1xuaW1wb3J0IFJhbSBmcm9tICcuL3JhbSdcbmltcG9ydCBvcGNvZGVzIGZyb20gJy4vb3Bjb2RlcydcbmltcG9ydCBVdGlsIGZyb20gJy4uL3V0aWwnXG5cbi8qIDY1MDIgQ1BVICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDcHUge1xuICBjb25zdHJ1Y3Rvcihpc0RlYnVnKSB7XG4gICAgdGhpcy5pbml0KClcbiAgICB0aGlzLmlzRGVidWcgPSBpc0RlYnVnXG4gIH1cblxuICBpbml0KCkge1xuICAgIHRoaXMucmVnaXN0ZXJzID0gbmV3IFJlZ2lzdGVycygpXG4gICAgLy90aGlzLm9wY29kZXMgPSBvcGNvZGVzXG4gICAgdGhpcy5vcGNvZGVzID0gb3Bjb2Rlcy5tYXAob3Bjb2RlID0+IHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb3Bjb2RlID09PSAnZnVuY3Rpb24nID8gb3Bjb2RlLmJpbmQodGhpcykgOiBvcGNvZGVcbiAgICB9KVxuXG4gICAgdGhpcy5yYW0gPSBuZXcgUmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgdGhpcy5yYW0uY29ubmVjdChwYXJ0cylcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaW5pdCgpXG4gICAgdGhpcy5ydW4oKVxuICB9XG5cbiAgcnVuKCkge1xuICAgIGNvbnN0IGV4ZWN1dGUgPSB0aGlzLmV2YWwuYmluZCh0aGlzKVxuXG4gICAgVXRpbC5pc05vZGVqcygpID8gc2V0SW50ZXJ2YWwoZXhlY3V0ZSwgNTApIDogZXhlY3V0ZSgpXG4gIH1cblxuICAvLyDlkb3ku6TjgpLlh6bnkIbjgZnjgotcbiAgZXZhbCgpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IG9wY29kZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcblxuICAgIGlmKHR5cGVvZiB0aGlzLm9wY29kZXNbb3Bjb2RlXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCcweCcgKyBvcGNvZGUudG9TdHJpbmcoMTYpICsgJyBpcyBub3QgaW1wbGVtZW50ZWQnKVxuICAgIH1cblxuICAgIHRoaXMub3Bjb2Rlc1tvcGNvZGVdLmNhbGwoKVxuXG4gICAgaWYgKCFVdGlsLmlzTm9kZWpzKCkpIHtcbiAgICAgIGNvbnN0IGZuID0gdGhpcy5ldmFsLmJpbmQodGhpcylcbiAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZm4pXG4gICAgfVxuICB9XG5cbiAgLyogMHg4MDAwfuOBruODoeODouODquOBq1JPTeWGheOBrlBSRy1ST03jgpLoqq3jgb/ovrzjgoAqL1xuICBzZXQgcHJnUm9tKHByZ1JvbSkge1xuICAgIC8vdGhpcy5pbnRlcnJ1cHRWZWN0b3JzKHByZ1JvbSlcbiAgICBjb25zdCBzdGFydEFkZHIgPSAweGZmZmYgLSBwcmdSb20ubGVuZ3RoXG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBzdGFydEFkZHJcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJnUm9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvL3RoaXMubWVtb3J5W3N0YXJ0QWRkcitpXSA9IHByZ1JvbVtpXVxuICAgICAgdGhpcy5yYW0ud3JpdGUoc3RhcnRBZGRyICsgaSwgcHJnUm9tW2ldKVxuICAgIH1cbiAgfVxuXG4gIC8qIC8vVE9ETyDlibLjgorovrzjgb/jg5njgq/jgr/jga7oqK3lrprjgpLooYzjgYZcbiAgICogTk1JXHQgICAgMHhGRkZBXHQweEZGRkJcbiAgICogUkVTRVRcdCAgMHhGRkZDXHQweEZGRkRcbiAgICogSVJR44CBQlJLXHQweEZGRkVcdDB4RkZGRlxuICAgKlxuICBpbnRlcnJ1cHRWZWN0b3JzKHByZ1JvbSkge1xuICAgIGNvbnN0IHN0YXJ0QWRkciA9IDB4ZmZmZiAtIHByZ1JvbS5sZW5ndGhcblxuICAgIGNvbnN0IHJlc2V0SGlnaEFkZHIgPSBwcmdSb21bMHhmZmZjIC0gMHhjMDAwXVxuICAgIGNvbnN0IHJlc2V0TG93QWRkciA9IHByZ1JvbVsweGZmZmQgLSAweGMwMDBdXG4gICAgY29uc3QgUkVTRVQgPSByZXNldEhpZ2hBZGRyIDw8IDggfCByZXNldExvd0FkZHJcbiAgfVxuICAvKiovXG5cbiAgLyog44K544K/44OD44Kv6aCY5Z+f44Gr5a++44GZ44KL5pON5L2cKi9cbiAgc3RhY2tQdXNoKHZhbHVlKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUodGhpcy5yZWdpc3RlcnMuc3AsIHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnNwLS1cbiAgfVxuXG4gIHN0YWNrUG9wKCkge1xuICAgIHJldHVybiB0aGlzLnJhbS5yZWFkKCsrdGhpcy5yZWdpc3RlcnMuc3ApXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFZyYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4NDAwMClcbiAgICB0aGlzLnZwID0gbnVsbFxuICB9XG5cbiAgY29ubmVjdChwcHUpIHtcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ID0gcHB1LnJlZnJlc2hEaXNwbGF5LmJpbmQocHB1KVxuICB9XG5cbiAgd3JpdGVGcm9tQnVzKHZhbHVlKSB7XG4gICAgLy9jb25zb2xlLmxvZygndnJhbVskJyArIHRoaXMudnAudG9TdHJpbmcoMTYpICsgJ10gPSAnICsgU3RyaW5nLmZyb21DaGFyQ29kZSh2YWx1ZSkpXG4gICAgdGhpcy5tZW1vcnlbdGhpcy52cF0gPSB2YWx1ZVxuICAgIHRoaXMudnArK1xuICAgIHRoaXMucmVmcmVzaERpc3BsYXkgJiYgdGhpcy5yZWZyZXNoRGlzcGxheSgpXG4gIH1cblxuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIHRoaXMubWVtb3J5W2FkZHJdID0gdmFsdWVcbiAgfVxuXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCJpbXBvcnQgVnJhbSBmcm9tICcuL3ZyYW0nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBwdSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdCgpXG4gIH1cblxuICBpbml0KCkge1xuICAgIC8qIEFib3V0IFZSQU1cbiAgICAgKiAweDAwMDAgLSAweDBmZmYgOiBQYXR0ZXJuIHRhYmxlIDBcbiAgICAgKiAweDEwMDAgLSAweDFmZmYgOiBQYXR0ZXJuIHRhYmxlIDFcbiAgICAgKiAweDIwMDAgLSAweDIzYmYgOiBOYW1lIHRhYmxlIDBcbiAgICAgKiAweDIzYzAgLSAweDIzZmYgOiBBdHRyaWJ1dGUgdGFibGUgMFxuICAgICAqIDB4MjQwMCAtIDB4MjdiZiA6IE5hbWUgdGFibGUgMVxuICAgICAqIDB4MmJjMCAtIDB4MmJiZiA6IEF0dHJpYnV0ZSB0YWJsZSAxXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAyXG4gICAgICogMHgyYmMwIC0gMHgyYmZmIDogQXR0cmlidXRlIHRhYmxlIDJcbiAgICAgKiAweDJjMDAgLSAweDJmYmYgOiBOYW1lIHRhYmxlIDNcbiAgICAgKiAweDJmYzAgLSAweDJmZmYgOiBBdHRyaWJ1dGUgdGFibGUgM1xuICAgICAqIDB4MzAwMCAtIDB4M2VmZiA6IE1pcnJvciBvZiAweDIwMDAgLSAweDJmZmZcbiAgICAgKiAweDNmMDAgLSAweDNmMGYgOiBCYWNrZ3JvdW5kIHBhbGV0dGVcbiAgICAgKiAweDNmMTAgLSAweDNmMWYgOiBTcHJpdGUgcGFsZXR0ZVxuICAgICAqIDB4M2YyMCAtIDB4M2ZmZiA6IE1pcnJvciBvZiAweDNmMDAgMCAweDNmMWZcbiAgICAgKiAqL1xuICAgIHRoaXMudnJhbSA9IG5ldyBWcmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBpZiAocGFydHMuYnVzKSB7XG4gICAgICBwYXJ0cy5idXMuY29ubmVjdCh7IHZyYW06IHRoaXMudnJhbSB9KVxuICAgIH1cblxuICAgIGlmIChwYXJ0cy5yZW5kZXJlcikge1xuICAgICAgdGhpcy5yZW5kZXJlciA9IHBhcnRzLnJlbmRlcmVyXG4gICAgICB0aGlzLnZyYW0uY29ubmVjdCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIC8qICQyMDAwIC0gJDIzQkbjga7jg43jg7zjg6Djg4bjg7zjg5bjg6vjgpLmm7TmlrDjgZnjgosgKi9cbiAgcmVmcmVzaERpc3BsYXkoKSB7XG4gICAgLyog44K/44Kk44OrKDh4OCnjgpIzMiozMOWAiyAqL1xuICAgIGZvciAobGV0IGkgPSAweDIwMDA7IGkgPD0gMHgyM2JmOyBpKyspIHtcbiAgICAgIGNvbnN0IHRpbGVJZCA9IHRoaXMudnJhbS5yZWFkKGkpXG4gICAgICAvKiDjgr/jgqTjg6vjgpLmjIflrpogKi9cbiAgICAgIGNvbnN0IHRpbGUgPSB0aGlzLnRpbGVzW3RpbGVJZF1cbiAgICAgIC8qIOOCv+OCpOODq+OBjOS9v+eUqOOBmeOCi+ODkeODrOODg+ODiOOCkuWPluW+lyAqL1xuICAgICAgY29uc3QgcGFsZXR0ZUlkID0gdGhpcy5zZWxlY3RQYWxldHRlKHRpbGVJZClcbiAgICAgIGNvbnN0IHBhbGV0dGUgPSB0aGlzLnNlbGVjdEJhY2tncm91bmRQYWxldHRlcyhwYWxldHRlSWQpXG5cbiAgICAgIC8qIOOCv+OCpOODq+OBqOODkeODrOODg+ODiOOCklJlbmRlcmVy44Gr5rih44GZICovXG4gICAgICB0aGlzLnJlbmRlcmVyLndyaXRlKHRpbGUsIHBhbGV0dGUpXG4gICAgfVxuICB9XG5cbiAgLyogMHgwMDAwIC0gMHgxZmZm44Gu44Oh44Oi44Oq44GrQ0hSLVJPTeOCkuiqreOBv+i+vOOCgCAqL1xuICBzZXQgY2hyUm9tKGNoclJvbSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hyUm9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnZyYW0ud3JpdGUoaSwgY2hyUm9tW2ldKVxuICAgIH1cblxuICAgIC8qIENIUumgmOWfn+OBi+OCieOCv+OCpOODq+OCkuaKveWHuuOBl+OBpuOBiuOBjyAqL1xuICAgIHRoaXMuZXh0cmFjdFRpbGVzKClcbiAgfVxuXG4gIC8vIDh4OOOBruOCv+OCpOODq+OCkuOBmeOBueOBpnZyYW3jga5DSFLjgYvjgonmir3lh7rjgZfjgabjgYrjgY9cbiAgZXh0cmFjdFRpbGVzKCkge1xuICAgIHRoaXMudGlsZXMgPSBbXVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMHgxZmZmOyApIHtcbiAgICAgIC8vIOOCv+OCpOODq+OBruS4i+S9jeODk+ODg+ODiFxuICAgICAgY29uc3QgbG93ZXJCaXRMaW5lcyA9IFtdXG4gICAgICBmb3IgKGxldCBoID0gMDsgaCA8IDg7IGgrKykge1xuICAgICAgICBsZXQgYnl0ZSA9IHRoaXMudnJhbS5yZWFkKGkrKylcbiAgICAgICAgY29uc3QgbGluZSA9IFtdXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0KVxuICAgICAgICAgIGJ5dGUgPSBieXRlID4+IDFcbiAgICAgICAgfVxuXG4gICAgICAgIGxvd2VyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIrkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGhpZ2hlckJpdExpbmVzID0gW11cbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGxldCBieXRlID0gdGhpcy52cmFtLnJlYWQoaSsrKVxuICAgICAgICBjb25zdCBsaW5lID0gW11cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgICAgICBjb25zdCBiaXQgPSBieXRlICYgMHgwMVxuICAgICAgICAgIGxpbmUudW5zaGlmdChiaXQgPDwgMSlcbiAgICAgICAgICBieXRlID0gYnl0ZSA+PiAxXG4gICAgICAgIH1cblxuICAgICAgICBoaWdoZXJCaXRMaW5lcy5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIC8vIOS4iuS9jeODk+ODg+ODiOOBqOS4i+S9jeODk+ODg+ODiOOCkuWQiOaIkOOBmeOCi1xuICAgICAgY29uc3QgcGVyZmVjdEJpdHMgPSBbXVxuICAgICAgZm9yIChsZXQgaCA9IDA7IGggPCA4OyBoKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgICAgICBjb25zdCBwZXJmZWN0Qml0ID0gbG93ZXJCaXRMaW5lc1toXVtqXSB8IGhpZ2hlckJpdExpbmVzW2hdW2pdXG4gICAgICAgICAgcGVyZmVjdEJpdHMucHVzaChwZXJmZWN0Qml0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnRpbGVzLnB1c2gocGVyZmVjdEJpdHMpXG4gICAgfVxuICB9XG5cbiAgLyog5bGe5oCn44OG44O844OW44Or44GL44KJ6Kmy5b2T44OR44Os44OD44OI44Gu55Wq5Y+344KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdFBhbGV0dGUobikge1xuICAgIGNvbnN0IGJsb2NrUG9zaXRpb24gPSAoKG4gLSAobiAlIDY0KSkgLyA2NCkgKiA4ICsgKChuICUgNjQpIC0gKG4gJSA0KSkgLyA0XG4gICAgY29uc3QgYml0UG9zaXRpb24gPSBuICUgNFxuICAgIGNvbnN0IHN0YXJ0ID0gMHgyM2MwXG5cbiAgICBjb25zdCBibG9jayA9IHRoaXMudnJhbS5yZWFkKHN0YXJ0ICsgYmxvY2tQb3NpdGlvbilcbiAgICBjb25zdCBiaXQgPSAoYmxvY2sgPj4gYml0UG9zaXRpb24pICYgMHgwM1xuXG4gICAgcmV0dXJuIGJpdFxuICB9XG5cbiAgLyogJDNGMDAtJDNGMEbjgYvjgonjg5Djg4Pjgq/jgrDjg6njgqbjg7Pjg4ko6IOM5pmvKeODkeODrOODg+ODiOOCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RCYWNrZ3JvdW5kUGFsZXR0ZXMobnVtYmVyKSB7XG4gICAgY29uc3QgcGFsZXR0ZSA9IFtdXG5cbiAgICBjb25zdCBzdGFydCA9IDB4M2YwMCArIG51bWJlciAqIDRcbiAgICBjb25zdCBlbmQgPSAweDNmMDAgKyBudW1iZXIgKiA0ICsgNFxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxuXG4gIC8qICQzRjEwLSQzRjFG44GL44KJ44K544OX44Op44Kk44OI44OR44Os44OD44OI44KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdFNwcml0ZVBhbGV0dHMobnVtYmVyKSB7XG4gICAgY29uc3QgcGFsZXR0ZSA9IFtdXG5cbiAgICBjb25zdCBzdGFydCA9IDB4M2YxMCArIG51bWJlciAqIDRcbiAgICBjb25zdCBlbmQgPSAweDNmMTAgKyBudW1iZXIgKiA0ICsgNFxuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnVzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5idWZmZXIgPSB7fVxuICAgIHRoaXMudnJhbUFkZHJfID0gW11cbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy52cmFtICYmICh0aGlzLnZyYW0gPSBwYXJ0cy52cmFtKVxuICB9XG5cbiAgLyogQ1BV5YG044GL44KJ44Gu44G/44GX44GL6ICD5oWu44GX44Gm44Gq44GEICovXG4gIHdyaXRlKGFkZHIsIHZhbHVlKSB7XG4gICAgc3dpdGNoIChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgdGhpcy52cmFtQWRkciA9IHZhbHVlXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDB4MjAwNzpcbiAgICAgICAgdGhpcy52cmFtLndyaXRlRnJvbUJ1cyh2YWx1ZSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuYnVmZmVyW2FkZHJdID0gdmFsdWVcbiAgICB9XG4gIH1cblxuICByZWFkKGFkZHIpIHtcbiAgICBzd2l0Y2ggKGFkZHIpIHtcbiAgICAgIGNhc2UgMHgyMDA2OlxuICAgICAgICByZXR1cm4gdGhpcy52cmFtQWRkclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVzIG9mIHRoaXMgYWRkciBpcyBOb3QgaW1wbGVtZW50ZWQnKVxuICAgIH1cbiAgfVxuXG4gIHNldCB2cmFtQWRkcihhZGRyKSB7XG4gICAgaWYgKHRoaXMudnJhbUFkZHJfLmxlbmd0aCA8IDEpIHtcbiAgICAgIHRoaXMudnJhbUFkZHJfLnB1c2goYWRkcilcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKVxuICAgICAgdGhpcy52cmFtLnZwID0gdGhpcy52cmFtQWRkclxuICAgICAgdGhpcy52cmFtQWRkcl8ubGVuZ3RoID0gMFxuICAgIH1cbiAgfVxuXG4gIGdldCB2cmFtQWRkcigpIHtcbiAgICByZXR1cm4gKHRoaXMudnJhbUFkZHJfWzBdIDw8IDgpICsgdGhpcy52cmFtQWRkcl9bMV1cbiAgfVxufVxuIiwiaW1wb3J0IENwdSBmcm9tICcuL2NwdSdcbmltcG9ydCBQcHUgZnJvbSAnLi9wcHUnXG5pbXBvcnQgQnVzIGZyb20gJy4vYnVzJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBOZXMge1xuICBjb25zdHJ1Y3Rvcihpc0RlYnVnKSB7XG4gICAgdGhpcy5jcHUgPSBuZXcgQ3B1KGlzRGVidWcpXG4gICAgdGhpcy5wcHUgPSBuZXcgUHB1KClcbiAgICB0aGlzLmJ1cyA9IG5ldyBCdXMoKVxuICAgIHRoaXMucHB1LmNvbm5lY3QoeyBidXM6IHRoaXMuYnVzIH0pXG4gICAgdGhpcy5jcHUuY29ubmVjdCh7IGJ1czogdGhpcy5idXMgfSlcbiAgfVxuXG4gIGNvbm5lY3QocmVuZGVyZXIpIHtcbiAgICB0aGlzLnBwdS5jb25uZWN0KHsgcmVuZGVyZXIgfSlcbiAgfVxuXG4gIGdldCByb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JvbVxuICB9XG5cbiAgc2V0IHJvbShyb20pIHtcbiAgICB0aGlzLl9yb20gPSByb21cbiAgfVxuXG4gIHJ1bigpIHtcbiAgICB0aGlzLmNwdS5wcmdSb20gPSB0aGlzLnJvbS5wcmdSb21cbiAgICB0aGlzLnBwdS5jaHJSb20gPSB0aGlzLnJvbS5jaHJSb21cblxuICAgIHRoaXMuY3B1LnJ1bigpXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvbSB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmNoZWNrKGRhdGEpXG4gICAgdGhpcy5kYXRhID0gZGF0YVxuICB9XG5cbiAgY2hlY2soZGF0YSkge1xuICAgIGlmICghdGhpcy5pc05lc1JvbShkYXRhKSkgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGlzIG5vdCBORVMgUk9NLicpXG4gIH1cblxuICBnZXQgTkVTX1JPTV9IRUFERVJfU0laRSgpIHtcbiAgICByZXR1cm4gMHgxMFxuICB9XG5cbiAgZ2V0IE5VTUJFUl9PRl9QUkdfUk9NX0JMT0NLUygpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdOdW1iZXIgb2YgUFJHLVJPTSBibG9ja3M6ICcgKyB0aGlzLmRhdGFbNF0pXG4gICAgcmV0dXJuIHRoaXMuZGF0YVs0XVxuICB9XG5cbiAgZ2V0IE5VTUJFUl9PRl9DSFJfUk9NX0JMT0NLUygpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdOdW1iZXIgb2YgQ0hSLVJPTSBibG9ja3M6ICcgKyB0aGlzLmRhdGFbNV0pXG4gICAgcmV0dXJuIHRoaXMuZGF0YVs1XVxuICB9XG5cbiAgZ2V0IFNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5ORVNfUk9NX0hFQURFUl9TSVpFICsgdGhpcy5TSVpFX09GX1BSR19ST01cbiAgfVxuXG4gIGdldCBFTkRfQUREUkVTU19PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSArIHRoaXMuU0laRV9PRl9DSFJfUk9NXG4gIH1cblxuICAvKiBQUkcgUk9N44Gu44K144Kk44K644KS5Y+W5b6X44GZ44KLXG4gICAqKiBST03jg5jjg4Pjg4Djga4x44GL44KJ5pWw44GI44GmNUJ5dGXnm67jga7lgKTjgasxNktpKOOCreODkynjgpLjgYvjgZHjgZ/jgrXjgqTjgrogKi9cbiAgZ2V0IFNJWkVfT0ZfUFJHX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5OVU1CRVJfT0ZfUFJHX1JPTV9CTE9DS1MgKiAweDQwMDBcbiAgfVxuXG4gIC8qIFBSRyBST03jgavlkIzjgZgqL1xuICBnZXQgU0laRV9PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLk5VTUJFUl9PRl9DSFJfUk9NX0JMT0NLUyAqIDB4MjAwMFxuICB9XG5cbiAgLyogUk9N44GL44KJcHJnUk9N44Gr6Kmy5b2T44GZ44KL44Go44GT44KN44KS5YiH44KK5Ye644GZXG4gICAqKiBwcmdST03jga/jg5jjg4Pjg4DpoJjln5/jga7mrKHjga5CeXRl44GL44KJ5aeL44G+44KLICovXG4gIGdldCBwcmdSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZShcbiAgICAgIHRoaXMuTkVTX1JPTV9IRUFERVJfU0laRSxcbiAgICAgIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NIC0gMVxuICAgIClcbiAgfVxuXG4gIC8qIFJPTeOBi+OCiWNoclJPTeOBq+ipsuW9k+OBmeOCi+OBqOOBk+OCjeOCkuWIh+OCiuWHuuOBmVxuICAgKiogY2hyUm9t44GvcHJnUm9t44Gu5b6M44GL44KJ5aeL44G+44KLICovXG4gIGdldCBjaHJSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZShcbiAgICAgIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NLFxuICAgICAgdGhpcy5FTkRfQUREUkVTU19PRl9DSFJfUk9NIC0gMVxuICAgIClcbiAgfVxuXG4gIC8qIOODh+ODvOOCv+OBruODmOODg+ODgOOBqydORVMn44GM44GC44KL44GL44Gp44GG44GL44GnTkVT44GuUk9N44GL5Yik5Yil44GZ44KLICovXG4gIGlzTmVzUm9tKGRhdGEpIHtcbiAgICBjb25zdCBoZWFkZXIgPSBkYXRhLnNsaWNlKDAsIDMpXG4gICAgY29uc3QgaGVhZGVyU3RyID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBoZWFkZXIpXG5cbiAgICByZXR1cm4gaGVhZGVyU3RyID09PSAnTkVTJ1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBbXG4gIFsweDc1LCAweDc1LCAweDc1XSxcbiAgWzB4MjcsIDB4MWIsIDB4OGZdLFxuICBbMHgwMCwgMHgwMCwgMHhhYl0sXG4gIFsweDQ3LCAweDAwLCAweDlmXSxcbiAgWzB4OGYsIDB4MDAsIDB4NzddLFxuICBbMHhhYiwgMHgwMCwgMHgxM10sXG4gIFsweGE3LCAweDAwLCAweDAwXSxcbiAgWzB4N2YsIDB4MGIsIDB4MDBdLFxuICBbMHg0MywgMHgyZiwgMHgwMF0sXG4gIFsweDAwLCAweDQ3LCAweDAwXSxcbiAgWzB4MDAsIDB4NTEsIDB4MDBdLFxuICBbMHgwMCwgMHgzZiwgMHgxN10sXG4gIFsweDFiLCAweDNmLCAweDVmXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICBbMHgwMCwgMHg3MywgMHhlZl0sXG4gIFsweDIzLCAweDNiLCAweGVmXSxcbiAgWzB4ODMsIDB4MDAsIDB4ZjNdLFxuICBbMHhiZiwgMHgwMCwgMHhiZl0sXG4gIFsweGU3LCAweDAwLCAweDViXSxcbiAgWzB4ZGIsIDB4MmIsIDB4MDBdLFxuICBbMHhjYiwgMHg0ZiwgMHgwZl0sXG4gIFsweDhiLCAweDczLCAweDAwXSxcbiAgWzB4MDAsIDB4OTcsIDB4MDBdLFxuICBbMHgwMCwgMHhhYiwgMHgwMF0sXG4gIFsweDAwLCAweDkzLCAweDNiXSxcbiAgWzB4MDAsIDB4ODMsIDB4OGJdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHhmZiwgMHhmZiwgMHhmZl0sXG4gIFsweDNmLCAweGJmLCAweGZmXSxcbiAgWzB4NWYsIDB4NzMsIDB4ZmZdLFxuICBbMHhhNywgMHg4YiwgMHhmZF0sXG4gIFsweGY3LCAweDdiLCAweGZmXSxcbiAgWzB4ZmYsIDB4NzcsIDB4YjddLFxuICBbMHhmZiwgMHg3NywgMHg2M10sXG4gIFsweGZmLCAweDliLCAweDNiXSxcbiAgWzB4ZjMsIDB4YmYsIDB4M2ZdLFxuICBbMHg4MywgMHhkMywgMHgxM10sXG4gIFsweDRmLCAweGRmLCAweDRiXSxcbiAgWzB4NTgsIDB4ZjgsIDB4OThdLFxuICBbMHgwMCwgMHhlYiwgMHhkYl0sXG4gIFsweDc1LCAweDc1LCAweDc1XSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweGZmLCAweGZmLCAweGZmXSxcbiAgWzB4YWIsIDB4ZTcsIDB4ZmZdLFxuICBbMHhjNywgMHhkNywgMHhmZl0sXG4gIFsweGQ3LCAweGNiLCAweGZmXSxcbiAgWzB4ZmYsIDB4YzcsIDB4ZmZdLFxuICBbMHhmZiwgMHhjNywgMHhkYl0sXG4gIFsweGZmLCAweGJmLCAweGIzXSxcbiAgWzB4ZmYsIDB4ZGIsIDB4YWJdLFxuICBbMHhmZiwgMHhlNywgMHhhM10sXG4gIFsweGUzLCAweGZmLCAweGEzXSxcbiAgWzB4YWIsIDB4ZjMsIDB4YmZdLFxuICBbMHhiMywgMHhmZiwgMHhjZl0sXG4gIFsweDlmLCAweGZmLCAweGYzXSxcbiAgWzB4YmMsIDB4YmMsIDB4YmNdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXVxuXVxuIiwiaW1wb3J0IGNvbG9ycyBmcm9tICcuL2NvbG9ycydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVuZGVyZXIge1xuICBjb25zdHJ1Y3RvcihpZCkge1xuICAgIGlmICghaWQpIHRocm93IG5ldyBFcnJvcihcIklkIG9mIGNhbnZhcyB0YWcgaXNuJ3Qgc3BlY2lmaWVkLlwiKVxuXG4gICAgbGV0IGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKVxuICAgIHRoaXMuY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgdGhpcy5wb2ludGVyID0gMFxuICAgIHRoaXMud2lkdGggPSAzMlxuICAgIHRoaXMuaGVpZ2h0ID0gMzBcbiAgfVxuXG4gIHdyaXRlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuZ2VuZXJhdGVUaWxlSW1hZ2UodGlsZSwgcGFsZXR0ZSlcbiAgICBjb25zdCB4ID0gKHRoaXMucG9pbnRlciAlIHRoaXMud2lkdGgpICogOFxuICAgIGNvbnN0IHkgPSAoKHRoaXMucG9pbnRlciAtICh0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSkgLyB0aGlzLndpZHRoKSAqIDhcblxuICAgIGlmICh0aGlzLnBvaW50ZXIgPCB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgLSAxKSB7XG4gICAgICB0aGlzLnBvaW50ZXIrK1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBvaW50ZXIgPSAwXG4gICAgfVxuXG4gICAgdGhpcy5jb250ZXh0LnB1dEltYWdlRGF0YShpbWFnZSwgeCwgeSlcbiAgfVxuXG4gIGdlbmVyYXRlVGlsZUltYWdlKHRpbGUsIHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuY29udGV4dC5jcmVhdGVJbWFnZURhdGEoOCwgOClcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjQ7IGkrKykge1xuICAgICAgY29uc3QgYml0ID0gdGlsZVtpXVxuICAgICAgY29uc3QgY29sb3IgPSB0aGlzLmNvbG9yKHBhbGV0dGVbYml0XSlcblxuICAgICAgaW1hZ2UuZGF0YVtpICogNF0gPSBjb2xvclswXVxuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDFdID0gY29sb3JbMV1cbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAyXSA9IGNvbG9yWzJdXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgM10gPSAyNTUgLy8g6YCP5piO5bqmXG4gICAgfVxuXG4gICAgcmV0dXJuIGltYWdlXG4gIH1cblxuICBjb2xvcihjb2xvcklkKSB7XG4gICAgcmV0dXJuIGNvbG9yc1tjb2xvcklkXVxuICB9XG59XG4iLCJpbXBvcnQgTmVzXyBmcm9tICcuL25lcydcbmltcG9ydCBSb21fIGZyb20gJy4vcm9tJ1xuaW1wb3J0IFJlbmRlcmVyXyBmcm9tICcuL3JlbmRlcmVyJ1xuXG5leHBvcnQgY29uc3QgTmVzID0gTmVzX1xuZXhwb3J0IGNvbnN0IFJvbSA9IFJvbV9cbmV4cG9ydCBjb25zdCBSZW5kZXJlciA9IFJlbmRlcmVyX1xuIl0sIm5hbWVzIjpbIlV0aWwiLCJSZWdpc3RlcnMiLCJOZXMiLCJOZXNfIiwiUm9tIiwiUm9tXyIsIlJlbmRlcmVyIiwiUmVuZGVyZXJfIl0sIm1hcHBpbmdzIjoiOzs7Ozs7RUFBZSxNQUFNLFFBQVEsQ0FBQztFQUM5QixFQUFFLFdBQVcsR0FBRztFQUNoQixJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtFQUNwQixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSTtFQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSTtFQUN2QixJQUFJ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RSxXQUFXO0VBQzVCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUU7RUFDdEMsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDN0QsSUFBSSxLQUFLLEdBQUcsS0FBSyxHQUFHLE9BQU07O0VBRTFCLElBQUksTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQzs7RUFFdkUsSUFBSSxPQUFPLElBQUksR0FBRyxNQUFNO0VBQ3hCLEdBQUc7O0VBRUgsRUFBRSxhQUFhLEVBQUUsV0FBVztFQUM1QixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3RDLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDOztFQUV2QyxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUM7RUFDckUsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTs7RUFFdkMsSUFBSSxPQUFPLElBQUksR0FBRyxNQUFNO0VBQ3hCLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxRQUFRLEVBQUUsV0FBVztFQUN2QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3JDLElBQUksTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDOztFQUU3QyxJQUFJLElBQUksSUFBSTtFQUNaLE1BQU0sWUFBWSxJQUFJLElBQUk7RUFDMUIsVUFBVSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxZQUFZLEdBQUcsS0FBSztFQUNsRCxVQUFVLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLGFBQVk7O0VBRTFDLElBQUksT0FBTyxJQUFJO0VBQ2YsR0FBRztFQUNILENBQUM7O0VDdEhjLE1BQU0sSUFBSSxDQUFDO0VBQzFCLEVBQUUsT0FBTyxVQUFVLENBQUMsS0FBSyxFQUFFO0VBQzNCLElBQUksT0FBTyxLQUFLLElBQUksQ0FBQztFQUNyQixHQUFHOztFQUVILEVBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxFQUFFO0VBQ3ZCLElBQUksT0FBTyxLQUFLLEtBQUssSUFBSSxHQUFHLENBQUM7RUFDN0IsR0FBRzs7RUFFSCxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssRUFBRTtFQUNwQixJQUFJLE9BQU8sS0FBSyxJQUFJLENBQUM7RUFDckIsR0FBRzs7RUFFSCxFQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssRUFBRTtFQUNwQixJQUFJLE9BQU8sS0FBSyxHQUFHLElBQUk7RUFDdkIsR0FBRztFQUNILENBQUM7O0FDZEQscUJBQWU7RUFDZjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHO0VBQ0g7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLE1BQUs7RUFDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFDO0VBQzVDLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUM7RUFDL0MsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBQztFQUMvQyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFFO0VBQ25DLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsTUFBSztFQUM3QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUM7RUFDL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBQztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQztFQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFDO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQzs7RUFFdEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFNLEVBQUM7RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxNQUFNLElBQUksRUFBQztFQUMvQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsS0FBSTtFQUN0RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDOztFQUUzRCxJQUFJLEdBQUcsTUFBTSxLQUFLLENBQUMsRUFBRTtFQUNyQixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLEVBQUM7RUFDbkMsS0FBSyxNQUFNO0VBQ1gsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxFQUFDO0VBQ25DLE1BQU0sR0FBRyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0VBQ3JCLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUN0QyxPQUFPLE1BQU07RUFDYixRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLEVBQUM7RUFDdEMsT0FBTztFQUNQLEtBQUs7RUFDTCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRTs7RUFFcEI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0VBQ2pELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDO0VBQ2pELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDakUsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ2pFLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBVztFQUM1QyxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7O0VBRXhDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBRztFQUNwQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUM7RUFDNUQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXO0VBQzVDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksRUFBQzs7RUFFdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksTUFBSztFQUMxRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsSUFBSSxFQUFDO0VBQ2pELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSTs7RUFFMUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBQztFQUM1RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsSUFBSSxFQUFDO0VBQ2pELElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsS0FBSTs7RUFFekMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksTUFBSztFQUMxRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXO0VBQzNELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUM7RUFDbkQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBVztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksSUFBSSxFQUFDO0VBQ25ELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBQztFQUN0QyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBQztFQUNuRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUU7RUFDeEMsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFFO0VBQy9DLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDNUIsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUM7RUFDM0MsSUFBSSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxPQUFNOztFQUU5QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFDO0VBQzNCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUM7RUFDNUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxLQUFJO0VBQzVCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRTtFQUNwQyxJQUFJLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUU7RUFDbkMsSUFBSSxNQUFNLElBQUksR0FBRyxRQUFRLElBQUksQ0FBQyxHQUFHLFFBQU87RUFDeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxLQUFJO0VBQzVCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUU7O0VBRXBCO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBVzs7RUFFcEQsSUFBSSxJQUFJLFlBQVksRUFBRTtFQUN0QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDOUIsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBVzs7RUFFbkQsSUFBSSxJQUFJLFlBQVksRUFBRTtFQUN0QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDOUIsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVTs7RUFFbEQsSUFBSSxJQUFJLFlBQVksRUFBRTtFQUN0QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDOUIsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFVOztFQUVuRCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxF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RSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUNqQ0Q7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUN4QkQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUN4QkQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUNyQkQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUN4QkQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUN4QkQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUM5QkQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUN4QkQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHOztFQUVMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUM7RUFDL0MsR0FBRztFQUNILEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLENBQUM7O0VDNUJEO0FBQ0EsWUFBZTtFQUNmO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUM7RUFDOUMsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxZQUFZO0VBQ2QsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUM7RUFDN0MsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUM7RUFDL0MsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLENBQUM7O0VDM0JEO0FBQ0EsWUFBZTtFQUNmLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUM7RUFDL0MsR0FBRztFQUNILEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLENBQUM7O0VDckJEO0FBQ0EsWUFBZTtFQUNmO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUM7RUFDOUMsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUM7RUFDN0MsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLENBQUM7O0VDeEJEO0FBQ0EsWUFBZTtFQUNmLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUM7RUFDN0MsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUM7RUFDN0MsR0FBRztFQUNILEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLENBQUM7O0VDeEJEO0FBQ0EsWUFBZTtFQUNmO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUM7RUFDOUMsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMLEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUM7RUFDL0MsR0FBRztFQUNILEVBQUUsR0FBRztFQUNMO0VBQ0EsRUFBRSxXQUFXO0VBQ2IsSUFBSUEsTUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUM7RUFDN0MsR0FBRztFQUNILEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNKLEVBQUUsRUFBRTtFQUNK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Q0FBQyxHQUFHLE1BQU0sSUFBSTtFQUNsQztFQUNBLE1BQU0sTUFBTSxhQUFhLEdBQUcsR0FBRTtFQUM5QixNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDbEMsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBQztFQUN0QyxRQUFRLE1BQU0sSUFBSSxHQUFHLEdBQUU7RUFDdkIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ3BDLFVBQVUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEtBQUk7RUFDakMsVUFBVSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBQztFQUMzQixVQUFVLElBQUksR0FBRyxJQUFJLElBQUksRUFBQztFQUMxQixTQUFTOztFQUVULFFBQVEsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDaEMsT0FBTzs7RUFFUDtFQUNBLE1BQU0sTUFBTSxjQUFjLEdBQUcsR0FBRTtFQUMvQixNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDbEMsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBQztFQUN0QyxRQUFRLE1BQU0sSUFBSSxHQUFHLEdBQUU7RUFDdkIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ3BDLFVBQVUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEtBQUk7RUFDakMsVUFBVSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFDaEMsVUFBVSxJQUFJLEdBQUcsSUFBSSxJ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QUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FB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
