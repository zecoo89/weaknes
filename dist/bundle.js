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
      this.status_ = 0x24;
      /*
      status: {
        // ステータスレジスタ：CPUの各種状態を保持する
        negative_: 0,
        overflow_: 0,
        reserved_: 1,
        break_: 0, // 割り込みBRK発生時にtrue,IRQ発生時にfalse
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
        'A:' + this.acc.toString(16),
        'X:' + this.indexX.toString(16),
        'Y:' + this.indexY.toString(16),
        'P:' + this.statusAllRawBits.toString(16),
        'SP:' + (this.sp & 0xff).toString(16)
      ].join(' ')
    }

    get statusAllRawBits() {
      return this.status_
    }

    set statusAllRawBits(bits) {
      this.status_ = bits;
      this.statusReserved = 1; // reservedは常に1にセットされている
    }

    get acc() {
      return this.acc_
    }

    set acc(value) {
      this.acc_ = value & 0xff;
    }

    get indexX() {
      return this.indexX_
    }

    set indexX(value) {
      this.indexX_ = value & 0xff;
    }

    get indexY() {
      return this.indexY_
    }

    set indexY(value) {
      this.indexY_ = value & 0xff;
    }

    get sp() {
      return this.sp_
    }

    set sp(value) {
      this.sp_ = 0x0100 | value;
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

  /* アドレッシングにはaccumulatorもあるが、
   * accumulatorは直接命令内で参照するので、
   * 実装の都合上、関数は必要ない。*/
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

      const lowAddr__ = lowAddr | (highAddr << 8);
      const highAddr__ = ((lowAddr+1) & 0xff) | (highAddr << 8);
      const addr = this.ram.read(lowAddr__) | (this.ram.read(highAddr__) << 8);

      return addr & 0xffff
    },

    indexIndirect: function() {
      const addr__ = this.registers.pc++;
      const addr_ = (this.ram.read(addr__) + this.registers.indexX) & 0xff;

      const lowAddr = this.ram.read(addr_);
      const highAddr = this.ram.read((addr_ + 1) & 0xff ) << 8;

      const addr = lowAddr | highAddr;

      return addr & 0xffff
    },

    indirectIndex: function() {
      const addr__ = this.registers.pc++;
      const addr_ = this.ram.read(addr__);

      const lowAddr = this.ram.read(addr_);
      const highAddr = this.ram.read((addr_ + 1) & 0xff ) << 8;

      let addr = lowAddr | highAddr;

      addr = (addr + this.registers.indexY) & 0xffff;

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

  var Util = {
    isNegative: value => value >> 7,
    isZero: value => (value === 0x00) & 1,
    msb: value => value >> 7,
    lsb: value => value & 0x01,
    add: (a, b) => (a + b) & 0xff,
    sub: (a, b) => (a - b) & 0xff
  };

  var Instructions = {
    /* LD* (Load memory[addr) to * register)
     * フラグ
     *   - negative : 対象の最上位ビット(0から数えて7bit目)
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

    // TXSは他のTX*と違い、フラグを変更しない
    TXS: function() {
      const value = this.registers.indexX;
      this.registers.sp = value;
      //this.registers.statusNegative = Util.isNegative(value)
      //this.registers.statusZero = Util.isZero(value)
    },

    TYA: function() {
      const value = this.registers.indexY;
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* accまたはメモリを左へシフト
     * フラグ
     *   - negative
     *   - zero
     *   - carry
     * */
    ASL: function(addr) {
      const value = addr ? this.ram.read(addr) : this.registers.acc;
      const msb = Util.msb(value);
      const shifted = (value << 1) & 0xff;

      addr ? this.ram.write(addr, shifted) : this.registers.acc = shifted;
      this.registers.statusNegative = Util.isNegative(shifted);
      this.registers.statusZero = Util.isZero(shifted);
      this.registers.statusCarry = msb;
    },

    /* accまたはメモリを右へシフト
     * フラグ
     *   - negative
     *   - zero
     *   - carry
     * */
    /* Logical Shift Right */
    LSR: function(addr) {
      const value = addr ? this.ram.read(addr) : this.registers.acc;
      const lsb = Util.lsb(value);
      const shifted = value >> 1;

      addr ? this.ram.write(addr, shifted) : this.registers.acc = shifted;

      this.registers.statusNegative = Util.isNegative(shifted);
      this.registers.statusZero = Util.isZero(shifted);
      this.registers.statusCarry = lsb;
    },

    /* AとメモリをAND演算してフラグを操作する
     * 演算結果は捨てる
     * */
    BIT: function(addr) {
      const memory = this.ram.read(addr);

      this.registers.statusZero = this.registers.acc & memory ? 0x00 : 0x01;
      this.registers.statusNegative = memory >> 7;
      this.registers.statusOverflow = (memory >> 6) & 0x01;
    },

    /* Aとメモリを比較演算してフラグを操作
     * 演算結果は捨てる
     * A == mem -> Z = 0
     * A >= mem -> C = 1
     * A <= mem -> C = 0
     * */
    CMP: function(addr) {
      const result = this.registers.acc - this.ram.read(addr);
      this.registers.statusZero = Util.isZero(result);
      this.registers.statusNegative = Util.isNegative(result);

      if (result >= 0) {
        this.registers.statusCarry = 1;
      } else {
        this.registers.statusCarry = 0;
      }
    },

    /* Xとメモリを比較演算 */
    /* TODO フラグ操作が怪しいので要チェック */
    CPX: function(addr) {
      const result = this.registers.indexX - this.ram.read(addr);
      this.registers.statusZero = Util.isZero(result);
      this.registers.statusNegative = Util.isNegative(result);

      if (result >= 0) {
        this.registers.statusCarry = 1;
      } else {
        this.registers.statusCarry = 0;
      }
    },

    /* Yとメモリを比較演算*/
    CPY: function(addr) {
      const result = this.registers.indexY - this.ram.read(addr);
      this.registers.statusZero = Util.isZero(result);
      this.registers.statusNegative = Util.isNegative(result);

      if (result >= 0) {
        this.registers.statusCarry = 1;
      } else {
        this.registers.statusCarry = 0;
      }
    },

    /* *をインクリメント・デクリメントする
     * フラグ
     *   - negative
     *   - zero
     * */
    /* メモリをインクリメントする*/
    INC: function(addr) {
      const value = this.ram.read(addr);
      const result = Util.add(value, 1);
      this.ram.write(addr, result);
      this.registers.statusNegative = Util.isNegative(result);
      this.registers.statusZero = Util.isZero(result);
    },

    /* メモリをデクリメント */
    DEC: function(addr) {
      const value = this.ram.read(addr);
      const result = Util.sub(value, 1);
      this.ram.write(addr, result);
      this.registers.statusNegative = Util.isNegative(result);
      this.registers.statusZero = Util.isZero(result);
    },

    /* Xをインクリメントする */
    INX: function() {
      this.registers.indexX = Util.add(this.registers.indexX, 1);
      const value = this.registers.indexX;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Yをインクリメントする */
    INY: function() {
      this.registers.indexY = Util.add(this.registers.indexY, 1);
      const value = this.registers.indexY;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Xをデクリメント */
    DEX: function() {
      this.registers.indexX = Util.sub(this.registers.indexX, 1);
      const value = this.registers.indexX;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* Yをデクリメント*/
    DEY: function() {
      this.registers.indexY = Util.sub(this.registers.indexY, 1);
      const value = this.registers.indexY;
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

    /* accとメモリを論理XOR演算してaccに結果を返す*/
    EOR: function(addr) {
      const value = this.registers.acc ^ this.ram.read(addr);
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* accとメモリを論理OR演算して結果をaccへ返す */
    ORA: function(addr) {
      const value = this.registers.acc | this.ram.read(addr);
      this.registers.acc = value;
      this.registers.statusNegative = Util.isNegative(value);
      this.registers.statusZero = Util.isZero(value);
    },

    /* メモリを左へローテートする */
    ROL: function(addr) {
      const carry = this.registers.statusCarry;
      const value = addr ? this.ram.read(addr) : this.registers.acc;
      const msb = value >> 7;
      const rotated = ((value << 1) & 0xff) | carry;

      this.registers.statusCarry = msb;
      this.registers.statusZero = Util.isZero(rotated);
      this.registers.statusNegative = Util.isNegative(rotated);
      addr ? this.ram.write(addr, rotated) : this.registers.acc = rotated;
    },

    /* メモリを右へローテートする */
    ROR: function(addr) {
      const carry = this.registers.statusCarry << 7;
      const value = addr ? this.ram.read(addr) : this.registers.acc;
      const lsb = Util.lsb(value);
      const rotated = (value >> 1) | carry;

      this.registers.statusCarry = lsb;
      this.registers.statusZero = Util.isZero(rotated);
      this.registers.statusNegative = Util.isNegative(rotated);
      addr ? this.ram.write(addr, rotated) : this.registers.acc = rotated;
    },

    /* acc + memory + carryFlag
     * フラグ
     *   - negative
     *   - overflow
     *   - zero
     *   - carry
     * */
    ADC: function(addr) {
      const accValue = this.registers.acc;
      const memValue = this.ram.read(addr);
      const added = accValue + memValue;

      this.registers.acc = (added + this.registers.statusCarry) & 0xff;
      this.registers.statusCarry = (added + this.registers.statusCarry > 0xff) & 1;
      this.registers.statusZero = Util.isZero(this.registers.acc);
      this.registers.statusNegative = Util.isNegative(this.registers.acc);

      const accNegativeBit = Util.isNegative(accValue);
      const memNegativeBit = Util.isNegative(memValue);

      if (accNegativeBit === memNegativeBit) {
        const resultNegativeBit = this.registers.acc >> 7;
        if (resultNegativeBit !== accNegativeBit) {
          this.registers.statusOverflow = 1;
        } else {
          this.registers.statusOverflow = 0;
        }
      } else {
        this.registers.statusOverflow = 0;
      }
    },

    /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
    SBC: function(addr) {
      const accValue = this.registers.acc;
      const memValue = this.ram.read(addr);
      const subed = accValue - memValue - (!this.registers.statusCarry & 1);

      this.registers.acc = subed & 0xff;
      this.registers.statusCarry = !(subed < 0) & 1;
      this.registers.statusZero = Util.isZero(this.registers.acc);
      this.registers.statusNegative = Util.isNegative(this.registers.acc);

      const accNegativeBit = Util.isNegative(accValue);
      const memNegativeBit = Util.isNegative(memValue);

      if (accNegativeBit !== memNegativeBit) {
        const resultNegativeBit = this.registers.acc >> 7;
        if (resultNegativeBit !== accNegativeBit) {
          this.registers.statusOverflow = 1;
        } else {
          this.registers.statusOverflow = 0;
        }
      } else {
        this.registers.statusOverflow = 0;
      }
    },

    /* accをスタックにプッシュ */
    PHA: function() {
      this.stackPush(this.registers.acc);
    },

    /* スタックからaccにポップアップする */
    PLA: function() {
      const value = this.stackPop();
      this.registers.acc = value;
      this.registers.statusZero = Util.isZero(value);
      this.registers.statusNegative = Util.isNegative(value);
    },

    /* ステータス・レジスタをスタックにプッシュ
     * ステータスレジスタにBRKがセットされてからプッシュされる
     * プッシュ後はクリアされるのでスタックに保存されたステータスレジスタだけBRKが有効になる
     * */
    PHP: function() {
      this.stackPush(this.registers.statusAllRawBits | 0x10); //なぜか0x10とのORを取る
    },

    /* スタックからステータスレジスタにポップアップする
     * ポップされてからステータスレジスタのBRKがクリアされる
     */
    PLP: function() {
      this.registers.statusAllRawBits = this.stackPop() & 0xef; // なぜか0xefとのANDを取る
    },

    /* アドレスへジャンプする */
    JMP: function(addr) {
      this.registers.pc = addr;
    },

    /* サブルーチンを呼び出す
     * JSR命令のアドレスをスタックに積み、addrにジャンプする
     * */
    JSR: function(addr) {
      // JSR命令を読んだ時点でプログラムカウンタがインクリメントされているため、
      // デクリメントしてJSR命令のアドレスに合わす
      const jsrAddr = this.registers.pc - 1;
      const highAddr = jsrAddr >> 8;
      const lowAddr = jsrAddr & 0x00ff;

      this.stackPush(highAddr);
      this.stackPush(lowAddr);
      this.registers.pc = addr;
    },

    /* サブルーチンから復帰する */
    RTS: function() {
      const lowAddr = this.stackPop();
      const highAddr = this.stackPop();
      const addr = (highAddr << 8) | lowAddr;
      this.registers.pc = addr + 1;
    },

    /* 割り込みルーチンから復帰する */
    RTI: function() {
      this.registers.statusAllRawBits = this.stackPop();

      const lowAddr = this.stackPop();
      const highAddr = this.stackPop() << 8;
      this.registers.pc = lowAddr | highAddr;
    },

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
    CLI: function() {
      this.registers.statusInterrupt = 1;
    },

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
      } else if (addressing.name === 'bound implied') {
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

      const prefixAndValue = prefix + value;
      const chars = [
        addrOfOpcode.toString(16),
        instruction.name.split(' ')[1],
        addressing.name.split(' ')[1],
        prefixAndValue,
        this.registers.debugString()
      ].join(' ');

      // eslint-disable-next-line no-console
      console.log(chars);
    }

    static execute(instructionName, addressingName) {
      let addrOfOpcode;
      if (this.isDebug) {
        addrOfOpcode = this.registers.pc - 1;
      }

      const addressing = Addressing[addressingName].bind(this);
      const addr = addressing.call();

      const instruction = Instructions[instructionName].bind(this, addr);

      if (this.isDebug) {
        Util$1.debugString.call(this, instruction, addressing, addr, addrOfOpcode);
      }

      instruction.call();
    }
  }

  /* 0x00 - 0x0F */
  var x0x = [
    /* 0x00: BRK implied */
    function() {
      Util$1.execute.call(this, 'BRK', 'implied');
    },
    /* 0x01: ORA indexIndirect */
    function() {
      Util$1.execute.call(this, 'ORA', 'indexIndirect');
    },
    '2',
    '3',
    '4',
    /* 0x05: ORA zeropage */
    function() {
      Util$1.execute.call(this, 'ORA', 'zeropage');
    },
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
    /* 0x0a: ASL implied(accmulator)*/
    function() {
      Util$1.execute.call(this, 'ASL', 'implied');
    },
    'b',
    'c',
    /* 0x0d: ORA absolute */
    function() {
      Util$1.execute.call(this, 'ORA', 'absolute');
    },
    /* 0x0e: ASL absolute */
    function() {
      Util$1.execute.call(this, 'ASL', 'absolute');
    },
    ''
  ];

  /* 0x10 - 0x1F */
  var x1x = [
    /* 0x10 BPL relative */
    function() {
      Util$1.execute.call(this, 'BPL', 'relative');
    },
    /* 0x11 ORA indirectIndex */
    function() {
      Util$1.execute.call(this, 'ORA', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0x15: ORA zeropageX*/
    function() {
      Util$1.execute.call(this, 'ORA', 'zeropageX');
    },
    /* 0x16: ASL zeropageX */
    function() {
      Util$1.execute.call(this, 'ASL', 'zeropageX');
    },
    '7',
    /* 0x18: CLC implied */
    function() {
      Util$1.execute.call(this, 'CLC', 'implied');
    },
    /* 0x19: ORA abosluteY*/
    function() {
      Util$1.execute.call(this, 'ORA', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0x1d ORA absoluteX */
    function() {
      Util$1.execute.call(this, 'ORA', 'absoluteX');
    },
    /* 0x1e ASL absoluteX*/
    function() {
      Util$1.execute.call(this, 'ASL', 'absoluteX');
    },
    'f'
  ];

  /* 0x20 - 0x2F */
  var x2x = [
    /* 0x20: JSR absolute*/
    function() {
      Util$1.execute.call(this, 'JSR', 'absolute');
    },
    /* 0x21: AND indexIndirect */
    function() {
      Util$1.execute.call(this, 'AND', 'indexIndirect');
    },
    '2',
    '3',
    /* 0x24: BIT zeropage */
    function() {
      Util$1.execute.call(this, 'BIT', 'zeropage');
    },
    /* 0x25: AND zeropage */
    function() {
      Util$1.execute.call(this, 'AND', 'zeropage');
    },
    /* 0x26: ROL zeropage */
    function() {
      Util$1.execute.call(this, 'ROL', 'zeropage');
    },
    '7',
    /* 0x28: PLP implied */
    function() {
      Util$1.execute.call(this, 'PLP', 'implied');
    },
    /* 0x29: AND Immediate */
    function() {
      Util$1.execute.call(this, 'AND', 'immediate');
    },
    /* 0x2a: ROL implied (accmulator)*/
    function() {
      Util$1.execute.call(this, 'ROL', 'implied');
    },
    'b',
    /* 0x2c: BIT absolute */
    function() {
      Util$1.execute.call(this, 'BIT', 'absolute');
    },
    /* 0x2d: AND absolute */
    function() {
      Util$1.execute.call(this, 'AND', 'absolute');
    },
    /* 0x2e: ROL absolute*/
    function() {
      Util$1.execute.call(this, 'ROL', 'absolute');
    },
    ''
  ];

  /* 0x30 - 0x3F */
  var x3x = [
    /* 0x30: BMI relative */
    function() {
      Util$1.execute.call(this, 'BMI', 'relative');
    },
    /* 0x31: AND indirectIndex */
    function() {
      Util$1.execute.call(this, 'AND', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0x35: AND zeropageX */
    function() {
      Util$1.execute.call(this, 'AND', 'zeropageX');
    },
    /* 0x36 ROL zeropageX */
    function() {
      Util$1.execute.call(this, 'ROL', 'zeropageX');
    },
    '7',
    /* 0x38: SEC implied */
    function() {
      Util$1.execute.call(this, 'SEC', 'implied');
    },
    /* 0x39: AND absoluteY*/
    function() {
      Util$1.execute.call(this, 'AND', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0x3d: AND absoluteX */
    function() {
      Util$1.execute.call(this, 'AND', 'absoluteX');
    },
    /* 0x32: ROL absoluteX */
    function() {
      Util$1.execute.call(this, 'ROL', 'absoluteX');
    },
    'f'
  ];

  /* 0x40 - 0x4F */
  var x4x = [
    /* 0x40: RTI implied */
    function() {
      Util$1.execute.call(this, 'RTI', 'implied');
    },
    /* 0x41: EOR indexIndirect */
    function() {
      Util$1.execute.call(this, 'EOR', 'indexIndirect');
    },
    '2',
    '3',
    '4',
    /* 0x45: EOR zeropage */
    function() {
      Util$1.execute.call(this, 'EOR', 'zeropage');
    },
    /* 0x46: LSR zeropage*/
    function() {
      Util$1.execute.call(this, 'LSR', 'zeropage');
    },
    '7',
    /* 0x48: PHA implied */
    function() {
      Util$1.execute.call(this, 'PHA', 'implied');
    },
    /* 0x49: EOR immediate */
    function() {
      Util$1.execute.call(this, 'EOR', 'immediate');
    },
    /* 0x4a: LSR implied(accumulator) */
    function() {
      Util$1.execute.call(this, 'LSR', 'implied');
    },
    'b',
    /* 0x4c: JMP absolute */
    function() {
      Util$1.execute.call(this, 'JMP', 'absolute');
    },
    /* 0x4d: EOR absolute*/
    function() {
      Util$1.execute.call(this, 'EOR', 'absolute');
    },
    /* 0x4e: LSR absolute*/
    function() {
      Util$1.execute.call(this, 'LSR', 'absolute');
    },
    'f'
  ];

  /* 0x50 - 0x5F */
  var x5x = [
    /* 0x50: BVC relative */
    function() {
      Util$1.execute.call(this, 'BVC', 'relative');
    },
    /* 0x51: EOR indirectIndex */
    function() {
      Util$1.execute.call(this, 'EOR', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0x55: EOR zeropageX */
    function() {
      Util$1.execute.call(this, 'EOR', 'zeropageX');
    },
    /* 0x56: LSR zeropageX */
    function() {
      Util$1.execute.call(this, 'LSR', 'zeropageX');
    },
    '7',
    /* 0x58: CLI */
    function() {
      Util$1.execute.call(this, 'CLI', 'implied');
    },
    /* 0x59: EOR absoluteY */
    function() {
      Util$1.execute.call(this, 'EOR', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0x5d EOR absoluteX */
    function() {
      Util$1.execute.call(this, 'EOR', 'absoluteX');
    },
    /* 0x5e LSR absoluteX */
    function() {
      Util$1.execute.call(this, 'LSR', 'absoluteX');
    },
    ''
  ];

  /* 0x60 - 0x6F */
  var x6x = [
    /* 0x60: RTS implied */
    function() {
      Util$1.execute.call(this, 'RTS', 'implied');
    },
    /* 0x61: ADC indexIndirect */
    function() {
      Util$1.execute.call(this, 'ADC', 'indexIndirect');
    },
    '2',
    '3',
    '4',
    /* 0x65: ADC zeropage */
    function() {
      Util$1.execute.call(this, 'ADC', 'zeropage');
    },
    /* 0x66: ROR zeropage */
    function() {
      Util$1.execute.call(this, 'ROR', 'zeropage');
    },
    '7',
    /* 0x68: PLA implied */
    function() {
      Util$1.execute.call(this, 'PLA', 'implied');
    },
    /* 0x69: ADC immediate */
    function() {
      Util$1.execute.call(this, 'ADC', 'immediate');
    },
    /* 0x6a: ROR implied (accmulator) */
    function() {
      Util$1.execute.call(this, 'ROR', 'implied');
    },
    'b',
    /* 0x6c: JMP indirect */
    function() {
      Util$1.execute.call(this, 'JMP', 'indirect');
    },
    /* 0x6d: ADC absolute */
    function() {
      Util$1.execute.call(this, 'ADC', 'absolute');
    },
    /* 0x6e ROR absolute*/
    function() {
      Util$1.execute.call(this, 'ROR', 'absolute');
    },
    ''
  ];

  /* 0x70 - 0x7F */
  var x7x = [
    /* 0x70: BVS relative */
    function() {
      Util$1.execute.call(this, 'BVS', 'relative');
    },
    /* 0x71: ADC indirectIndex */
    function() {
      Util$1.execute.call(this, 'ADC', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0x75: ADC zeropageX */
    function() {
      Util$1.execute.call(this, 'ADC', 'zeropageX');
    },
    /* 0x76: ROR zeropageX */
    function() {
      Util$1.execute.call(this, 'ROR', 'zeropageX');
    },
    '7',
    /* 0x78: SEI implied */
    function() {
      Util$1.execute.call(this, 'SEI', 'implied');
    },
    /* 0x79: ADC absoluteY */
    function() {
      Util$1.execute.call(this, 'ADC', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0x7d: ADC absoluteX */
    function() {
      Util$1.execute.call(this, 'ADC', 'absoluteX');
    },
    /* 0x7e: ROR absoluteX */
    function() {
      Util$1.execute.call(this, 'ROR', 'absoluteX');
    },
    'f'
  ];

  /* 0x80 - 0x8F */
  var x8x = [
    '0',
    /* 0x81: STA indexIndirect */
    function() {
      Util$1.execute.call(this, 'STA', 'indexIndirect');
    },
    '2',
    '3',
    /* 0x84: STY zeropage */
    function() {
      Util$1.execute.call(this, 'STY', 'zeropage');
    },
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
    /* 0x8a: TXA implied */
    function() {
      Util$1.execute.call(this, 'TXA', 'implied');
    },
    'b',
    /* 0x8c STY absolute */
    function() {
      Util$1.execute.call(this, 'STY', 'absolute');
    },
    /* 0x8d: STA absolute */
    function() {
      Util$1.execute.call(this, 'STA', 'absolute');
    },
    /* 0x8e: STX absolute*/
    function() {
      Util$1.execute.call(this, 'STX', 'absolute');
    },
    'f'
  ];

  /* 0x90 - 0x9F */
  var x9x = [
    /* 0x90: BCC relative*/
    function() {
      Util$1.execute.call(this, 'BCC', 'relative');
    },
    /* 0x91: STA indirectIndex */
    function() {
      Util$1.execute.call(this, 'STA', 'indirectIndex');
    },
    '2',
    '3',
    /* 0x94: STY zeropageX */
    function() {
      Util$1.execute.call(this, 'STY', 'zeropageX');
    },
    /* 0x95: STA zeropageX */
    function() {
      Util$1.execute.call(this, 'STA', 'zeropageX');
    },
    /* 0x96: STX zeropageY */
    function() {
      Util$1.execute.call(this, 'STX', 'zeropageY');
    },
    '7',
    /* 0x98: TYA implied */
    function() {
      Util$1.execute.call(this, 'TYA', 'implied');
    },
    /* 0x99: STA absoluteY */
    function() {
      Util$1.execute.call(this, 'STA', 'absoluteY');
    },
    /* 0x9a: TXS implied */
    function() {
      Util$1.execute.call(this, 'TXS', 'implied');
    },
    'b',
    'c',
    /* 0x9d: STA absoluteX */
    function() {
      Util$1.execute.call(this, 'STA', 'absoluteX');
    },
    'e',
    'f'
  ];

  /* 0xA0 - 0xAF */
  var xAx = [
    /* 0xa0: LDY immediate*/
    function() {
      Util$1.execute.call(this, 'LDY', 'immediate');
    },
    /* 0xa1: LDA indexIndirect */
    function() {
      Util$1.execute.call(this, 'LDA', 'indexIndirect');
    },
    /* 0xA2: LDX immediate */
    function() {
      Util$1.execute.call(this, 'LDX', 'immediate');
    },
    '3',
    /* 0xa4: LDY zeropage */
    function() {
      Util$1.execute.call(this, 'LDY', 'zeropage');
    },
    /* 0xa5: LDA zeropage */
    function() {
      Util$1.execute.call(this, 'LDA', 'zeropage');
    },
    /* 0xa6 LDX zeropage */
    function() {
      Util$1.execute.call(this, 'LDX', 'zeropage');
    },
    '7',
    /* 0xa8: TAY implied */
    function() {
      Util$1.execute.call(this, 'TAY', 'implied');
    },
    /* 0xa9: LDA immediate */
    function() {
      Util$1.execute.call(this, 'LDA', 'immediate');
    },
    /* 0xaa: TAX implied */
    function() {
      Util$1.execute.call(this, 'TAX', 'implied');
    },
    'b',
    /* 0xac: LDY absolute */
    function() {
      Util$1.execute.call(this, 'LDY', 'absolute');
    },
    /* 0xad: LDA absolute */
    function() {
      Util$1.execute.call(this, 'LDA', 'absolute');
    },
    /* 0xae: LDX absolute */
    function() {
      Util$1.execute.call(this, 'LDX', 'absolute');
    },
    ''
  ];

  /* 0xb0 - 0xbF */
  var xBx = [
    /* 0xb0: BCS implied */
    function() {
      Util$1.execute.call(this, 'BCS', 'relative');
    },
    /* 0xb1: LDA indirectIndex */
    function() {
      Util$1.execute.call(this, 'LDA', 'indirectIndex');
    },
    '2',
    '3',
    /* 0xb4: LDY zeropageX */
    function() {
      Util$1.execute.call(this, 'LDY', 'zeropageX');
    },
    /* 0xb5: LDA zeropageX */
    function() {
      Util$1.execute.call(this, 'LDA', 'zeropageX');
    },
    /* 0xb6: LDX zeropageY */
    function() {
      Util$1.execute.call(this, 'LDX', 'zeropageY');
    },
    '7',
    /* 0xb8: CLV implied */
    function() {
      Util$1.execute.call(this, 'CLV', 'implied');
    },
    /* 0xb9: LDA absoluteY */
    function() {
      Util$1.execute.call(this, 'LDA', 'absoluteY');
    },
    /* 0xba: TSX implied */
    function() {
      Util$1.execute.call(this, 'TSX', 'implied');
    },
    'b',
    /* 0xbc: LDY absoluteX*/
    function() {
      Util$1.execute.call(this, 'LDY', 'absoluteX');
    },
    /* 0xbd: LDA bsoluteX */
    function() {
      Util$1.execute.call(this, 'LDA', 'absoluteX');
    },
    /* 0xbe: LDX absoluteY*/
    function() {
      Util$1.execute.call(this, 'LDX', 'absoluteY');
    },
    'f'
  ];

  /* 0xc0 - 0xcF */
  var xCx = [
    /* 0xc0: CPY immediate */
    function() {
      Util$1.execute.call(this, 'CPY', 'immediate');
    },
    /* 0xc1: CMP indexIndirect */
    function() {
      Util$1.execute.call(this, 'CMP', 'indexIndirect');
    },
    '2',
    '3',
    /* 0xc4: CPY zeropage*/
    function() {
      Util$1.execute.call(this, 'CPY', 'zeropage');
    },
    /* 0xc5: CMP zeropage */
    function() {
      Util$1.execute.call(this, 'CMP', 'zeropage');
    },
    /* 0xc6: DEC zeropage*/
    function() {
      Util$1.execute.call(this, 'DEC', 'zeropage');
    },
    '7',
    /* 0xc8: INY implied */
    function() {
      Util$1.execute.call(this, 'INY', 'implied');
    },
    /* 0xc9: CMP immediate */
    function() {
      Util$1.execute.call(this, 'CMP', 'immediate');
    },
    /* 0xca: DEX implied */
    function() {
      Util$1.execute.call(this, 'DEX', 'implied');
    },
    'b',
    /* 0xcc: CPY absolute */
    function() {
      Util$1.execute.call(this, 'CPY', 'absolute');
    },
    /* 0xcd: CMP absolute*/
    function() {
      Util$1.execute.call(this, 'CMP', 'absolute');
    },
    /* 0xce: DEC absolute */
    function() {
      Util$1.execute.call(this, 'DEC', 'absolute');
    },
    ''
  ];

  /* 0xd0 - 0xdF */
  var xDx = [
    /* 0xd0: BNE relative */
    function() {
      Util$1.execute.call(this, 'BNE', 'relative');
    },
    /* 0xd1: CMP indirectIndex */
    function() {
      Util$1.execute.call(this, 'CMP', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0xd5: CMP zeropageX */
    function() {
      Util$1.execute.call(this, 'CMP', 'zeropageX');
    },
    /* 0xd6: DEC zeropageX */
    function() {
      Util$1.execute.call(this, 'DEC', 'zeropageX');
    },
    '7',
    /* 0xd8: CLD implied */
    function() {
      Util$1.execute.call(this, 'CLD', 'implied');
    },
    /* 0xd9: CMP absoluteY */
    function() {
      Util$1.execute.call(this, 'CMP', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0xdd: CMP absoluteX */
    function() {
      Util$1.execute.call(this, 'CMP', 'absoluteX');
    },
    /* 0xde: DEC absoluteX */
    function() {
      Util$1.execute.call(this, 'DEC', 'absoluteX');
    },
    'f'
  ];

  /* 0xe0 - 0xeF */
  var xEx = [
    /* 0xe0: CPX immediate */
    function() {
      Util$1.execute.call(this, 'CPX', 'immediate');
    },
    /* 0xe1: SBC indexIndirect */
    function() {
      Util$1.execute.call(this, 'SBC', 'indexIndirect');
    },
    '2',
    '3',
    /* 0xe4: CPX zeropage */
    function() {
      Util$1.execute.call(this, 'CPX', 'zeropage');
    },
    /* 0xe5: SBC zeropage*/
    function() {
      Util$1.execute.call(this, 'SBC', 'zeropage');
    },
    /* 0xe6: INC zeropage*/
    function() {
      Util$1.execute.call(this, 'INC', 'zeropage');
    },
    '7',
    /* 0xe8: INX implied */
    function() {
      Util$1.execute.call(this, 'INX', 'implied');
    },
    /* 0xe9: SBC immediate */
    function() {
      Util$1.execute.call(this, 'SBC', 'immediate');
    },
    /* 0xea: NOP implied */
    function() {
      Util$1.execute.call(this, 'NOP', 'implied');
    },
    'b',
    /* 0xec: CPX absolute */
    function() {
      Util$1.execute.call(this, 'CPX', 'absolute');
    },
    /* 0xed: SBC absolute */
    function() {
      Util$1.execute.call(this, 'SBC', 'absolute');
    },
    /* 0xee: INC absolute*/
    function() {
      Util$1.execute.call(this, 'INC', 'absolute');
    },
    'f'
  ];

  /* 0xf0 - 0xff */
  var xFx = [
    /* 0xf0: BEQ relative */
    function() {
      Util$1.execute.call(this, 'BEQ', 'relative');
    },
    /* 0xf1: SBC indirectIndex */
    function() {
      Util$1.execute.call(this, 'SBC', 'indirectIndex');
    },
    '2',
    '3',
    '4',
    /* 0xf5: SBC zeropageX */
    function() {
      Util$1.execute.call(this, 'SBC', 'zeropageX');
    },
    /* 0xf6: INC zeropageX */
    function() {
      Util$1.execute.call(this, 'INC', 'zeropageX');
    },
    '7',
    /* 0xf8: SED implied */
    function() {
      Util$1.execute.call(this, 'SED', 'implied');
    },
    /* 0xf9 SBC absoluteY */
    function() {
      Util$1.execute.call(this, 'SBC', 'absoluteY');
    },
    'a',
    'b',
    'c',
    /* 0xfd: SBC absoluteX */
    function() {
      Util$1.execute.call(this, 'SBC', 'absoluteX');
    },
    /* 0xfe: INC absoluteX */
    function() {
      Util$1.execute.call(this, 'INC', 'absoluteX');
    },
    'f'
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

  class Util$2 {
    static isNodejs() {
      return typeof process !== 'undefined' && typeof require !== 'undefined'
    }
  }

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

      Util$2.isNodejs() ? setInterval(execute, 10) : execute();
    }

    // 命令を処理する
    eval() {
      const addr = this.registers.pc++;
      const opcode = this.ram.read(addr);

      if (typeof this.opcodes[opcode] !== 'function') {
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

      // プログラムカウンタの初期値を0xFFFCから設定する
      //this.registers.pc = this.ram.read(0xfffc) << 2
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9hZGRyZXNzaW5nL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvaW5zdHJ1Y3Rpb25zL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzL3V0aWwuanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgweC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgzeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy91dGlsLmpzIiwiLi4vc3JjL2NwdS9jcHUuanMiLCIuLi9zcmMvcHB1L3ZyYW0uanMiLCIuLi9zcmMvcHB1L3BwdS5qcyIsIi4uL3NyYy9idXMvaW5kZXguanMiLCIuLi9zcmMvbmVzLmpzIiwiLi4vc3JjL3JvbS9pbmRleC5qcyIsIi4uL3NyYy9yZW5kZXJlci9jb2xvcnMuanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVnaXN0ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFjY18gPSAweDAwIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICAgIHRoaXMuaW5kZXhYXyA9IDB4MDAgLy8g44Ki44OJ44Os44OD44K344Oz44Kw44CB44Kr44Km44Oz44K/562J44Gr55So44GE44KLXG4gICAgdGhpcy5pbmRleFlfID0gMHgwMCAvLyDkuIrjgavlkIzjgZhcbiAgICB0aGlzLnNwXyA9IDB4MDFmZCAvLyDjgrnjgr/jg4Pjgq/jg53jgqTjg7Pjgr8gJDAxMDAtJDAxRkYsIOWIneacn+WApOOBrzB4MDFmZOOBo+OBveOBhFxuICAgIHRoaXMuc3RhdHVzXyA9IDB4MjRcbiAgICAvKlxuICAgIHN0YXR1czoge1xuICAgICAgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgICBuZWdhdGl2ZV86IDAsXG4gICAgICBvdmVyZmxvd186IDAsXG4gICAgICByZXNlcnZlZF86IDEsXG4gICAgICBicmVha186IDAsIC8vIOWJsuOCiui+vOOBv0JSS+eZuueUn+aZguOBq3RydWUsSVJR55m655Sf5pmC44GrZmFsc2VcbiAgICAgIGRlY2ltYWxfOiAwLFxuICAgICAgaW50ZXJydXB0XzogMSxcbiAgICAgIHplcm9fOiAwLFxuICAgICAgY2FycnlfOiAwXG4gICAgfVxuICAgICovXG4gICAgdGhpcy5wYyA9IDB4ODAwMCAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr9cbiAgfVxuXG4gIGRlYnVnU3RyaW5nKCkge1xuICAgIHJldHVybiBbXG4gICAgICAnQTonICsgdGhpcy5hY2MudG9TdHJpbmcoMTYpLFxuICAgICAgJ1g6JyArIHRoaXMuaW5kZXhYLnRvU3RyaW5nKDE2KSxcbiAgICAgICdZOicgKyB0aGlzLmluZGV4WS50b1N0cmluZygxNiksXG4gICAgICAnUDonICsgdGhpcy5zdGF0dXNBbGxSYXdCaXRzLnRvU3RyaW5nKDE2KSxcbiAgICAgICdTUDonICsgKHRoaXMuc3AgJiAweGZmKS50b1N0cmluZygxNilcbiAgICBdLmpvaW4oJyAnKVxuICB9XG5cbiAgZ2V0IHN0YXR1c0FsbFJhd0JpdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzX1xuICB9XG5cbiAgc2V0IHN0YXR1c0FsbFJhd0JpdHMoYml0cykge1xuICAgIHRoaXMuc3RhdHVzXyA9IGJpdHNcbiAgICB0aGlzLnN0YXR1c1Jlc2VydmVkID0gMSAvLyByZXNlcnZlZOOBr+W4uOOBqzHjgavjgrvjg4Pjg4jjgZXjgozjgabjgYTjgotcbiAgfVxuXG4gIGdldCBhY2MoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWNjX1xuICB9XG5cbiAgc2V0IGFjYyh2YWx1ZSkge1xuICAgIHRoaXMuYWNjXyA9IHZhbHVlICYgMHhmZlxuICB9XG5cbiAgZ2V0IGluZGV4WCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRleFhfXG4gIH1cblxuICBzZXQgaW5kZXhYKHZhbHVlKSB7XG4gICAgdGhpcy5pbmRleFhfID0gdmFsdWUgJiAweGZmXG4gIH1cblxuICBnZXQgaW5kZXhZKCkge1xuICAgIHJldHVybiB0aGlzLmluZGV4WV9cbiAgfVxuXG4gIHNldCBpbmRleFkodmFsdWUpIHtcbiAgICB0aGlzLmluZGV4WV8gPSB2YWx1ZSAmIDB4ZmZcbiAgfVxuXG4gIGdldCBzcCgpIHtcbiAgICByZXR1cm4gdGhpcy5zcF9cbiAgfVxuXG4gIHNldCBzcCh2YWx1ZSkge1xuICAgIHRoaXMuc3BfID0gMHgwMTAwIHwgdmFsdWVcbiAgfVxuXG4gIGdldCBzdGF0dXNOZWdhdGl2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfID4+IDdcbiAgfVxuXG4gIHNldCBzdGF0dXNOZWdhdGl2ZShiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweDdmIC8vIDAxMTEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNylcbiAgfVxuXG4gIGdldCBzdGF0dXNPdmVyZmxvdygpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA2KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNPdmVyZmxvdyhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGJmIC8vIDEwMTEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNilcbiAgfVxuXG4gIGdldCBzdGF0dXNSZXNlcnZlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA1KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNSZXNlcnZlZChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGRmIC8vIDExMDEgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNSlcbiAgfVxuXG4gIGdldCBzdGF0dXNCcmVhaygpIHtcbiAgICByZXR1cm4gKHRoaXMuc3RhdHVzXyA+PiA0KSAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNCcmVhayhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGVmIC8vIDExMTAgMTExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgNClcbiAgfVxuXG4gIGdldCBzdGF0dXNEZWNpbWFsKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDMpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0RlY2ltYWwoYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfICYgMHhmNyAvLyAxMTExIDAxMTFcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCAoYml0IDw8IDMpXG4gIH1cblxuICBnZXQgc3RhdHVzSW50ZXJydXB0KCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDIpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0ludGVycnVwdChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGZiIC8vIDExMTEgMTAxMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgMilcbiAgfVxuXG4gIGdldCBzdGF0dXNaZXJvKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDEpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c1plcm8oYml0KSB7XG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfICYgMHhmZCAvLyAxMTExIDExMDFcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gfCAoYml0IDw8IDEpXG4gIH1cblxuICBnZXQgc3RhdHVzQ2FycnkoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzXyAmIDB4MDFcbiAgfVxuXG4gIHNldCBzdGF0dXNDYXJyeShiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGZlIC8vIDExMTEgMTExMFxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IGJpdFxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4MTAwMDApXG4gIH1cblxuICAvKiBNZW1vcnkgbWFwcGVkIEkvT+OBp+OBguOCi+OBn+OCge+8jOODkOOCuShCdXMp44KS5o6l57aa44GX44Gm44GK44GPXG4gICAqIFBQVeetieOBuOOBr0J1c+OCkumAmuOBl+OBpuODh+ODvOOCv+OBruOChOOCiuWPluOCiuOCkuihjOOBhlxuICAgKiAqL1xuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmICh0aGlzLmJ1cyA9IHBhcnRzLmJ1cylcbiAgfVxuXG4gIC8qVE9ETyDlkITjg53jg7zjg4goYWRkcinjgavjgqLjgq/jgrvjgrnjgYzjgYLjgaPjgZ/loLTlkIjjgavjga/jg5Djgrnjgavmm7jjgY3ovrzjgoAgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBpZiAoYWRkciA+PSAweDIwMDAgJiYgYWRkciA8PSAweDIwMDcpIHtcbiAgICAgIHRoaXMuYnVzLndyaXRlKGFkZHIsIHZhbHVlKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8g6YCa5bi444Gu44Oh44Oi44Oq44Ki44Kv44K744K5XG4gICAgdGhpcy5tZW1vcnlbYWRkcl0gPSB2YWx1ZVxuICB9XG5cbiAgLypUT0RPIOOCs+ODs+ODiOODreODvOODqeeUqOOBruODneODvOODiCAqL1xuICByZWFkKGFkZHIpIHtcbiAgICByZXR1cm4gdGhpcy5tZW1vcnlbYWRkcl1cbiAgfVxufVxuIiwiLyog44Ki44OJ44Os44OD44K344Oz44Kw44Gr44GvYWNjdW11bGF0b3LjgoLjgYLjgovjgYzjgIFcbiAqIGFjY3VtdWxhdG9y44Gv55u05o6l5ZG95Luk5YaF44Gn5Y+C54Wn44GZ44KL44Gu44Gn44CBXG4gKiDlrp/oo4Xjga7pg73lkIjkuIrjgIHplqLmlbDjga/lv4XopoHjgarjgYTjgIIqL1xuZXhwb3J0IGRlZmF1bHQge1xuICBpbXBsaWVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9LFxuICAvKiA4Yml044Gu5Y2z5YCk44Gq44Gu44Gn44Ki44OJ44Os44K544KS44Gd44Gu44G+44G+6L+U44GZICovXG4gIGltbWVkaWF0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICByZXR1cm4gYWRkclxuICB9LFxuXG4gIC8qIOOCouODieODrOOCuWFkZHIoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2U6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuICAgIHJldHVybiBhZGRyXG4gIH0sXG5cbiAgLyogKOOCouODieODrOOCuWFkZHIgKyDjg6zjgrjjgrnjgr9pbmRleFgpKDhiaXQp44KS6L+U44GZICovXG4gIHplcm9wYWdlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmXG4gIH0sXG5cbiAgLyog5LiK44Go5ZCM44GY44GnaW5kZXhZ44Gr5pu/44GI44KL44Gg44GRKi9cbiAgemVyb3BhZ2VZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICByZXR1cm4gYWRkciAmIDB4ZmZcbiAgfSxcblxuICAvKiB6ZXJvcGFnZeOBrmFkZHLjgYwxNmJpdOeJiCAqL1xuICBhYnNvbHV0ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGFkZHIgPSBsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpXG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIGFic29sdXRlWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGFkZHIgPSAobG93QWRkciB8IChoaWdoQWRkciA8PCA4KSkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgbG93QWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgbG93QWRkciA9IHRoaXMucmFtLnJlYWQobG93QWRkcl8pXG5cbiAgICBjb25zdCBoaWdoQWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnJhbS5yZWFkKGhpZ2hBZGRyXylcblxuICAgIGNvbnN0IGxvd0FkZHJfXyA9IGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOClcbiAgICBjb25zdCBoaWdoQWRkcl9fID0gKChsb3dBZGRyKzEpICYgMHhmZikgfCAoaGlnaEFkZHIgPDwgOClcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyX18pIHwgKHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfXykgPDwgOClcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgaW5kZXhJbmRpcmVjdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHJfID0gKHRoaXMucmFtLnJlYWQoYWRkcl9fKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WCkgJiAweGZmXG5cbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXylcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoKGFkZHJfICsgMSkgJiAweGZmICkgPDwgOFxuXG4gICAgY29uc3QgYWRkciA9IGxvd0FkZHIgfCBoaWdoQWRkclxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRpcmVjdEluZGV4OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJhbS5yZWFkKGFkZHJfXylcblxuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZCgoYWRkcl8gKyAxKSAmIDB4ZmYgKSA8PCA4XG5cbiAgICBsZXQgYWRkciA9IGxvd0FkZHIgfCBoaWdoQWRkclxuXG4gICAgYWRkciA9IChhZGRyICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKSAmIDB4ZmZmZlxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICAvKiAo44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/ICsg44Kq44OV44K744OD44OIKeOCkui/lOOBmeOAglxuICAgKiDjgqrjg5Xjgrvjg4Pjg4jjga7oqIjnrpfjgafjga/nrKblj7fku5jjgY3jga7lgKTjgYzkvb/nlKjjgZXjgozjgovjgIJcbiAgICog56ym5Y+35LuY44GN44Gu5YCk44GvXG4gICAqICAgLTEyOCgweDgwKSB+IC0xICgweGZmKVxuICAgKiAgIDAoMHgwMCkgfiAxMjcoMHg3ZilcbiAgICogKi9cbiAgcmVsYXRpdmU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IHNpZ25lZE51bWJlciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pXG5cbiAgICBsZXQgYWRkciA9XG4gICAgICBzaWduZWROdW1iZXIgPj0gMHg4MFxuICAgICAgICA/IHRoaXMucmVnaXN0ZXJzLnBjICsgc2lnbmVkTnVtYmVyIC0gMHgxMDBcbiAgICAgICAgOiB0aGlzLnJlZ2lzdGVycy5wYyArIHNpZ25lZE51bWJlclxuXG4gICAgcmV0dXJuIGFkZHJcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICBpc05lZ2F0aXZlOiB2YWx1ZSA9PiB2YWx1ZSA+PiA3LFxuICBpc1plcm86IHZhbHVlID0+ICh2YWx1ZSA9PT0gMHgwMCkgJiAxLFxuICBtc2I6IHZhbHVlID0+IHZhbHVlID4+IDcsXG4gIGxzYjogdmFsdWUgPT4gdmFsdWUgJiAweDAxLFxuICBhZGQ6IChhLCBiKSA9PiAoYSArIGIpICYgMHhmZixcbiAgc3ViOiAoYSwgYikgPT4gKGEgLSBiKSAmIDB4ZmZcbn1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuZXhwb3J0IGRlZmF1bHQge1xuICAvKiBMRCogKExvYWQgbWVtb3J5W2FkZHIpIHRvICogcmVnaXN0ZXIpXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmUgOiDlr77osaHjga7mnIDkuIrkvY3jg5Pjg4Pjg4goMOOBi+OCieaVsOOBiOOBpjdiaXTnm64pXG4gICAqICAgLSB6ZXJvIDog6KiI566X57WQ5p6c44GM44K844Ot44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDBcbiAgICogKi9cbiAgTERBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG4gIC8qIOODrOOCuOOCueOCv2luZGV4WOOBq2RhdGHjgpLjg63jg7zjg4njgZnjgosgKi9cbiAgTERYOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgTERZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogU1QqIChTdG9yZSBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44Kw5pON5L2c44Gv54Sh44GXXG4gICAqICovXG4gIFNUQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgfSxcblxuICBTVFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFgpXG4gIH0sXG5cbiAgU1RZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKVxuICB9LFxuXG4gIC8qIFQqKiAoVHJhbnNmZXIgKiByZWdpc3RlciB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICovXG4gIFRBWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2NcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUQVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFNYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLnNwXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFhBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8vIFRYU+OBr+S7luOBrlRYKuOBqOmBleOBhOOAgeODleODqeOCsOOCkuWkieabtOOBl+OBquOBhFxuICBUWFM6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgdGhpcy5yZWdpc3RlcnMuc3AgPSB2YWx1ZVxuICAgIC8vdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgLy90aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVFlBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBvuOBn+OBr+ODoeODouODquOCkuW3puOBuOOCt+ODleODiFxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICAgLSBjYXJyeVxuICAgKiAqL1xuICBBU0w6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGFkZHIgPyB0aGlzLnJhbS5yZWFkKGFkZHIpIDogdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgY29uc3QgbXNiID0gVXRpbC5tc2IodmFsdWUpXG4gICAgY29uc3Qgc2hpZnRlZCA9ICh2YWx1ZSA8PCAxKSAmIDB4ZmZcblxuICAgIGFkZHIgPyB0aGlzLnJhbS53cml0ZShhZGRyLCBzaGlmdGVkKSA6IHRoaXMucmVnaXN0ZXJzLmFjYyA9IHNoaWZ0ZWRcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShzaGlmdGVkKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyhzaGlmdGVkKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gIH0sXG5cbiAgLyogYWNj44G+44Gf44Gv44Oh44Oi44Oq44KS5Y+z44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIC8qIExvZ2ljYWwgU2hpZnQgUmlnaHQgKi9cbiAgTFNSOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhZGRyID8gdGhpcy5yYW0ucmVhZChhZGRyKSA6IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIGNvbnN0IGxzYiA9IFV0aWwubHNiKHZhbHVlKVxuICAgIGNvbnN0IHNoaWZ0ZWQgPSB2YWx1ZSA+PiAxXG5cbiAgICBhZGRyID8gdGhpcy5yYW0ud3JpdGUoYWRkciwgc2hpZnRlZCkgOiB0aGlzLnJlZ2lzdGVycy5hY2MgPSBzaGlmdGVkXG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShzaGlmdGVkKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyhzaGlmdGVkKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkkFOROa8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nOOBmeOCi1xuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogKi9cbiAgQklUOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgbWVtb3J5ID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIG1lbW9yeSA/IDB4MDAgOiAweDAxXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBtZW1vcnkgPj4gN1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gKG1lbW9yeSA+PiA2KSAmIDB4MDFcbiAgfSxcblxuICAvKiBB44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566X44GX44Gm44OV44Op44Kw44KS5pON5L2cXG4gICAqIOa8lOeul+e1kOaenOOBr+aNqOOBpuOCi1xuICAgKiBBID09IG1lbSAtPiBaID0gMFxuICAgKiBBID49IG1lbSAtPiBDID0gMVxuICAgKiBBIDw9IG1lbSAtPiBDID0gMFxuICAgKiAqL1xuICBDTVA6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnJlZ2lzdGVycy5hY2MgLSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShyZXN1bHQpXG5cbiAgICBpZiAocmVzdWx0ID49IDApIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDBcbiAgICB9XG4gIH0sXG5cbiAgLyogWOOBqOODoeODouODquOCkuavlOi8g+a8lOeulyAqL1xuICAvKiBUT0RPIOODleODqeOCsOaTjeS9nOOBjOaAquOBl+OBhOOBruOBp+imgeODgeOCp+ODg+OCryAqL1xuICBDUFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFggLSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShyZXN1bHQpXG5cbiAgICBpZiAocmVzdWx0ID49IDApIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDBcbiAgICB9XG4gIH0sXG5cbiAgLyogWeOBqOODoeODouODquOCkuavlOi8g+a8lOeulyovXG4gIENQWTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WSAtIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8ocmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHJlc3VsdClcblxuICAgIGlmIChyZXN1bHQgPj0gMCkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMFxuICAgIH1cbiAgfSxcblxuICAvKiAq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44O744OH44Kv44Oq44Oh44Oz44OI44GZ44KLXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogKi9cbiAgLyog44Oh44Oi44Oq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLKi9cbiAgSU5DOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgY29uc3QgcmVzdWx0ID0gVXRpbC5hZGQodmFsdWUsIDEpXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgcmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8ocmVzdWx0KVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuODh+OCr+ODquODoeODs+ODiCAqL1xuICBERUM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICBjb25zdCByZXN1bHQgPSBVdGlsLnN1Yih2YWx1ZSwgMSlcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCByZXN1bHQpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUocmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyhyZXN1bHQpXG4gIH0sXG5cbiAgLyogWOOCkuOCpOODs+OCr+ODquODoeODs+ODiOOBmeOCiyAqL1xuICBJTlg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IFV0aWwuYWRkKHRoaXMucmVnaXN0ZXJzLmluZGV4WCwgMSlcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBZ44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gVXRpbC5hZGQodGhpcy5yZWdpc3RlcnMuaW5kZXhZLCAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIFjjgpLjg4fjgq/jg6rjg6Hjg7Pjg4ggKi9cbiAgREVYOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSBVdGlsLnN1Yih0aGlzLnJlZ2lzdGVycy5pbmRleFgsIDEpXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogWeOCkuODh+OCr+ODquODoeODs+ODiCovXG4gIERFWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gVXRpbC5zdWIodGhpcy5yZWdpc3RlcnMuaW5kZXhZLCAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjYyAmIG1lbW9yeVthZGRyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICovXG4gIEFORDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjICYgdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhlhPUua8lOeul+OBl+OBpmFjY+OBq+e1kOaenOOCkui/lOOBmSovXG4gIEVPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjIF4gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhk9S5ryU566X44GX44Gm57WQ5p6c44KSYWNj44G46L+U44GZICovXG4gIE9SQTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjIHwgdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuW3puOBuOODreODvOODhuODvOODiOOBmeOCiyAqL1xuICBST0w6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgY29uc3QgdmFsdWUgPSBhZGRyID8gdGhpcy5yYW0ucmVhZChhZGRyKSA6IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIGNvbnN0IG1zYiA9IHZhbHVlID4+IDdcbiAgICBjb25zdCByb3RhdGVkID0gKCh2YWx1ZSA8PCAxKSAmIDB4ZmYpIHwgY2FycnlcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJvdGF0ZWQpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUocm90YXRlZClcbiAgICBhZGRyID8gdGhpcy5yYW0ud3JpdGUoYWRkciwgcm90YXRlZCkgOiB0aGlzLnJlZ2lzdGVycy5hY2MgPSByb3RhdGVkXG4gIH0sXG5cbiAgLyog44Oh44Oi44Oq44KS5Y+z44G444Ot44O844OG44O844OI44GZ44KLICovXG4gIFJPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGNhcnJ5ID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPDwgN1xuICAgIGNvbnN0IHZhbHVlID0gYWRkciA/IHRoaXMucmFtLnJlYWQoYWRkcikgOiB0aGlzLnJlZ2lzdGVycy5hY2NcbiAgICBjb25zdCBsc2IgPSBVdGlsLmxzYih2YWx1ZSlcbiAgICBjb25zdCByb3RhdGVkID0gKHZhbHVlID4+IDEpIHwgY2FycnlcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJvdGF0ZWQpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUocm90YXRlZClcbiAgICBhZGRyID8gdGhpcy5yYW0ud3JpdGUoYWRkciwgcm90YXRlZCkgOiB0aGlzLnJlZ2lzdGVycy5hY2MgPSByb3RhdGVkXG4gIH0sXG5cbiAgLyogYWNjICsgbWVtb3J5ICsgY2FycnlGbGFnXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIG92ZXJmbG93XG4gICAqICAgLSB6ZXJvXG4gICAqICAgLSBjYXJyeVxuICAgKiAqL1xuICBBREM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBhY2NWYWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIGNvbnN0IG1lbVZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IGFkZGVkID0gYWNjVmFsdWUgKyBtZW1WYWx1ZVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gKGFkZGVkICsgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkpICYgMHhmZlxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gKGFkZGVkICsgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPiAweGZmKSAmIDFcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odGhpcy5yZWdpc3RlcnMuYWNjKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHRoaXMucmVnaXN0ZXJzLmFjYylcblxuICAgIGNvbnN0IGFjY05lZ2F0aXZlQml0ID0gVXRpbC5pc05lZ2F0aXZlKGFjY1ZhbHVlKVxuICAgIGNvbnN0IG1lbU5lZ2F0aXZlQml0ID0gVXRpbC5pc05lZ2F0aXZlKG1lbVZhbHVlKVxuXG4gICAgaWYgKGFjY05lZ2F0aXZlQml0ID09PSBtZW1OZWdhdGl2ZUJpdCkge1xuICAgICAgY29uc3QgcmVzdWx0TmVnYXRpdmVCaXQgPSB0aGlzLnJlZ2lzdGVycy5hY2MgPj4gN1xuICAgICAgaWYgKHJlc3VsdE5lZ2F0aXZlQml0ICE9PSBhY2NOZWdhdGl2ZUJpdCkge1xuICAgICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvdyA9IDFcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvdyA9IDBcbiAgICB9XG4gIH0sXG5cbiAgLyogKGFjYyAtIOODoeODouODqiAtIOOCreODo+ODquODvOODleODqeOCsCnjgpLmvJTnrpfjgZfjgaZhY2Pjgbjov5TjgZkgKi9cbiAgU0JDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgYWNjVmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2NcbiAgICBjb25zdCBtZW1WYWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICBjb25zdCBzdWJlZCA9IGFjY1ZhbHVlIC0gbWVtVmFsdWUgLSAoIXRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ICYgMSlcblxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHN1YmVkICYgMHhmZlxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gIShzdWJlZCA8IDApICYgMVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh0aGlzLnJlZ2lzdGVycy5hY2MpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodGhpcy5yZWdpc3RlcnMuYWNjKVxuXG4gICAgY29uc3QgYWNjTmVnYXRpdmVCaXQgPSBVdGlsLmlzTmVnYXRpdmUoYWNjVmFsdWUpXG4gICAgY29uc3QgbWVtTmVnYXRpdmVCaXQgPSBVdGlsLmlzTmVnYXRpdmUobWVtVmFsdWUpXG5cbiAgICBpZiAoYWNjTmVnYXRpdmVCaXQgIT09IG1lbU5lZ2F0aXZlQml0KSB7XG4gICAgICBjb25zdCByZXN1bHROZWdhdGl2ZUJpdCA9IHRoaXMucmVnaXN0ZXJzLmFjYyA+PiA3XG4gICAgICBpZiAocmVzdWx0TmVnYXRpdmVCaXQgIT09IGFjY05lZ2F0aXZlQml0KSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3cgPSAwXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMFxuICAgIH1cbiAgfSxcblxuICAvKiBhY2PjgpLjgrnjgr/jg4Pjgq/jgavjg5fjg4Pjgrfjg6UgKi9cbiAgUEhBOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YWNrUHVzaCh0aGlzLnJlZ2lzdGVycy5hY2MpXG4gIH0sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJYWNj44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnN0YWNrUG9wKClcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgfSxcblxuICAvKiDjgrnjg4bjg7zjgr/jgrnjg7vjg6zjgrjjgrnjgr/jgpLjgrnjgr/jg4Pjgq/jgavjg5fjg4Pjgrfjg6VcbiAgICog44K544OG44O844K/44K544Os44K444K544K/44GrQlJL44GM44K744OD44OI44GV44KM44Gm44GL44KJ44OX44OD44K344Ol44GV44KM44KLXG4gICAqIOODl+ODg+OCt+ODpeW+jOOBr+OCr+ODquOCouOBleOCjOOCi+OBruOBp+OCueOCv+ODg+OCr+OBq+S/neWtmOOBleOCjOOBn+OCueODhuODvOOCv+OCueODrOOCuOOCueOCv+OBoOOBkUJSS+OBjOacieWKueOBq+OBquOCi1xuICAgKiAqL1xuICBQSFA6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhY2tQdXNoKHRoaXMucmVnaXN0ZXJzLnN0YXR1c0FsbFJhd0JpdHMgfCAweDEwKSAvL+OBquOBnOOBizB4MTDjgajjga5PUuOCkuWPluOCi1xuICB9LFxuXG4gIC8qIOOCueOCv+ODg+OCr+OBi+OCieOCueODhuODvOOCv+OCueODrOOCuOOCueOCv+OBq+ODneODg+ODl+OCouODg+ODl+OBmeOCi1xuICAgKiDjg53jg4Pjg5fjgZXjgozjgabjgYvjgonjgrnjg4bjg7zjgr/jgrnjg6zjgrjjgrnjgr/jga5CUkvjgYzjgq/jg6rjgqLjgZXjgozjgotcbiAgICovXG4gIFBMUDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQWxsUmF3Qml0cyA9IHRoaXMuc3RhY2tQb3AoKSAmIDB4ZWYgLy8g44Gq44Gc44GLMHhlZuOBqOOBrkFOROOCkuWPluOCi1xuICB9LFxuXG4gIC8qIOOCouODieODrOOCueOBuOOCuOODo+ODs+ODl+OBmeOCiyAqL1xuICBKTVA6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgpLlkbzjgbPlh7rjgZlcbiAgICogSlNS5ZG95Luk44Gu44Ki44OJ44Os44K544KS44K544K/44OD44Kv44Gr56mN44G/44CBYWRkcuOBq+OCuOODo+ODs+ODl+OBmeOCi1xuICAgKiAqL1xuICBKU1I6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICAvLyBKU1Llkb3ku6TjgpLoqq3jgpPjgaDmmYLngrnjgafjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr/jgYzjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZXjgozjgabjgYTjgovjgZ/jgoHjgIFcbiAgICAvLyDjg4fjgq/jg6rjg6Hjg7Pjg4jjgZfjgaZKU1Llkb3ku6Tjga7jgqLjg4njg6zjgrnjgavlkIjjgo/jgZlcbiAgICBjb25zdCBqc3JBZGRyID0gdGhpcy5yZWdpc3RlcnMucGMgLSAxXG4gICAgY29uc3QgaGlnaEFkZHIgPSBqc3JBZGRyID4+IDhcbiAgICBjb25zdCBsb3dBZGRyID0ganNyQWRkciAmIDB4MDBmZlxuXG4gICAgdGhpcy5zdGFja1B1c2goaGlnaEFkZHIpXG4gICAgdGhpcy5zdGFja1B1c2gobG93QWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRTOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5zdGFja1BvcCgpXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnN0YWNrUG9wKClcbiAgICBjb25zdCBhZGRyID0gKGhpZ2hBZGRyIDw8IDgpIHwgbG93QWRkclxuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkciArIDFcbiAgfSxcblxuICAvKiDlibLjgorovrzjgb/jg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRJOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNBbGxSYXdCaXRzID0gdGhpcy5zdGFja1BvcCgpXG5cbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5zdGFja1BvcCgpXG4gICAgY29uc3QgaGlnaEFkZHIgPSB0aGlzLnN0YWNrUG9wKCkgPDwgOFxuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gbG93QWRkciB8IGhpZ2hBZGRyXG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJDQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCQ1M6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCvOODreODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCRVE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44K844Ot44OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQk5FOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm9cblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQk1JOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmVcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQlBMOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQlZDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJWUzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44K744OD44OI44GZ44KLICovXG4gIFNFQzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAxXG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44Kv44Oq44Ki44GX44G+44GZICovXG4gIENMQzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAwXG4gIH0sXG5cbiAgLyogSVJR5Ymy44KK6L6844G/44KS6Kix5Y+v44GZ44KLICovXG4gIENMSTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzSW50ZXJydXB0ID0gMVxuICB9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOCkuOCr+ODquOCouOBmeOCiyAqL1xuICBDTFY6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMFxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBq+ioreWumuOBmeOCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgU0VEOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNEZWNpbWFsID0gMVxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBi+OCiemAmuW4uOODouODvOODieOBq+aIu+OCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgQ0xEOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNEZWNpbWFsID0gMFxuICB9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuemgeatouOBmeOCi1xuICAgKiDjg5Xjg6njgrBcbiAgICogaW50ZXJydXB0IOOCkuOCu+ODg+ODiOOBmeOCi1xuICAgKiAqL1xuICBTRUk6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0ludGVycnVwdCA9IDFcbiAgfSxcblxuICAvKiDjgr3jg5Xjg4jjgqbjgqfjgqLlibLjgorovrzjgb/jgpLotbfjgZPjgZkqL1xuICBCUks6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0JyZWFrID0gMVxuICB9LFxuXG4gIC8qIOepuuOBruWRveS7pOOCkuWun+ihjOOBmeOCiyAqL1xuICBOT1A6IGZ1bmN0aW9uKCkge1xuICAgIC8vIOS9leOCguOBl+OBquOBhFxuICB9XG59XG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFV0aWwge1xuICBzdGF0aWMgZGVidWdTdHJpbmcoaW5zdHJ1Y3Rpb24sIGFkZHJlc3NpbmcsIHZhbHVlXywgYWRkck9mT3Bjb2RlKSB7XG4gICAgbGV0IHByZWZpeCA9ICckJ1xuICAgIGxldCB2YWx1ZVxuXG4gICAgaWYgKGFkZHJlc3NpbmcubmFtZSA9PT0gJ2JvdW5kIGltbWVkaWF0ZScpIHtcbiAgICAgIHByZWZpeCA9ICcjJCdcbiAgICAgIHZhbHVlID0gdGhpcy5yYW0ucmVhZCh2YWx1ZV8pXG4gICAgfSBlbHNlIGlmIChhZGRyZXNzaW5nLm5hbWUgPT09ICdib3VuZCBpbXBsaWVkJykge1xuICAgICAgcHJlZml4ID0gJydcbiAgICAgIHZhbHVlID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB2YWx1ZV9cbiAgICB9XG5cbiAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKDE2KVxuICAgIH1cblxuICAgIGNvbnN0IHByZWZpeEFuZFZhbHVlID0gcHJlZml4ICsgdmFsdWVcbiAgICBjb25zdCBjaGFycyA9IFtcbiAgICAgIGFkZHJPZk9wY29kZS50b1N0cmluZygxNiksXG4gICAgICBpbnN0cnVjdGlvbi5uYW1lLnNwbGl0KCcgJylbMV0sXG4gICAgICBhZGRyZXNzaW5nLm5hbWUuc3BsaXQoJyAnKVsxXSxcbiAgICAgIHByZWZpeEFuZFZhbHVlLFxuICAgICAgdGhpcy5yZWdpc3RlcnMuZGVidWdTdHJpbmcoKVxuICAgIF0uam9pbignICcpXG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgIGNvbnNvbGUubG9nKGNoYXJzKVxuICB9XG5cbiAgc3RhdGljIGV4ZWN1dGUoaW5zdHJ1Y3Rpb25OYW1lLCBhZGRyZXNzaW5nTmFtZSkge1xuICAgIGxldCBhZGRyT2ZPcGNvZGVcbiAgICBpZiAodGhpcy5pc0RlYnVnKSB7XG4gICAgICBhZGRyT2ZPcGNvZGUgPSB0aGlzLnJlZ2lzdGVycy5wYyAtIDFcbiAgICB9XG5cbiAgICBjb25zdCBhZGRyZXNzaW5nID0gQWRkcmVzc2luZ1thZGRyZXNzaW5nTmFtZV0uYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSBhZGRyZXNzaW5nLmNhbGwoKVxuXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBJbnN0cnVjdGlvbnNbaW5zdHJ1Y3Rpb25OYW1lXS5iaW5kKHRoaXMsIGFkZHIpXG5cbiAgICBpZiAodGhpcy5pc0RlYnVnKSB7XG4gICAgICBVdGlsLmRlYnVnU3RyaW5nLmNhbGwodGhpcywgaW5zdHJ1Y3Rpb24sIGFkZHJlc3NpbmcsIGFkZHIsIGFkZHJPZk9wY29kZSlcbiAgICB9XG5cbiAgICBpbnN0cnVjdGlvbi5jYWxsKClcbiAgfVxufVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDAwIC0gMHgwRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDAwOiBCUksgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQlJLJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweDAxOiBPUkEgaW5kZXhJbmRpcmVjdCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnT1JBJywgJ2luZGV4SW5kaXJlY3QnKVxuICB9LFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAvKiAweDA1OiBPUkEgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ09SQScsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4MDYgQVNMIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBU0wnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4MDg6IFBIUCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdQSFAnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4MDk6IE9SQSBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ09SQScsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweDBhOiBBU0wgaW1wbGllZChhY2NtdWxhdG9yKSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBU0wnLCAnaW1wbGllZCcpXG4gIH0sXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweDBkOiBPUkEgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ09SQScsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4MGU6IEFTTCBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQVNMJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgxMCAtIDB4MUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgxMCBCUEwgcmVsYXRpdmUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JQTCcsICdyZWxhdGl2ZScpXG4gIH0sXG4gIC8qIDB4MTEgT1JBIGluZGlyZWN0SW5kZXggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ09SQScsICdpbmRpcmVjdEluZGV4JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHgxNTogT1JBIHplcm9wYWdlWCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdPUkEnLCAnemVyb3BhZ2VYJylcbiAgfSxcbiAgLyogMHgxNjogQVNMIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQVNMJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gICc3JyxcbiAgLyogMHgxODogQ0xDIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NMQycsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHgxOTogT1JBIGFib3NsdXRlWSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdPUkEnLCAnYWJzb2x1dGVZJylcbiAgfSxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgLyogMHgxZCBPUkEgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdPUkEnLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgLyogMHgxZSBBU0wgYWJzb2x1dGVYKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FTTCcsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgyMCAtIDB4MkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgyMDogSlNSIGFic29sdXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0pTUicsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4MjE6IEFORCBpbmRleEluZGlyZWN0ICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBTkQnLCAnaW5kZXhJbmRpcmVjdCcpXG4gIH0sXG4gICcyJyxcbiAgJzMnLFxuICAvKiAweDI0OiBCSVQgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JJVCcsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4MjU6IEFORCB6ZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQU5EJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgLyogMHgyNjogUk9MIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdST0wnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4Mjg6IFBMUCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdQTFAnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4Mjk6IEFORCBJbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FORCcsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweDJhOiBST0wgaW1wbGllZCAoYWNjbXVsYXRvcikqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUk9MJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnYicsXG4gIC8qIDB4MmM6IEJJVCBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQklUJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgLyogMHgyZDogQU5EIGFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBTkQnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweDJlOiBST0wgYWJzb2x1dGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUk9MJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgzMCAtIDB4M0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgzMDogQk1JIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCTUknLCAncmVsYXRpdmUnKVxuICB9LFxuICAvKiAweDMxOiBBTkQgaW5kaXJlY3RJbmRleCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQU5EJywgJ2luZGlyZWN0SW5kZXgnKVxuICB9LFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAvKiAweDM1OiBBTkQgemVyb3BhZ2VYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBTkQnLCAnemVyb3BhZ2VYJylcbiAgfSxcbiAgLyogMHgzNiBST0wgemVyb3BhZ2VYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdST0wnLCAnemVyb3BhZ2VYJylcbiAgfSxcbiAgJzcnLFxuICAvKiAweDM4OiBTRUMgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU0VDJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweDM5OiBBTkQgYWJzb2x1dGVZKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FORCcsICdhYnNvbHV0ZVknKVxuICB9LFxuICAnYScsXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweDNkOiBBTkQgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBTkQnLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgLyogMHgzMjogUk9MIGFic29sdXRlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUk9MJywgJ2Fic29sdXRlWCcpXG4gIH0sXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDQwIC0gMHg0RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDQwOiBSVEkgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUlRJJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweDQxOiBFT1IgaW5kZXhJbmRpcmVjdCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnRU9SJywgJ2luZGV4SW5kaXJlY3QnKVxuICB9LFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAvKiAweDQ1OiBFT1IgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0VPUicsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4NDY6IExTUiB6ZXJvcGFnZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMU1InLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4NDg6IFBIQSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdQSEEnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4NDk6IEVPUiBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0VPUicsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweDRhOiBMU1IgaW1wbGllZChhY2N1bXVsYXRvcikgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xTUicsICdpbXBsaWVkJylcbiAgfSxcbiAgJ2InLFxuICAvKiAweDRjOiBKTVAgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0pNUCcsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4NGQ6IEVPUiBhYnNvbHV0ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdFT1InLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweDRlOiBMU1IgYWJzb2x1dGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTFNSJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4NTAgLSAweDVGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4NTA6IEJWQyByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQlZDJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgLyogMHg1MTogRU9SIGluZGlyZWN0SW5kZXggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0VPUicsICdpbmRpcmVjdEluZGV4JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHg1NTogRU9SIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnRU9SJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gIC8qIDB4NTY6IExTUiB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xTUicsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4NTg6IENMSSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ0xJJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweDU5OiBFT1IgYWJzb2x1dGVZICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdFT1InLCAnYWJzb2x1dGVZJylcbiAgfSxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgLyogMHg1ZCBFT1IgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdFT1InLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgLyogMHg1ZSBMU1IgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMU1InLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg2MCAtIDB4NkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg2MDogUlRTIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1JUUycsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHg2MTogQURDIGluZGV4SW5kaXJlY3QgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FEQycsICdpbmRleEluZGlyZWN0JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHg2NTogQURDIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBREMnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweDY2OiBST1IgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1JPUicsICd6ZXJvcGFnZScpXG4gIH0sXG4gICc3JyxcbiAgLyogMHg2ODogUExBIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BMQScsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHg2OTogQURDIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQURDJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gIC8qIDB4NmE6IFJPUiBpbXBsaWVkIChhY2NtdWxhdG9yKSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnUk9SJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnYicsXG4gIC8qIDB4NmM6IEpNUCBpbmRpcmVjdCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSk1QJywgJ2luZGlyZWN0JylcbiAgfSxcbiAgLyogMHg2ZDogQURDIGFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBREMnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweDZlIFJPUiBhYnNvbHV0ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdST1InLCAnYWJzb2x1dGUnKVxuICB9LFxuICAnJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDcwOiBCVlMgcmVsYXRpdmUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JWUycsICdyZWxhdGl2ZScpXG4gIH0sXG4gIC8qIDB4NzE6IEFEQyBpbmRpcmVjdEluZGV4ICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBREMnLCAnaW5kaXJlY3RJbmRleCcpXG4gIH0sXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gIC8qIDB4NzU6IEFEQyB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FEQycsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAvKiAweDc2OiBST1IgemVyb3BhZ2VYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdST1InLCAnemVyb3BhZ2VYJylcbiAgfSxcbiAgJzcnLFxuICAvKiAweDc4OiBTRUkgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU0VJJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweDc5OiBBREMgYWJzb2x1dGVZICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBREMnLCAnYWJzb2x1dGVZJylcbiAgfSxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgLyogMHg3ZDogQURDIGFic29sdXRlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQURDJywgJ2Fic29sdXRlWCcpXG4gIH0sXG4gIC8qIDB4N2U6IFJPUiBhYnNvbHV0ZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1JPUicsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg4MCAtIDB4OEYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJzAnLFxuICAvKiAweDgxOiBTVEEgaW5kZXhJbmRpcmVjdCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RBJywgJ2luZGV4SW5kaXJlY3QnKVxuICB9LFxuICAnMicsXG4gICczJyxcbiAgLyogMHg4NDogU1RZIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVFknLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweDg1OiBTVEEgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUQScsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4ODY6IFNUWCBaZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RYJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgJzcnLFxuICAvKiAweDg4OiBERVkgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnREVZJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnOScsXG4gIC8qIDB4OGE6IFRYQSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUWEEnLCAnaW1wbGllZCcpXG4gIH0sXG4gICdiJyxcbiAgLyogMHg4YyBTVFkgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUWScsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4OGQ6IFNUQSBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RBJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgLyogMHg4ZTogU1RYIGFic29sdXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUWCcsICdhYnNvbHV0ZScpXG4gIH0sXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsLmpzJ1xuXG4vKiAweDkwIC0gMHg5RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweDkwOiBCQ0MgcmVsYXRpdmUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQkNDJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgLyogMHg5MTogU1RBIGluZGlyZWN0SW5kZXggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUQScsICdpbmRpcmVjdEluZGV4JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gIC8qIDB4OTQ6IFNUWSB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUWScsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAvKiAweDk1OiBTVEEgemVyb3BhZ2VYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVEEnLCAnemVyb3BhZ2VYJylcbiAgfSxcbiAgLyogMHg5NjogU1RYIHplcm9wYWdlWSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RYJywgJ3plcm9wYWdlWScpXG4gIH0sXG4gICc3JyxcbiAgLyogMHg5ODogVFlBIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1RZQScsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHg5OTogU1RBIGFic29sdXRlWSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RBJywgJ2Fic29sdXRlWScpXG4gIH0sXG4gIC8qIDB4OWE6IFRYUyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUWFMnLCAnaW1wbGllZCcpXG4gIH0sXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweDlkOiBTVEEgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVEEnLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhBMCAtIDB4QUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhhMDogTERZIGltbWVkaWF0ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMRFknLCAnaW1tZWRpYXRlJylcbiAgfSxcbiAgLyogMHhhMTogTERBIGluZGV4SW5kaXJlY3QgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICdpbmRleEluZGlyZWN0JylcbiAgfSxcbiAgLyogMHhBMjogTERYIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERYJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICczJyxcbiAgLyogMHhhNDogTERZIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMRFknLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweGE1OiBMREEgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4YTYgTERYIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMRFgnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4YTg6IFRBWSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUQVknLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4YTk6IExEQSBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweGFhOiBUQVggaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnVEFYJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnYicsXG4gIC8qIDB4YWM6IExEWSBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERZJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgLyogMHhhZDogTERBIGFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMREEnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweGFlOiBMRFggYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEWCcsICdhYnNvbHV0ZScpXG4gIH0sXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4YjAgLSAweGJGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4YjA6IEJDUyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCQ1MnLCAncmVsYXRpdmUnKVxuICB9LFxuICAvKiAweGIxOiBMREEgaW5kaXJlY3RJbmRleCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERBJywgJ2luZGlyZWN0SW5kZXgnKVxuICB9LFxuICAnMicsXG4gICczJyxcbiAgLyogMHhiNDogTERZIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERZJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gIC8qIDB4YjU6IExEQSB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAvKiAweGI2OiBMRFggemVyb3BhZ2VZICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMRFgnLCAnemVyb3BhZ2VZJylcbiAgfSxcbiAgJzcnLFxuICAvKiAweGI4OiBDTFYgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ0xWJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweGI5OiBMREEgYWJzb2x1dGVZICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdMREEnLCAnYWJzb2x1dGVZJylcbiAgfSxcbiAgLyogMHhiYTogVFNYIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1RTWCcsICdpbXBsaWVkJylcbiAgfSxcbiAgJ2InLFxuICAvKiAweGJjOiBMRFkgYWJzb2x1dGVYKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEWScsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAvKiAweGJkOiBMREEgYnNvbHV0ZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAvKiAweGJlOiBMRFggYWJzb2x1dGVZKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEWCcsICdhYnNvbHV0ZVknKVxuICB9LFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhjMCAtIDB4Y0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhjMDogQ1BZIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ1BZJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gIC8qIDB4YzE6IENNUCBpbmRleEluZGlyZWN0ICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnaW5kZXhJbmRpcmVjdCcpXG4gIH0sXG4gICcyJyxcbiAgJzMnLFxuICAvKiAweGM0OiBDUFkgemVyb3BhZ2UqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ1BZJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgLyogMHhjNTogQ01QIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweGM2OiBERUMgemVyb3BhZ2UqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnREVDJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgJzcnLFxuICAvKiAweGM4OiBJTlkgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSU5ZJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweGM5OiBDTVAgaW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnaW1tZWRpYXRlJylcbiAgfSxcbiAgLyogMHhjYTogREVYIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFWCcsICdpbXBsaWVkJylcbiAgfSxcbiAgJ2InLFxuICAvKiAweGNjOiBDUFkgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NQWScsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4Y2Q6IENNUCBhYnNvbHV0ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweGNlOiBERUMgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFQycsICdhYnNvbHV0ZScpXG4gIH0sXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQk5FJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgLyogMHhkMTogQ01QIGluZGlyZWN0SW5kZXggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NNUCcsICdpbmRpcmVjdEluZGV4JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHhkNTogQ01QIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ01QJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gIC8qIDB4ZDY6IERFQyB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFQycsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4ZDg6IENMRCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTEQnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4ZDk6IENNUCBhYnNvbHV0ZVkgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NNUCcsICdhYnNvbHV0ZVknKVxuICB9LFxuICAnYScsXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweGRkOiBDTVAgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgLyogMHhkZTogREVDIGFic29sdXRlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnREVDJywgJ2Fic29sdXRlWCcpXG4gIH0sXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweGUwIC0gMHhlRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweGUwOiBDUFggaW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDUFgnLCAnaW1tZWRpYXRlJylcbiAgfSxcbiAgLyogMHhlMTogU0JDIGluZGV4SW5kaXJlY3QgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICdpbmRleEluZGlyZWN0JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gIC8qIDB4ZTQ6IENQWCB6ZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ1BYJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgLyogMHhlNTogU0JDIHplcm9wYWdlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICd6ZXJvcGFnZScpXG4gIH0sXG4gIC8qIDB4ZTY6IElOQyB6ZXJvcGFnZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdJTkMnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4ZTg6IElOWCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdJTlgnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4ZTk6IFNCQyBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweGVhOiBOT1AgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTk9QJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnYicsXG4gIC8qIDB4ZWM6IENQWCBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ1BYJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgLyogMHhlZDogU0JDIGFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTQkMnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweGVlOiBJTkMgYWJzb2x1dGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSU5DJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZjAgLSAweGZmICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZjA6IEJFUSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQkVRJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgLyogMHhmMTogU0JDIGluZGlyZWN0SW5kZXggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICdpbmRpcmVjdEluZGV4JylcbiAgfSxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHhmNTogU0JDIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU0JDJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gIC8qIDB4ZjY6IElOQyB6ZXJvcGFnZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0lOQycsICd6ZXJvcGFnZVgnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4Zjg6IFNFRCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTRUQnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4ZjkgU0JDIGFic29sdXRlWSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU0JDJywgJ2Fic29sdXRlWScpXG4gIH0sXG4gICdhJyxcbiAgJ2InLFxuICAnYycsXG4gIC8qIDB4ZmQ6IFNCQyBhYnNvbHV0ZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAvKiAweGZlOiBJTkMgYWJzb2x1dGVYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdJTkMnLCAnYWJzb2x1dGVYJylcbiAgfSxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgeDB4IGZyb20gJy4vMHgweCdcbmltcG9ydCB4MXggZnJvbSAnLi8weDF4J1xuaW1wb3J0IHgyeCBmcm9tICcuLzB4MngnXG5pbXBvcnQgeDN4IGZyb20gJy4vMHgzeCdcbmltcG9ydCB4NHggZnJvbSAnLi8weDR4J1xuaW1wb3J0IHg1eCBmcm9tICcuLzB4NXgnXG5pbXBvcnQgeDZ4IGZyb20gJy4vMHg2eCdcbmltcG9ydCB4N3ggZnJvbSAnLi8weDd4J1xuaW1wb3J0IHg4eCBmcm9tICcuLzB4OHgnXG5pbXBvcnQgeDl4IGZyb20gJy4vMHg5eCdcbmltcG9ydCB4QXggZnJvbSAnLi8weEF4J1xuaW1wb3J0IHhCeCBmcm9tICcuLzB4QngnXG5pbXBvcnQgeEN4IGZyb20gJy4vMHhDeCdcbmltcG9ydCB4RHggZnJvbSAnLi8weER4J1xuaW1wb3J0IHhFeCBmcm9tICcuLzB4RXgnXG5pbXBvcnQgeEZ4IGZyb20gJy4vMHhGeCdcblxuY29uc3Qgb3Bjb2RlcyA9IFtdLmNvbmNhdChcbiAgeDB4LFxuICB4MXgsXG4gIHgyeCxcbiAgeDN4LFxuICB4NHgsXG4gIHg1eCxcbiAgeDZ4LFxuICB4N3gsXG4gIHg4eCxcbiAgeDl4LFxuICB4QXgsXG4gIHhCeCxcbiAgeEN4LFxuICB4RHgsXG4gIHhFeCxcbiAgeEZ4XG4pXG5cbmV4cG9ydCBkZWZhdWx0IG9wY29kZXNcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFV0aWwge1xuICBzdGF0aWMgaXNOb2RlanMoKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCdcbiAgfVxufVxuIiwiaW1wb3J0IFJlZ2lzdGVycyBmcm9tICcuL3JlZ2lzdGVycydcbmltcG9ydCBSYW0gZnJvbSAnLi9yYW0nXG5pbXBvcnQgb3Bjb2RlcyBmcm9tICcuL29wY29kZXMnXG5pbXBvcnQgVXRpbCBmcm9tICcuLi91dGlsJ1xuXG4vKiA2NTAyIENQVSAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ3B1IHtcbiAgY29uc3RydWN0b3IoaXNEZWJ1Zykge1xuICAgIHRoaXMuaW5pdCgpXG4gICAgdGhpcy5pc0RlYnVnID0gaXNEZWJ1Z1xuICB9XG5cbiAgaW5pdCgpIHtcbiAgICB0aGlzLnJlZ2lzdGVycyA9IG5ldyBSZWdpc3RlcnMoKVxuICAgIC8vdGhpcy5vcGNvZGVzID0gb3Bjb2Rlc1xuICAgIHRoaXMub3Bjb2RlcyA9IG9wY29kZXMubWFwKG9wY29kZSA9PiB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9wY29kZSA9PT0gJ2Z1bmN0aW9uJyA/IG9wY29kZS5iaW5kKHRoaXMpIDogb3Bjb2RlXG4gICAgfSlcblxuICAgIHRoaXMucmFtID0gbmV3IFJhbSgpXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmIHRoaXMucmFtLmNvbm5lY3QocGFydHMpXG4gIH1cblxuICByZXNldCgpIHtcbiAgICB0aGlzLmluaXQoKVxuICAgIHRoaXMucnVuKClcbiAgfVxuXG4gIHJ1bigpIHtcbiAgICBjb25zdCBleGVjdXRlID0gdGhpcy5ldmFsLmJpbmQodGhpcylcblxuICAgIFV0aWwuaXNOb2RlanMoKSA/IHNldEludGVydmFsKGV4ZWN1dGUsIDEwKSA6IGV4ZWN1dGUoKVxuICB9XG5cbiAgLy8g5ZG95Luk44KS5Yem55CG44GZ44KLXG4gIGV2YWwoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBvcGNvZGUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG5cbiAgICBpZiAodHlwZW9mIHRoaXMub3Bjb2Rlc1tvcGNvZGVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJzB4JyArIG9wY29kZS50b1N0cmluZygxNikgKyAnIGlzIG5vdCBpbXBsZW1lbnRlZCcpXG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGVzW29wY29kZV0uY2FsbCgpXG5cbiAgICBpZiAoIVV0aWwuaXNOb2RlanMoKSkge1xuICAgICAgY29uc3QgZm4gPSB0aGlzLmV2YWwuYmluZCh0aGlzKVxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShmbilcbiAgICB9XG4gIH1cblxuICAvKiAweDgwMDB+44Gu44Oh44Oi44Oq44GrUk9N5YaF44GuUFJHLVJPTeOCkuiqreOBv+i+vOOCgCovXG4gIHNldCBwcmdSb20ocHJnUm9tKSB7XG4gICAgLy90aGlzLmludGVycnVwdFZlY3RvcnMocHJnUm9tKVxuICAgIGNvbnN0IHN0YXJ0QWRkciA9IDB4ZmZmZiAtIHByZ1JvbS5sZW5ndGhcbiAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IHN0YXJ0QWRkclxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmdSb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vdGhpcy5tZW1vcnlbc3RhcnRBZGRyK2ldID0gcHJnUm9tW2ldXG4gICAgICB0aGlzLnJhbS53cml0ZShzdGFydEFkZHIgKyBpLCBwcmdSb21baV0pXG4gICAgfVxuXG4gICAgLy8g44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/44Gu5Yid5pyf5YCk44KSMHhGRkZD44GL44KJ6Kit5a6a44GZ44KLXG4gICAgLy90aGlzLnJlZ2lzdGVycy5wYyA9IHRoaXMucmFtLnJlYWQoMHhmZmZjKSA8PCAyXG4gIH1cblxuICAvKiDjgrnjgr/jg4Pjgq/poJjln5/jgavlr77jgZnjgovmk43kvZwqL1xuICBzdGFja1B1c2godmFsdWUpIHtcbiAgICB0aGlzLnJhbS53cml0ZSh0aGlzLnJlZ2lzdGVycy5zcCwgdmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3AtLVxuICB9XG5cbiAgc3RhY2tQb3AoKSB7XG4gICAgcmV0dXJuIHRoaXMucmFtLnJlYWQoKyt0aGlzLnJlZ2lzdGVycy5zcClcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVnJhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubWVtb3J5ID0gbmV3IFVpbnQ4QXJyYXkoMHg0MDAwKVxuICAgIHRoaXMudnAgPSBudWxsXG4gIH1cblxuICBjb25uZWN0KHBwdSkge1xuICAgIHRoaXMucmVmcmVzaERpc3BsYXkgPSBwcHUucmVmcmVzaERpc3BsYXkuYmluZChwcHUpXG4gIH1cblxuICB3cml0ZUZyb21CdXModmFsdWUpIHtcbiAgICAvL2NvbnNvbGUubG9nKCd2cmFtWyQnICsgdGhpcy52cC50b1N0cmluZygxNikgKyAnXSA9ICcgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlKSlcbiAgICB0aGlzLm1lbW9yeVt0aGlzLnZwXSA9IHZhbHVlXG4gICAgdGhpcy52cCsrXG4gICAgdGhpcy5yZWZyZXNoRGlzcGxheSAmJiB0aGlzLnJlZnJlc2hEaXNwbGF5KClcbiAgfVxuXG4gIHdyaXRlKGFkZHIsIHZhbHVlKSB7XG4gICAgdGhpcy5tZW1vcnlbYWRkcl0gPSB2YWx1ZVxuICB9XG5cbiAgcmVhZChhZGRyKSB7XG4gICAgcmV0dXJuIHRoaXMubWVtb3J5W2FkZHJdXG4gIH1cbn1cbiIsImltcG9ydCBWcmFtIGZyb20gJy4vdnJhbSdcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUHB1IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5pbml0KClcbiAgfVxuXG4gIGluaXQoKSB7XG4gICAgLyogQWJvdXQgVlJBTVxuICAgICAqIDB4MDAwMCAtIDB4MGZmZiA6IFBhdHRlcm4gdGFibGUgMFxuICAgICAqIDB4MTAwMCAtIDB4MWZmZiA6IFBhdHRlcm4gdGFibGUgMVxuICAgICAqIDB4MjAwMCAtIDB4MjNiZiA6IE5hbWUgdGFibGUgMFxuICAgICAqIDB4MjNjMCAtIDB4MjNmZiA6IEF0dHJpYnV0ZSB0YWJsZSAwXG4gICAgICogMHgyNDAwIC0gMHgyN2JmIDogTmFtZSB0YWJsZSAxXG4gICAgICogMHgyYmMwIC0gMHgyYmJmIDogQXR0cmlidXRlIHRhYmxlIDFcbiAgICAgKiAweDJjMDAgLSAweDJmYmYgOiBOYW1lIHRhYmxlIDJcbiAgICAgKiAweDJiYzAgLSAweDJiZmYgOiBBdHRyaWJ1dGUgdGFibGUgMlxuICAgICAqIDB4MmMwMCAtIDB4MmZiZiA6IE5hbWUgdGFibGUgM1xuICAgICAqIDB4MmZjMCAtIDB4MmZmZiA6IEF0dHJpYnV0ZSB0YWJsZSAzXG4gICAgICogMHgzMDAwIC0gMHgzZWZmIDogTWlycm9yIG9mIDB4MjAwMCAtIDB4MmZmZlxuICAgICAqIDB4M2YwMCAtIDB4M2YwZiA6IEJhY2tncm91bmQgcGFsZXR0ZVxuICAgICAqIDB4M2YxMCAtIDB4M2YxZiA6IFNwcml0ZSBwYWxldHRlXG4gICAgICogMHgzZjIwIC0gMHgzZmZmIDogTWlycm9yIG9mIDB4M2YwMCAwIDB4M2YxZlxuICAgICAqICovXG4gICAgdGhpcy52cmFtID0gbmV3IFZyYW0oKVxuICB9XG5cbiAgY29ubmVjdChwYXJ0cykge1xuICAgIGlmIChwYXJ0cy5idXMpIHtcbiAgICAgIHBhcnRzLmJ1cy5jb25uZWN0KHsgdnJhbTogdGhpcy52cmFtIH0pXG4gICAgfVxuXG4gICAgaWYgKHBhcnRzLnJlbmRlcmVyKSB7XG4gICAgICB0aGlzLnJlbmRlcmVyID0gcGFydHMucmVuZGVyZXJcbiAgICAgIHRoaXMudnJhbS5jb25uZWN0KHRoaXMpXG4gICAgfVxuICB9XG5cbiAgLyogJDIwMDAgLSAkMjNCRuOBruODjeODvOODoOODhuODvOODluODq+OCkuabtOaWsOOBmeOCiyAqL1xuICByZWZyZXNoRGlzcGxheSgpIHtcbiAgICAvKiDjgr/jgqTjg6soOHg4KeOCkjMyKjMw5YCLICovXG4gICAgZm9yIChsZXQgaSA9IDB4MjAwMDsgaSA8PSAweDIzYmY7IGkrKykge1xuICAgICAgY29uc3QgdGlsZUlkID0gdGhpcy52cmFtLnJlYWQoaSlcbiAgICAgIC8qIOOCv+OCpOODq+OCkuaMh+WumiAqL1xuICAgICAgY29uc3QgdGlsZSA9IHRoaXMudGlsZXNbdGlsZUlkXVxuICAgICAgLyog44K/44Kk44Or44GM5L2/55So44GZ44KL44OR44Os44OD44OI44KS5Y+W5b6XICovXG4gICAgICBjb25zdCBwYWxldHRlSWQgPSB0aGlzLnNlbGVjdFBhbGV0dGUodGlsZUlkKVxuICAgICAgY29uc3QgcGFsZXR0ZSA9IHRoaXMuc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKHBhbGV0dGVJZClcblxuICAgICAgLyog44K/44Kk44Or44Go44OR44Os44OD44OI44KSUmVuZGVyZXLjgavmuKHjgZkgKi9cbiAgICAgIHRoaXMucmVuZGVyZXIud3JpdGUodGlsZSwgcGFsZXR0ZSlcbiAgICB9XG4gIH1cblxuICAvKiAweDAwMDAgLSAweDFmZmbjga7jg6Hjg6Ljg6rjgatDSFItUk9N44KS6Kqt44G/6L6844KAICovXG4gIHNldCBjaHJSb20oY2hyUm9tKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaHJSb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMudnJhbS53cml0ZShpLCBjaHJSb21baV0pXG4gICAgfVxuXG4gICAgLyogQ0hS6aCY5Z+f44GL44KJ44K/44Kk44Or44KS5oq95Ye644GX44Gm44GK44GPICovXG4gICAgdGhpcy5leHRyYWN0VGlsZXMoKVxuICB9XG5cbiAgLy8gOHg444Gu44K/44Kk44Or44KS44GZ44G544GmdnJhbeOBrkNIUuOBi+OCieaKveWHuuOBl+OBpuOBiuOBj1xuICBleHRyYWN0VGlsZXMoKSB7XG4gICAgdGhpcy50aWxlcyA9IFtdXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAweDFmZmY7ICkge1xuICAgICAgLy8g44K/44Kk44Or44Gu5LiL5L2N44OT44OD44OIXG4gICAgICBjb25zdCBsb3dlckJpdExpbmVzID0gW11cbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGxldCBieXRlID0gdGhpcy52cmFtLnJlYWQoaSsrKVxuICAgICAgICBjb25zdCBsaW5lID0gW11cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgICAgICBjb25zdCBiaXQgPSBieXRlICYgMHgwMVxuICAgICAgICAgIGxpbmUudW5zaGlmdChiaXQpXG4gICAgICAgICAgYnl0ZSA9IGJ5dGUgPj4gMVxuICAgICAgICB9XG5cbiAgICAgICAgbG93ZXJCaXRMaW5lcy5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIC8vIOOCv+OCpOODq+OBruS4iuS9jeODk+ODg+ODiFxuICAgICAgY29uc3QgaGlnaGVyQml0TGluZXMgPSBbXVxuICAgICAgZm9yIChsZXQgaCA9IDA7IGggPCA4OyBoKyspIHtcbiAgICAgICAgbGV0IGJ5dGUgPSB0aGlzLnZyYW0ucmVhZChpKyspXG4gICAgICAgIGNvbnN0IGxpbmUgPSBbXVxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IGJpdCA9IGJ5dGUgJiAweDAxXG4gICAgICAgICAgbGluZS51bnNoaWZ0KGJpdCA8PCAxKVxuICAgICAgICAgIGJ5dGUgPSBieXRlID4+IDFcbiAgICAgICAgfVxuXG4gICAgICAgIGhpZ2hlckJpdExpbmVzLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgLy8g5LiK5L2N44OT44OD44OI44Go5LiL5L2N44OT44OD44OI44KS5ZCI5oiQ44GZ44KLXG4gICAgICBjb25zdCBwZXJmZWN0Qml0cyA9IFtdXG4gICAgICBmb3IgKGxldCBoID0gMDsgaCA8IDg7IGgrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IHBlcmZlY3RCaXQgPSBsb3dlckJpdExpbmVzW2hdW2pdIHwgaGlnaGVyQml0TGluZXNbaF1bal1cbiAgICAgICAgICBwZXJmZWN0Qml0cy5wdXNoKHBlcmZlY3RCaXQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMudGlsZXMucHVzaChwZXJmZWN0Qml0cylcbiAgICB9XG4gIH1cblxuICAvKiDlsZ7mgKfjg4bjg7zjg5bjg6vjgYvjgonoqbLlvZPjg5Hjg6zjg4Pjg4jjga7nlarlj7fjgpLlj5blvpfjgZnjgosgKi9cbiAgc2VsZWN0UGFsZXR0ZShuKSB7XG4gICAgY29uc3QgYmxvY2tQb3NpdGlvbiA9ICgobiAtIChuICUgNjQpKSAvIDY0KSAqIDggKyAoKG4gJSA2NCkgLSAobiAlIDQpKSAvIDRcbiAgICBjb25zdCBiaXRQb3NpdGlvbiA9IG4gJSA0XG4gICAgY29uc3Qgc3RhcnQgPSAweDIzYzBcblxuICAgIGNvbnN0IGJsb2NrID0gdGhpcy52cmFtLnJlYWQoc3RhcnQgKyBibG9ja1Bvc2l0aW9uKVxuICAgIGNvbnN0IGJpdCA9IChibG9jayA+PiBiaXRQb3NpdGlvbikgJiAweDAzXG5cbiAgICByZXR1cm4gYml0XG4gIH1cblxuICAvKiAkM0YwMC0kM0YwRuOBi+OCieODkOODg+OCr+OCsOODqeOCpuODs+ODiSjog4zmma8p44OR44Os44OD44OI44KS5Y+W5b6X44GZ44KLICovXG4gIHNlbGVjdEJhY2tncm91bmRQYWxldHRlcyhudW1iZXIpIHtcbiAgICBjb25zdCBwYWxldHRlID0gW11cblxuICAgIGNvbnN0IHN0YXJ0ID0gMHgzZjAwICsgbnVtYmVyICogNFxuICAgIGNvbnN0IGVuZCA9IDB4M2YwMCArIG51bWJlciAqIDQgKyA0XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHBhbGV0dGUucHVzaCh0aGlzLnZyYW0ucmVhZChpKSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFsZXR0ZVxuICB9XG5cbiAgLyogJDNGMTAtJDNGMUbjgYvjgonjgrnjg5fjg6njgqTjg4jjg5Hjg6zjg4Pjg4jjgpLlj5blvpfjgZnjgosgKi9cbiAgc2VsZWN0U3ByaXRlUGFsZXR0cyhudW1iZXIpIHtcbiAgICBjb25zdCBwYWxldHRlID0gW11cblxuICAgIGNvbnN0IHN0YXJ0ID0gMHgzZjEwICsgbnVtYmVyICogNFxuICAgIGNvbnN0IGVuZCA9IDB4M2YxMCArIG51bWJlciAqIDQgKyA0XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHBhbGV0dGUucHVzaCh0aGlzLnZyYW0ucmVhZChpKSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFsZXR0ZVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBCdXMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHt9XG4gICAgdGhpcy52cmFtQWRkcl8gPSBbXVxuICB9XG5cbiAgY29ubmVjdChwYXJ0cykge1xuICAgIHBhcnRzLnZyYW0gJiYgKHRoaXMudnJhbSA9IHBhcnRzLnZyYW0pXG4gIH1cblxuICAvKiBDUFXlgbTjgYvjgonjga7jgb/jgZfjgYvogIPmha7jgZfjgabjgarjgYQgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBzd2l0Y2ggKGFkZHIpIHtcbiAgICAgIGNhc2UgMHgyMDA2OlxuICAgICAgICB0aGlzLnZyYW1BZGRyID0gdmFsdWVcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMHgyMDA3OlxuICAgICAgICB0aGlzLnZyYW0ud3JpdGVGcm9tQnVzKHZhbHVlKVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5idWZmZXJbYWRkcl0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIHJlYWQoYWRkcikge1xuICAgIHN3aXRjaCAoYWRkcikge1xuICAgICAgY2FzZSAweDIwMDY6XG4gICAgICAgIHJldHVybiB0aGlzLnZyYW1BZGRyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidXMgb2YgdGhpcyBhZGRyIGlzIE5vdCBpbXBsZW1lbnRlZCcpXG4gICAgfVxuICB9XG5cbiAgc2V0IHZyYW1BZGRyKGFkZHIpIHtcbiAgICBpZiAodGhpcy52cmFtQWRkcl8ubGVuZ3RoIDwgMSkge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnZyYW1BZGRyXy5wdXNoKGFkZHIpXG4gICAgICB0aGlzLnZyYW0udnAgPSB0aGlzLnZyYW1BZGRyXG4gICAgICB0aGlzLnZyYW1BZGRyXy5sZW5ndGggPSAwXG4gICAgfVxuICB9XG5cbiAgZ2V0IHZyYW1BZGRyKCkge1xuICAgIHJldHVybiAodGhpcy52cmFtQWRkcl9bMF0gPDwgOCkgKyB0aGlzLnZyYW1BZGRyX1sxXVxuICB9XG59XG4iLCJpbXBvcnQgQ3B1IGZyb20gJy4vY3B1J1xuaW1wb3J0IFBwdSBmcm9tICcuL3BwdSdcbmltcG9ydCBCdXMgZnJvbSAnLi9idXMnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE5lcyB7XG4gIGNvbnN0cnVjdG9yKGlzRGVidWcpIHtcbiAgICB0aGlzLmNwdSA9IG5ldyBDcHUoaXNEZWJ1ZylcbiAgICB0aGlzLnBwdSA9IG5ldyBQcHUoKVxuICAgIHRoaXMuYnVzID0gbmV3IEJ1cygpXG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IGJ1czogdGhpcy5idXMgfSlcbiAgICB0aGlzLmNwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICB9XG5cbiAgY29ubmVjdChyZW5kZXJlcikge1xuICAgIHRoaXMucHB1LmNvbm5lY3QoeyByZW5kZXJlciB9KVxuICB9XG5cbiAgZ2V0IHJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9tXG4gIH1cblxuICBzZXQgcm9tKHJvbSkge1xuICAgIHRoaXMuX3JvbSA9IHJvbVxuICB9XG5cbiAgcnVuKCkge1xuICAgIHRoaXMuY3B1LnByZ1JvbSA9IHRoaXMucm9tLnByZ1JvbVxuICAgIHRoaXMucHB1LmNoclJvbSA9IHRoaXMucm9tLmNoclJvbVxuXG4gICAgdGhpcy5jcHUucnVuKClcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgUm9tIHtcbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuY2hlY2soZGF0YSlcbiAgICB0aGlzLmRhdGEgPSBkYXRhXG4gIH1cblxuICBjaGVjayhkYXRhKSB7XG4gICAgaWYgKCF0aGlzLmlzTmVzUm9tKGRhdGEpKSB0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgaXMgbm90IE5FUyBST00uJylcbiAgfVxuXG4gIGdldCBORVNfUk9NX0hFQURFUl9TSVpFKCkge1xuICAgIHJldHVybiAweDEwXG4gIH1cblxuICBnZXQgTlVNQkVSX09GX1BSR19ST01fQkxPQ0tTKCkge1xuICAgIC8vY29uc29sZS5sb2coJ051bWJlciBvZiBQUkctUk9NIGJsb2NrczogJyArIHRoaXMuZGF0YVs0XSlcbiAgICByZXR1cm4gdGhpcy5kYXRhWzRdXG4gIH1cblxuICBnZXQgTlVNQkVSX09GX0NIUl9ST01fQkxPQ0tTKCkge1xuICAgIC8vY29uc29sZS5sb2coJ051bWJlciBvZiBDSFItUk9NIGJsb2NrczogJyArIHRoaXMuZGF0YVs1XSlcbiAgICByZXR1cm4gdGhpcy5kYXRhWzVdXG4gIH1cblxuICBnZXQgU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLk5FU19ST01fSEVBREVSX1NJWkUgKyB0aGlzLlNJWkVfT0ZfUFJHX1JPTVxuICB9XG5cbiAgZ2V0IEVORF9BRERSRVNTX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NICsgdGhpcy5TSVpFX09GX0NIUl9ST01cbiAgfVxuXG4gIC8qIFBSRyBST03jga7jgrXjgqTjgrrjgpLlj5blvpfjgZnjgotcbiAgICoqIFJPTeODmOODg+ODgOOBrjHjgYvjgonmlbDjgYjjgaY1Qnl0ZeebruOBruWApOOBqzE2S2ko44Kt44OTKeOCkuOBi+OBkeOBn+OCteOCpOOCuiAqL1xuICBnZXQgU0laRV9PRl9QUkdfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLk5VTUJFUl9PRl9QUkdfUk9NX0JMT0NLUyAqIDB4NDAwMFxuICB9XG5cbiAgLyogUFJHIFJPTeOBq+WQjOOBmCovXG4gIGdldCBTSVpFX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuTlVNQkVSX09GX0NIUl9ST01fQkxPQ0tTICogMHgyMDAwXG4gIH1cblxuICAvKiBST03jgYvjgolwcmdST03jgavoqbLlvZPjgZnjgovjgajjgZPjgo3jgpLliIfjgorlh7rjgZlcbiAgICoqIHByZ1JPTeOBr+ODmOODg+ODgOmgmOWfn+OBruasoeOBrkJ5dGXjgYvjgonlp4vjgb7jgosgKi9cbiAgZ2V0IHByZ1JvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKFxuICAgICAgdGhpcy5ORVNfUk9NX0hFQURFUl9TSVpFLFxuICAgICAgdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00gLSAxXG4gICAgKVxuICB9XG5cbiAgLyogUk9N44GL44KJY2hyUk9N44Gr6Kmy5b2T44GZ44KL44Go44GT44KN44KS5YiH44KK5Ye644GZXG4gICAqKiBjaHJSb23jga9wcmdSb23jga7lvozjgYvjgonlp4vjgb7jgosgKi9cbiAgZ2V0IGNoclJvbSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLnNsaWNlKFxuICAgICAgdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00sXG4gICAgICB0aGlzLkVORF9BRERSRVNTX09GX0NIUl9ST00gLSAxXG4gICAgKVxuICB9XG5cbiAgLyog44OH44O844K/44Gu44OY44OD44OA44GrJ05FUyfjgYzjgYLjgovjgYvjganjgYbjgYvjgadORVPjga5ST03jgYvliKTliKXjgZnjgosgKi9cbiAgaXNOZXNSb20oZGF0YSkge1xuICAgIGNvbnN0IGhlYWRlciA9IGRhdGEuc2xpY2UoMCwgMylcbiAgICBjb25zdCBoZWFkZXJTdHIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGhlYWRlcilcblxuICAgIHJldHVybiBoZWFkZXJTdHIgPT09ICdORVMnXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IFtcbiAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICBbMHgyNywgMHgxYiwgMHg4Zl0sXG4gIFsweDAwLCAweDAwLCAweGFiXSxcbiAgWzB4NDcsIDB4MDAsIDB4OWZdLFxuICBbMHg4ZiwgMHgwMCwgMHg3N10sXG4gIFsweGFiLCAweDAwLCAweDEzXSxcbiAgWzB4YTcsIDB4MDAsIDB4MDBdLFxuICBbMHg3ZiwgMHgwYiwgMHgwMF0sXG4gIFsweDQzLCAweDJmLCAweDAwXSxcbiAgWzB4MDAsIDB4NDcsIDB4MDBdLFxuICBbMHgwMCwgMHg1MSwgMHgwMF0sXG4gIFsweDAwLCAweDNmLCAweDE3XSxcbiAgWzB4MWIsIDB4M2YsIDB4NWZdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHhiYywgMHhiYywgMHhiY10sXG4gIFsweDAwLCAweDczLCAweGVmXSxcbiAgWzB4MjMsIDB4M2IsIDB4ZWZdLFxuICBbMHg4MywgMHgwMCwgMHhmM10sXG4gIFsweGJmLCAweDAwLCAweGJmXSxcbiAgWzB4ZTcsIDB4MDAsIDB4NWJdLFxuICBbMHhkYiwgMHgyYiwgMHgwMF0sXG4gIFsweGNiLCAweDRmLCAweDBmXSxcbiAgWzB4OGIsIDB4NzMsIDB4MDBdLFxuICBbMHgwMCwgMHg5NywgMHgwMF0sXG4gIFsweDAwLCAweGFiLCAweDAwXSxcbiAgWzB4MDAsIDB4OTMsIDB4M2JdLFxuICBbMHgwMCwgMHg4MywgMHg4Yl0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweGZmLCAweGZmLCAweGZmXSxcbiAgWzB4M2YsIDB4YmYsIDB4ZmZdLFxuICBbMHg1ZiwgMHg3MywgMHhmZl0sXG4gIFsweGE3LCAweDhiLCAweGZkXSxcbiAgWzB4ZjcsIDB4N2IsIDB4ZmZdLFxuICBbMHhmZiwgMHg3NywgMHhiN10sXG4gIFsweGZmLCAweDc3LCAweDYzXSxcbiAgWzB4ZmYsIDB4OWIsIDB4M2JdLFxuICBbMHhmMywgMHhiZiwgMHgzZl0sXG4gIFsweDgzLCAweGQzLCAweDEzXSxcbiAgWzB4NGYsIDB4ZGYsIDB4NGJdLFxuICBbMHg1OCwgMHhmOCwgMHg5OF0sXG4gIFsweDAwLCAweGViLCAweGRiXSxcbiAgWzB4NzUsIDB4NzUsIDB4NzVdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4ZmYsIDB4ZmYsIDB4ZmZdLFxuICBbMHhhYiwgMHhlNywgMHhmZl0sXG4gIFsweGM3LCAweGQ3LCAweGZmXSxcbiAgWzB4ZDcsIDB4Y2IsIDB4ZmZdLFxuICBbMHhmZiwgMHhjNywgMHhmZl0sXG4gIFsweGZmLCAweGM3LCAweGRiXSxcbiAgWzB4ZmYsIDB4YmYsIDB4YjNdLFxuICBbMHhmZiwgMHhkYiwgMHhhYl0sXG4gIFsweGZmLCAweGU3LCAweGEzXSxcbiAgWzB4ZTMsIDB4ZmYsIDB4YTNdLFxuICBbMHhhYiwgMHhmMywgMHhiZl0sXG4gIFsweGIzLCAweGZmLCAweGNmXSxcbiAgWzB4OWYsIDB4ZmYsIDB4ZjNdLFxuICBbMHhiYywgMHhiYywgMHhiY10sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdXG5dXG4iLCJpbXBvcnQgY29sb3JzIGZyb20gJy4vY29sb3JzJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSZW5kZXJlciB7XG4gIGNvbnN0cnVjdG9yKGlkKSB7XG4gICAgaWYgKCFpZCkgdGhyb3cgbmV3IEVycm9yKFwiSWQgb2YgY2FudmFzIHRhZyBpc24ndCBzcGVjaWZpZWQuXCIpXG5cbiAgICBsZXQgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpXG4gICAgdGhpcy5jb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICB0aGlzLnBvaW50ZXIgPSAwXG4gICAgdGhpcy53aWR0aCA9IDMyXG4gICAgdGhpcy5oZWlnaHQgPSAzMFxuICB9XG5cbiAgd3JpdGUodGlsZSwgcGFsZXR0ZSkge1xuICAgIGNvbnN0IGltYWdlID0gdGhpcy5nZW5lcmF0ZVRpbGVJbWFnZSh0aWxlLCBwYWxldHRlKVxuICAgIGNvbnN0IHggPSAodGhpcy5wb2ludGVyICUgdGhpcy53aWR0aCkgKiA4XG4gICAgY29uc3QgeSA9ICgodGhpcy5wb2ludGVyIC0gKHRoaXMucG9pbnRlciAlIHRoaXMud2lkdGgpKSAvIHRoaXMud2lkdGgpICogOFxuXG4gICAgaWYgKHRoaXMucG9pbnRlciA8IHRoaXMud2lkdGggKiB0aGlzLmhlaWdodCAtIDEpIHtcbiAgICAgIHRoaXMucG9pbnRlcisrXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucG9pbnRlciA9IDBcbiAgICB9XG5cbiAgICB0aGlzLmNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlLCB4LCB5KVxuICB9XG5cbiAgZ2VuZXJhdGVUaWxlSW1hZ2UodGlsZSwgcGFsZXR0ZSkge1xuICAgIGNvbnN0IGltYWdlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUltYWdlRGF0YSg4LCA4KVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2NDsgaSsrKSB7XG4gICAgICBjb25zdCBiaXQgPSB0aWxlW2ldXG4gICAgICBjb25zdCBjb2xvciA9IHRoaXMuY29sb3IocGFsZXR0ZVtiaXRdKVxuXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0XSA9IGNvbG9yWzBdXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgMV0gPSBjb2xvclsxXVxuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDJdID0gY29sb3JbMl1cbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAzXSA9IDI1NSAvLyDpgI/mmI7luqZcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2VcbiAgfVxuXG4gIGNvbG9yKGNvbG9ySWQpIHtcbiAgICByZXR1cm4gY29sb3JzW2NvbG9ySWRdXG4gIH1cbn1cbiIsImltcG9ydCBOZXNfIGZyb20gJy4vbmVzJ1xuaW1wb3J0IFJvbV8gZnJvbSAnLi9yb20nXG5pbXBvcnQgUmVuZGVyZXJfIGZyb20gJy4vcmVuZGVyZXInXG5cbmV4cG9ydCBjb25zdCBOZXMgPSBOZXNfXG5leHBvcnQgY29uc3QgUm9tID0gUm9tX1xuZXhwb3J0IGNvbnN0IFJlbmRlcmVyID0gUmVuZGVyZXJfXG4iXSwibmFtZXMiOlsiVXRpbCIsIlJlZ2lzdGVycyIsIk5lcyIsIk5lc18iLCJSb20iLCJSb21fIiwiUmVuZGVyZXIiLCJSZW5kZXJlcl8iXSwibWFwcGluZ3MiOiI7Ozs7OztFQUFlLE1BQU0sUUFBUSxDQUFDO0VBQzlCLEVBQUUsV0FBVyxHQUFHO0VBQ2hCLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxLQUFJO0VBQ3BCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3ZCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3ZCLElBQUksSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFNO0VBQ3JCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3ZCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxJQUFJLENBQUMsRUFBRSxHQUFHLE9BQU07RUFDcEIsR0FBRzs7RUFFSCxFQUFFLFdBQVcsR0FBRztFQUNoQixJQUFJLE9BQU87RUFDWCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7RUFDbEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFD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TyxHQUFHLEtBQUk7RUFDdEMsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsRUFBQztFQUM1QyxHQUFHOztFQUVILEVBQUUsSUFBSSxXQUFXLEdBQUc7RUFDcEIsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksSUFBSTtFQUNyQyxHQUFHOztFQUVILEVBQUUsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFO0VBQ3ZCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUk7RUFDdEMsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsRUFBQztFQUM1QyxHQUFHOztFQUVILEVBQUUsSUFBSSxhQUFhLEdBQUc7RUFDdEIsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksSUFBSTtFQUNyQyxHQUFHOztFQUVILEVBQUUsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFO0VBQ3pCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUk7RUFDdEMsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsRUFBQztFQUM1QyxHQUFHOztFQUVILEVBQUUsSUFBSSxlQUFlLEdBQUc7RUFDeEIsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksSUFBSTtFQUNyQyxHQUFHOztFQUVILEVBQUUsSUFBSSxlQUFlLENBQUMsR0FBRyxFQUFFO0VBQzNCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUk7RUFDdEMsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsRUFBQztFQUM1QyxHQUFHOztFQUVI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QUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7RUFDSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLE1BQUs7RUFDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUM7RUFDNUMsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBQztFQUMvQyxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFDO0VBQy9DLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUU7RUFDbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLE1BQUs7RUFDN0I7RUFDQTtFQUNBLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMs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QU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFDO0VBQ2hDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUM7RUFDM0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBQztFQUNuRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFDO0VBQzlELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFDO0VBQzlELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFDO0VBQzlELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFDO0VBQzlELElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFH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QUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUM3Q0Q7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUMxQ0Q7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJ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QUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUNoREQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUMxQ0Q7QUFDQSxZQUFlO0VBQ2YsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxF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Q0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUNuREQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxFQUFFO0VBQ0osQ0FBQzs7RUNuREQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUMxQ0Q7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUNuREQ7QUFDQSxZQUFlO0VBQ2Y7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBQztFQUM5QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBQztFQUNuRCxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBQztFQUM3QyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0w7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0g7RUFDQSxFQUFFLFdBQVc7RUFDYixJQUFJQSxNQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBQztFQUMvQyxHQUFHO0VBQ0gsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUMzQkQsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLE1BQU07RUFDekIsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsRUFBRSxHQUFHO0VBQ0wsQ0FBQzs7RUNsQ2MsTUFBTUEsTUFBSSxDQUFDO0VBQzFCLEVBQUUsT0FBTyxRQUFRLEdBQUc7RUFDcEIsSUFBSSxPQUFPLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLE9BQU8sS0FBSyxXQUFXO0VBQzNFLEdBQUc7RUFDSCxDQUFDOztFQ0NEO0FBQ0EsRUFBZSxNQUFNLEdBQUcsQ0FBQztFQUN6QixFQUFFLFdBQVcsQ0FBQyxPQUFPLEVBQUU7RUFDdkIsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFFO0VBQ2YsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLFFBQU87RUFDMUIsR0FBRzs7RUFFSCxFQUFFLElBQUksR0FBRztFQUNULElBQUksSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJQyxRQUFTLEdBQUU7RUFDcEM7RUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUk7RUFDekMsTUFBTSxPQUFPLE9BQU8sTUFBTSxLQUFLLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU07RUFDdEUsS0FBSyxFQUFDOztFQUVOLElBQUksSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsR0FBRTtFQUN4QixHQUFHOztFQUVILEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUNqQixJQUFJLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFDO0VBQ3hDLEdBQUc7O0VBRUgsRUFBRSxLQUFLLEdBQUc7RUFDVixJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUU7RUFDZixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUU7RUFDZCxHQUFHOztFQUVILEVBQUUsR0FBRyxHQUFHO0VBQ1IsSUFBSSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7O0VBRXhDLElBQUlELE1BQUksQ0FBQyxRQUFRLEVBQUUsR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxHQUFHLE9BQU8sR0FBRTtFQUMxRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxJQUFJLEdBQUc7RUFDVCxJQUFJLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFFO0VBQ3BDLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDOztFQUV0QyxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLFVBQVUsRUFBRTtFQUNwRCxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcscUJBQXFCLENBQUM7RUFDekUsS0FBSzs7RUFFTCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxHQUFFOztFQUUvQixJQUFJLElBQUksQ0FBQ0EsTUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO0VBQzFCLE1BQU0sTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLE1BQU0sTUFBTSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsRUFBQztFQUN0QyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0VBQ3JCO0VBQ0EsSUFBSSxNQUFNLFNBQVMsR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDLE9BQU07RUFDNUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxVQUFTOztFQUVqQyxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQzVDO0VBQ0EsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQztFQUM5QyxLQUFLOztFQUVMO0VBQ0E7RUFDQSxHQUFHOztFQUVIO0VBQ0EsRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFO0VBQ25CLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFDO0VBQzVDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUU7RUFDdkIsR0FBRzs7RUFFSCxFQUFFLFFBQVEsR0FBRztFQUNiLElBQUksT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO0VBQzdDLEdBQUc7RUFDSCxDQUFDOztFQzlFYyxNQUFNLElBQUksQ0FBQztFQUMxQixFQUFFLFdBQVcsR0FBRztFQUNoQixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFDO0VBQ3hDLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxLQUFJO0VBQ2xCLEdBQUc7O0VBRUgsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO0VBQ2YsSUFBSSxJQUFJLENBQUMsY0FBYyxHQUFHLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQztFQUN0RCxHQUFHOztFQUVILEVBQUUsWUFBWSxDQUFDLEtBQUssRUFBRTtFQUN0QjtFQUNBLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBSztFQUNoQyxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUU7RUFDYixJQUFJLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLGNBQWMsR0FBRTtFQUNoRCxHQUFHOztFQUVILEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7RUFDckIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQUs7RUFDN0IsR0FBRzs7RUFFSCxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7RUFDYixJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7RUFDNUIsR0FBRztFQUNILENBQUM7O0VDdEJjLE1BQU0sR0FBRyxDQUFDO0VBQ3pCLEVBQUUsV0FBVyxHQUFHO0VBQ2hCLElBQUksSUFBSSxDQUFDLElBQUksR0FBRTtFQUNmLEdBQUc7O0VBRUgsRUFBRSxJQUFJLEdBQUc7RUFDVDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksR0FBRTtFQUMxQixHQUFHOztFQUVILEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUNqQixJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsRUFBRTtFQUNuQixNQUFNLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBQztFQUM1QyxLQUFLOztFQUVMLElBQUksSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO0VBQ3hCLE1BQU0sSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsU0FBUTtFQUNwQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQztFQUM3QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsY0FBYyxHQUFHO0VBQ25CO0VBQ0EsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQzNDLE1BQU0sTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDO0VBQ3RDO0VBQ0EsTUFBTSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQztFQUNyQztFQUNBLE1BQU0sTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUM7RUFDbEQsTUFBTSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFDOztFQUU5RDtFQUNBLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQztFQUN4QyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0VBQ3JCLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDNUMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDO0VBQ25DLEtBQUs7O0VBRUw7RUFDQSxJQUFJLElBQUksQ0FBQyxZQUFZLEdBQUU7RUFDdkIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsWUFBWSxHQUFHO0VBQ2pCLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFFO0VBQ25CLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sSUFBSTtFQUNsQztFQUNBLE1BQU0sTUFBTSxhQUFhLEdBQUcsR0FBRTtFQUM5QixNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDbEMsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBQztFQUN0QyxRQUFRLE1BQU0sSUFBSSxHQUFHLEdBQUU7RUFDdkIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ3BDLFVBQVUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEtBQUk7RUFDakMsVUFBVSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBQztFQUMzQixVQUFVLElBQUksR0FBRyxJQUFJLElBQUksRUFBQztFQUMxQixTQUFTOztFQUVULFFBQVEsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDaEMsT0FBTzs7RUFFUDtFQUNBLE1BQU0sTUFBTSxjQUFjLEdBQUcsR0FBRTtFQUMvQixNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDbEMsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBQztFQUN0QyxRQUFRLE1BQU0sSUFBSSxHQUFHLEdBQUU7RUFDdkIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ3BDLFVBQVUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEtBQUk7RUFDakMsVUFBVSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFDaEMsVUFBVSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUM7RUFDMUIsU0FBUzs7RUFFVCxRQUFRLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ2pDLE9BQU87O0VBRVA7RUFDQSxNQUFNLE1BQU0sV0FBVyxHQUFHLEdBQUU7RUFDNUIsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ2xDLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtFQUNwQyxVQUFVLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDO0VBQ3ZFLFVBQVUsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUM7RUFDdEMsU0FBUztFQUNULE9BQU87RUFDUCxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBQztFQUNsQyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsYUFBYSxDQUFDLENBQUMsRUFBRTtFQUNuQixJQUFJLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUM7RUFDOUUsSUFBSSxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsRUFBQztFQUM3QixJQUFJLE1BQU0sS0FBSyxHQUFHLE9BQU07O0VBRXhCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLGFBQWEsRUFBQztFQUN2RCxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxJQUFJLFdBQVcsSUFBSSxLQUFJOztFQUU3QyxJQUFJLE9BQU8sR0FBRztFQUNkLEdBQUc7O0VBRUg7RUFDQSxFQUFFLHdCQUF3QixDQUFDLE1BQU0sRUFBRTtFQUNuQyxJQUFJLE1BQU0sT0FBTyxHQUFHLEdBQUU7O0VBRXRCLElBQUksTUFBTSxLQUFLLEdBQUcsTUFBTSxHQUFHLE1BQU0sR0FBRyxFQUFDO0VBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBQztFQUN2QyxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDdEMsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFDO0VBQ3JDLEtBQUs7O0VBRUwsSUFBSSxPQUFPLE9BQU87RUFDbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxFQUFFO0VBQzlCLElBQUksTUFBTSxPQUFPLEdBQUcsR0FBRTs7RUFFdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxNQUFNLEdBQUcsTUFBTSxHQUFHLEVBQUM7RUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsR0FBRyxFQUFDO0VBQ3ZDLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtFQUN0QyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUM7RUFDckMsS0FBSzs7RUFFTCxJQUFJLE9BQU8sT0FBTztFQUNsQixHQUFHO0VBQ0gsQ0FBQzs7RUNqSmMsTUFBTSxHQUFHLENBQUM7RUFDekIsRUFBRSxXQUFXLEdBQUc7RUFDaEIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUU7RUFDcEIsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLEdBQUU7RUFDdkIsR0FBRzs7RUFFSCxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUU7RUFDakIsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBQztFQUMxQyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtFQUNyQixJQUFJLFFBQVEsSUFBSTtFQUNoQixNQUFNLEtBQUssTUFBTTtFQUNqQixRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBSztFQUM3QixRQUFRLEtBQUs7RUFDYixNQUFNLEtBQUssTUFBTTtFQUNqQixRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBQztFQUNyQyxRQUFRLEtBQUs7RUFDYixNQUFNO0VBQ04sUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQUs7RUFDakMsS0FBSztFQUNMLEdBQUc7O0VBRUgsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFO0VBQ2IsSUFBSSxRQUFRLElBQUk7RUFDaEIsTUFBTSxLQUFLLE1BQU07RUFDakIsUUFBUSxPQUFPLElBQUksQ0FBQyxRQUFRO0VBQzVCLE1BQU07RUFDTixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLENBQUM7RUFDbEUsS0FBSztFQUNMLEdBQUc7O0VBRUgsRUFBRSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUU7RUFDckIsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtFQUNuQyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMvQixLQUFLLE1BQU07RUFDWCxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMvQixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFRO0VBQ2xDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsRUFBQztFQUMvQixLQUFLO0VBQ0wsR0FBRzs7RUFFSCxFQUFFLElBQUksUUFBUSxHQUFHO0VBQ2pCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0VBQ3ZELEdBQUc7RUFDSCxDQUFDOztFQzFDYyxNQUFNLEdBQUcsQ0FBQztFQUN6QixFQUFFLFdBQVcsQ0FBQyxPQUFPLEVBQUU7RUFDdkIsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBQztFQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLEdBQUU7RUFDeEIsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxHQUFFO0VBQ3hCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFDO0VBQ3ZDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFDO0VBQ3ZDLEdBQUc7O0VBRUgsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFO0VBQ3BCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBQztFQUNsQyxHQUFHOztFQUVILEVBQUUsSUFBSSxHQUFHLEdBQUc7RUFDWixJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUk7RUFDcEIsR0FBRzs7RUFFSCxFQUFFLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRTtFQUNmLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFHO0VBQ25CLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEdBQUc7RUFDUixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTTtFQUNyQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTTs7RUFFckMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRTtFQUNsQixHQUFHO0VBQ0gsQ0FBQzs7RUMvQmMsTUFBTSxHQUFHLENBQUM7RUFDekIsRUFBRSxXQUFXLENBQUMsSUFBSSxFQUFFO0VBQ3BCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUM7RUFDcEIsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUk7RUFDcEIsR0FBRzs7RUFFSCxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUU7RUFDZCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUM7RUFDckUsR0FBRzs7RUFFSCxFQUFFLElBQUksbUJBQW1CLEdBQUc7RUFDNUIsSUFBSSxPQUFPLElBQUk7RUFDZixHQUFHOztFQUVILEVBQUUsSUFBSSx3QkFBd0IsR0FBRztFQUNqQztFQUNBLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUN2QixHQUFHOztFQUVILEVBQUUsSUFBSSx3QkFBd0IsR0FBRztFQUNqQztFQUNBLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUN2QixHQUFHOztFQUVILEVBQUUsSUFBSSx3QkFBd0IsR0FBRztFQUNqQyxJQUFJLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxlQUFlO0VBQzFELEdBQUc7O0VBRUgsRUFBRSxJQUFJLHNCQUFzQixHQUFHO0VBQy9CLElBQUksT0FBTyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDLGVBQWU7RUFDL0QsR0FBRzs7RUFFSDtFQUNBO0VBQ0EsRUFBRSxJQUFJLGVBQWUsR0FBRztFQUN4QixJQUFJLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixHQUFHLE1BQU07RUFDakQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsSUFBSSxlQUFlLEdBQUc7RUFDeEIsSUFBSSxPQUFPLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxNQUFNO0VBQ2pELEdBQUc7O0VBRUg7RUFDQTtFQUNBLEVBQUUsSUFBSSxNQUFNLEdBQUc7RUFDZixJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO0VBQzFCLE1BQU0sSUFBSSxDQUFDLG1CQUFtQjtFQUM5QixNQUFNLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxDQUFDO0VBQ3ZDLEtBQUs7RUFDTCxHQUFHOztFQUVIO0VBQ0E7RUFDQSxFQUFFLElBQUksTUFBTSxHQUFHO0VBQ2YsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSztFQUMxQixNQUFNLElBQUksQ0FBQyx3QkFBd0I7RUFDbkMsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsQ0FBQztFQUNyQyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRTtFQUNqQixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQztFQUNuQyxJQUFJLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUM7O0VBRTdELElBQUksT0FBTyxTQUFTLEtBQUssS0FBSztFQUM5QixHQUFHO0VBQ0gsQ0FBQzs7QUNwRUQsZUFBZTtFQUNmLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixDQUFDOztFQy9EYyxNQUFNLFFBQVEsQ0FBQztFQUM5QixFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUU7RUFDbEIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLE1B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
