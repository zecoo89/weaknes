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
      this.acc_ = value;
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
     * プログラムカウンタをスタックに積み、addrにジャンプする
     * */
    JSR: function(addr) {
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
    /* 0x45: EOR zeropage */
    function() {
      Util$1.execute.call(this, 'EOR', 'zeropage');
    },
    '6',
    '7',
    /* 0x48: PHA implied */
    function() {
      Util$1.execute.call(this, 'PHA', 'implied');
    },
    /* 0x49: EOR immediate */
    function() {
      Util$1.execute.call(this, 'EOR', 'immediate');
    },
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
    /* 0x69: ADC immediate */
    function() {
      Util$1.execute.call(this, 'ADC', 'immediate');
    },
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
    'c',
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
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0x98: TYA implied */
    function() {
      Util$1.execute.call(this, 'TYA', 'implied');
    },
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
    'c',
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
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    /* 0xb8: CLV implied */
    function() {
      Util$1.execute.call(this, 'CLV', 'implied');
    },
    '9',
    /* 0xba: TSX implied*/
    function() {
      Util$1.execute.call(this, 'TSX', 'implied');
    },
    'b',
    'c',
    /* 0xbd: LDA bsoluteX */
    function() {
      Util$1.execute.call(this, 'LDA', 'absoluteX');
    },
    'e',
    'f'
  ];

  /* 0xc0 - 0xcF */
  var xCx = [
    /* 0xc0: CPY immediate */
    function() {
      Util$1.execute.call(this, 'CPY', 'immediate');
    },
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
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
    /* 0xe0: CPX immediate */
    function() {
      Util$1.execute.call(this, 'CPX', 'immediate');
    },
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
    /* 0xe9: */
    function() {
      Util$1.execute.call(this, 'SBC', 'immediate');
    },
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9hZGRyZXNzaW5nL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvaW5zdHJ1Y3Rpb25zL2luZGV4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzL3V0aWwuanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgweC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgzeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy91dGlsLmpzIiwiLi4vc3JjL2NwdS9jcHUuanMiLCIuLi9zcmMvcHB1L3ZyYW0uanMiLCIuLi9zcmMvcHB1L3BwdS5qcyIsIi4uL3NyYy9idXMvaW5kZXguanMiLCIuLi9zcmMvbmVzLmpzIiwiLi4vc3JjL3JvbS9pbmRleC5qcyIsIi4uL3NyYy9yZW5kZXJlci9jb2xvcnMuanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgUmVnaXN0ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFjY18gPSAweDAwIC8vIOOCouOCreODpeODoOODrOODvOOCv++8muaxjueUqOa8lOeul1xuICAgIHRoaXMuaW5kZXhYXyA9IDB4MDAgLy8g44Ki44OJ44Os44OD44K344Oz44Kw44CB44Kr44Km44Oz44K/562J44Gr55So44GE44KLXG4gICAgdGhpcy5pbmRleFlfID0gMHgwMCAvLyDkuIrjgavlkIzjgZhcbiAgICB0aGlzLnNwXyA9IDB4MDFmZCAvLyDjgrnjgr/jg4Pjgq/jg53jgqTjg7Pjgr8gJDAxMDAtJDAxRkYsIOWIneacn+WApOOBrzB4MDFmZOOBo+OBveOBhFxuICAgIHRoaXMuc3RhdHVzXyA9IDB4MjRcbiAgICAvKlxuICAgIHN0YXR1czoge1xuICAgICAgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgICBuZWdhdGl2ZV86IDAsXG4gICAgICBvdmVyZmxvd186IDAsXG4gICAgICByZXNlcnZlZF86IDEsXG4gICAgICBicmVha186IDAsIC8vIOWJsuOCiui+vOOBv0JSS+eZuueUn+aZguOBq3RydWUsSVJR55m655Sf5pmC44GrZmFsc2VcbiAgICAgIGRlY2ltYWxfOiAwLFxuICAgICAgaW50ZXJydXB0XzogMSxcbiAgICAgIHplcm9fOiAwLFxuICAgICAgY2FycnlfOiAwXG4gICAgfVxuICAgICovXG4gICAgdGhpcy5wYyA9IDB4ODAwMCAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr9cbiAgfVxuXG4gIGRlYnVnU3RyaW5nKCkge1xuICAgIHJldHVybiBbXG4gICAgICAnQTonICsgdGhpcy5hY2MudG9TdHJpbmcoMTYpLFxuICAgICAgJ1g6JyArIHRoaXMuaW5kZXhYLnRvU3RyaW5nKDE2KSxcbiAgICAgICdZOicgKyB0aGlzLmluZGV4WS50b1N0cmluZygxNiksXG4gICAgICAnUDonICsgdGhpcy5zdGF0dXNBbGxSYXdCaXRzLnRvU3RyaW5nKDE2KSxcbiAgICAgICdTUDonICsgKHRoaXMuc3AgJiAweGZmKS50b1N0cmluZygxNilcbiAgICBdLmpvaW4oJyAnKVxuICB9XG5cbiAgZ2V0IHN0YXR1c0FsbFJhd0JpdHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdHVzX1xuICB9XG5cbiAgc2V0IHN0YXR1c0FsbFJhd0JpdHMoYml0cykge1xuICAgIHRoaXMuc3RhdHVzXyA9IGJpdHNcbiAgICB0aGlzLnN0YXR1c1Jlc2VydmVkID0gMSAvLyByZXNlcnZlZOOBr+W4uOOBqzHjgavjgrvjg4Pjg4jjgZXjgozjgabjgYTjgotcbiAgfVxuXG4gIGdldCBhY2MoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWNjX1xuICB9XG5cbiAgc2V0IGFjYyh2YWx1ZSkge1xuICAgIHRoaXMuYWNjXyA9IHZhbHVlXG4gIH1cblxuICBnZXQgaW5kZXhYKCkge1xuICAgIHJldHVybiB0aGlzLmluZGV4WF9cbiAgfVxuXG4gIHNldCBpbmRleFgodmFsdWUpIHtcbiAgICB0aGlzLmluZGV4WF8gPSB2YWx1ZSAmIDB4ZmZcbiAgfVxuXG4gIGdldCBpbmRleFkoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhZX1xuICB9XG5cbiAgc2V0IGluZGV4WSh2YWx1ZSkge1xuICAgIHRoaXMuaW5kZXhZXyA9IHZhbHVlICYgMHhmZlxuICB9XG5cbiAgZ2V0IHNwKCkge1xuICAgIHJldHVybiB0aGlzLnNwX1xuICB9XG5cbiAgc2V0IHNwKHZhbHVlKSB7XG4gICAgdGhpcy5zcF8gPSAweDAxMDAgfCB2YWx1ZVxuICB9XG5cbiAgZ2V0IHN0YXR1c05lZ2F0aXZlKCkge1xuICAgIHJldHVybiB0aGlzLnN0YXR1c18gPj4gN1xuICB9XG5cbiAgc2V0IHN0YXR1c05lZ2F0aXZlKGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4N2YgLy8gMDExMSAxMTExXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgKGJpdCA8PCA3KVxuICB9XG5cbiAgZ2V0IHN0YXR1c092ZXJmbG93KCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDYpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c092ZXJmbG93KGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4YmYgLy8gMTAxMSAxMTExXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgKGJpdCA8PCA2KVxuICB9XG5cbiAgZ2V0IHN0YXR1c1Jlc2VydmVkKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDUpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c1Jlc2VydmVkKGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4ZGYgLy8gMTEwMSAxMTExXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgKGJpdCA8PCA1KVxuICB9XG5cbiAgZ2V0IHN0YXR1c0JyZWFrKCkge1xuICAgIHJldHVybiAodGhpcy5zdGF0dXNfID4+IDQpICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0JyZWFrKGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4ZWYgLy8gMTExMCAxMTExXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgKGJpdCA8PCA0KVxuICB9XG5cbiAgZ2V0IHN0YXR1c0RlY2ltYWwoKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0YXR1c18gPj4gMykgJiAweDAxXG4gIH1cblxuICBzZXQgc3RhdHVzRGVjaW1hbChiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGY3IC8vIDExMTEgMDExMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgMylcbiAgfVxuXG4gIGdldCBzdGF0dXNJbnRlcnJ1cHQoKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0YXR1c18gPj4gMikgJiAweDAxXG4gIH1cblxuICBzZXQgc3RhdHVzSW50ZXJydXB0KGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4ZmIgLy8gMTExMSAxMDExXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgKGJpdCA8PCAyKVxuICB9XG5cbiAgZ2V0IHN0YXR1c1plcm8oKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0YXR1c18gPj4gMSkgJiAweDAxXG4gIH1cblxuICBzZXQgc3RhdHVzWmVybyhiaXQpIHtcbiAgICB0aGlzLnN0YXR1c18gPSB0aGlzLnN0YXR1c18gJiAweGZkIC8vIDExMTEgMTEwMVxuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyB8IChiaXQgPDwgMSlcbiAgfVxuXG4gIGdldCBzdGF0dXNDYXJyeSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0dXNfICYgMHgwMVxuICB9XG5cbiAgc2V0IHN0YXR1c0NhcnJ5KGJpdCkge1xuICAgIHRoaXMuc3RhdHVzXyA9IHRoaXMuc3RhdHVzXyAmIDB4ZmUgLy8gMTExMSAxMTEwXG4gICAgdGhpcy5zdGF0dXNfID0gdGhpcy5zdGF0dXNfIHwgYml0XG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubWVtb3J5ID0gbmV3IFVpbnQ4QXJyYXkoMHgxMDAwMClcbiAgfVxuXG4gIC8qIE1lbW9yeSBtYXBwZWQgSS9P44Gn44GC44KL44Gf44KB77yM44OQ44K5KEJ1cynjgpLmjqXntprjgZfjgabjgYrjgY9cbiAgICogUFBV562J44G444GvQnVz44KS6YCa44GX44Gm44OH44O844K/44Gu44KE44KK5Y+W44KK44KS6KGM44GGXG4gICAqICovXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgKHRoaXMuYnVzID0gcGFydHMuYnVzKVxuICB9XG5cbiAgLypUT0RPIOWQhOODneODvOODiChhZGRyKeOBq+OCouOCr+OCu+OCueOBjOOBguOBo+OBn+WgtOWQiOOBq+OBr+ODkOOCueOBq+abuOOBjei+vOOCgCAqL1xuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIGlmIChhZGRyID49IDB4MjAwMCAmJiBhZGRyIDw9IDB4MjAwNykge1xuICAgICAgdGhpcy5idXMud3JpdGUoYWRkciwgdmFsdWUpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyDpgJrluLjjga7jg6Hjg6Ljg6rjgqLjgq/jgrvjgrlcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlXG4gIH1cblxuICAvKlRPRE8g44Kz44Oz44OI44Ot44O844Op55So44Gu44Od44O844OIICovXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIGltcGxpZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBudWxsXG4gIH0sXG4gIC8qIDhiaXTjga7ljbPlgKTjgarjga7jgafjgqLjg4njg6zjgrnjgpLjgZ3jga7jgb7jgb7ov5TjgZkgKi9cbiAgaW1tZWRpYXRlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIHJldHVybiBhZGRyXG4gIH0sXG5cbiAgLyog44Ki44OJ44Os44K5YWRkcig4Yml0KeOCkui/lOOBmSAqL1xuICB6ZXJvcGFnZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pXG4gICAgcmV0dXJuIGFkZHJcbiAgfSxcblxuICAvKiAo44Ki44OJ44Os44K5YWRkciArIOODrOOCuOOCueOCv2luZGV4WCkoOGJpdCnjgpLov5TjgZkgKi9cbiAgemVyb3BhZ2VYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICByZXR1cm4gYWRkciAmIDB4ZmZcbiAgfSxcblxuICAvKiDkuIrjgajlkIzjgZjjgadpbmRleFnjgavmm7/jgYjjgovjgaDjgZEqL1xuICB6ZXJvcGFnZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuICAgIHJldHVybiBhZGRyICYgMHhmZlxuICB9LFxuXG4gIC8qIHplcm9wYWdl44GuYWRkcuOBjDE2Yml054mIICovXG4gIGFic29sdXRlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOClcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBhYnNvbHV0ZVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKVxuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZChoaWdoQWRkcl8pXG5cbiAgICBjb25zdCBhZGRyID0gKGxvd0FkZHIgfCAoaGlnaEFkZHIgPDwgOCkpICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIGluZGlyZWN0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkcl8gPSBsb3dBZGRyIHwgKGhpZ2hBZGRyIDw8IDgpXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRleEluZGlyZWN0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgbGV0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgYWRkcl8gPSBhZGRyXyAmIDB4MDBmZlxuXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgKHRoaXMucmFtLnJlYWQoYWRkcl8gKyAxKSA8PCA4KVxuXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmZmZcbiAgfSxcblxuICBpbmRpcmVjdEluZGV4OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyX18gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJhbS5yZWFkKGFkZHJfXylcblxuICAgIGxldCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCAodGhpcy5yYW0ucmVhZChhZGRyXyArIDEpIDw8IDgpXG4gICAgYWRkciA9IGFkZHIgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgLyogKOODl+ODreOCsOODqeODoOOCq+OCpuODs+OCvyArIOOCquODleOCu+ODg+ODiCnjgpLov5TjgZnjgIJcbiAgICog44Kq44OV44K744OD44OI44Gu6KiI566X44Gn44Gv56ym5Y+35LuY44GN44Gu5YCk44GM5L2/55So44GV44KM44KL44CCXG4gICAqIOespuWPt+S7mOOBjeOBruWApOOBr1xuICAgKiAgIC0xMjgoMHg4MCkgfiAtMSAoMHhmZilcbiAgICogICAwKDB4MDApIH4gMTI3KDB4N2YpXG4gICAqICovXG4gIHJlbGF0aXZlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBzaWduZWROdW1iZXIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuXG4gICAgbGV0IGFkZHIgPVxuICAgICAgc2lnbmVkTnVtYmVyID49IDB4ODBcbiAgICAgICAgPyB0aGlzLnJlZ2lzdGVycy5wYyArIHNpZ25lZE51bWJlciAtIDB4MTAwXG4gICAgICAgIDogdGhpcy5yZWdpc3RlcnMucGMgKyBzaWduZWROdW1iZXJcblxuICAgIHJldHVybiBhZGRyXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgaXNOZWdhdGl2ZTogdmFsdWUgPT4gdmFsdWUgPj4gNyxcbiAgaXNaZXJvOiB2YWx1ZSA9PiAodmFsdWUgPT09IDB4MDApICYgMSxcbiAgbXNiOiB2YWx1ZSA9PiB2YWx1ZSA+PiA3LFxuICBsc2I6IHZhbHVlID0+IHZhbHVlICYgMHgwMSxcbiAgYWRkOiAoYSwgYikgPT4gKGEgKyBiKSAmIDB4ZmYsXG4gIHN1YjogKGEsIGIpID0+IChhIC0gYikgJiAweGZmXG59XG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgLyogTEQqIChMb2FkIG1lbW9yeVthZGRyKSB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlIDog5a++6LGh44Gu5pyA5LiK5L2N44OT44OD44OIKDDjgYvjgonmlbDjgYjjgaY3Yml055uuKVxuICAgKiAgIC0gemVybyA6IOioiOeul+e1kOaenOOBjOOCvOODreOBruOBqOOBjTHjgZ3jgYbjgafjgarjgZHjgozjgbAwXG4gICAqICovXG4gIExEQTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuICAvKiDjg6zjgrjjgrnjgr9pbmRleFjjgatkYXRh44KS44Ot44O844OJ44GZ44KLICovXG4gIExEWDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIExEWTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WSA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIFNUKiAoU3RvcmUgbWVtb3J5W2FkZHIpIHRvICogcmVnaXN0ZXIpXG4gICAqIOODleODqeOCsOaTjeS9nOOBr+eEoeOBl1xuICAgKiAqL1xuICBTVEE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5hY2MpXG4gIH0sXG5cbiAgU1RYOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhYKVxuICB9LFxuXG4gIFNUWTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmluZGV4WSlcbiAgfSxcblxuICAvKiBUKiogKFRyYW5zZmVyICogcmVnaXN0ZXIgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gemVyb1xuICAgKiAqL1xuICBUQVg6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgVEFZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WSA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRTWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5zcFxuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRYQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvLyBUWFPjga/ku5bjga5UWCrjgajpgZXjgYTjgIHjg5Xjg6njgrDjgpLlpInmm7TjgZfjgarjgYRcbiAgVFhTOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnNwID0gdmFsdWVcbiAgICAvL3RoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIC8vdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRZQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFlcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBB44G+44Gf44Gv44Oh44Oi44Oq44KS5bem44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIEFTTDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IG1zYiA9IFV0aWwubXNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlIDw8IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbXNiXG4gIH0sXG5cbiAgLyogYWNj44G+44Gf44Gv44Oh44Oi44Oq44KS5Y+z44G444K344OV44OIXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIExTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IGxzYiA9IFV0aWwubHNiKHZhbHVlKVxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHZhbHVlID4+IDEpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gIH0sXG5cbiAgLyogQeOBqOODoeODouODquOCkkFOROa8lOeul+OBl+OBpuODleODqeOCsOOCkuaTjeS9nOOBmeOCi1xuICAgKiDmvJTnrpfntZDmnpzjga/mjajjgabjgotcbiAgICogKi9cbiAgQklUOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgbWVtb3J5ID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIG1lbW9yeSA/IDB4MDAgOiAweDAxXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBtZW1vcnkgPj4gN1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gKG1lbW9yeSA+PiA2KSAmIDB4MDFcbiAgfSxcblxuICAvKiBB44Go44Oh44Oi44Oq44KS5q+U6LyD5ryU566X44GX44Gm44OV44Op44Kw44KS5pON5L2cXG4gICAqIOa8lOeul+e1kOaenOOBr+aNqOOBpuOCi1xuICAgKiBBID09IG1lbSAtPiBaID0gMFxuICAgKiBBID49IG1lbSAtPiBDID0gMVxuICAgKiBBIDw9IG1lbSAtPiBDID0gMFxuICAgKiAqL1xuICBDTVA6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnJlZ2lzdGVycy5hY2MgLSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShyZXN1bHQpXG5cbiAgICBpZiAocmVzdWx0ID49IDApIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDBcbiAgICB9XG4gIH0sXG5cbiAgLyogWOOBqOODoeODouODquOCkuavlOi8g+a8lOeulyAqL1xuICAvKiBUT0RPIOODleODqeOCsOaTjeS9nOOBjOaAquOBl+OBhOOBruOBp+imgeODgeOCp+ODg+OCryAqL1xuICBDUFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFggLSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZShyZXN1bHQpXG5cbiAgICBpZiAocmVzdWx0ID49IDApIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IDBcbiAgICB9XG4gIH0sXG5cbiAgLyogWeOBqOODoeODouODquOCkuavlOi8g+a8lOeulyovXG4gIENQWTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WSAtIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8ocmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHJlc3VsdClcblxuICAgIGlmIChyZXN1bHQgPj0gMCkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gMFxuICAgIH1cbiAgfSxcblxuICAvKiAq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44O744OH44Kv44Oq44Oh44Oz44OI44GZ44KLXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVcbiAgICogICAtIHplcm9cbiAgICogKi9cbiAgLyog44Oh44Oi44Oq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLKi9cbiAgSU5DOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgY29uc3QgcmVzdWx0ID0gVXRpbC5hZGQodmFsdWUsIDEpXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgcmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHJlc3VsdClcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8ocmVzdWx0KVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuODh+OCr+ODquODoeODs+ODiCAqL1xuICBERUM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICBjb25zdCByZXN1bHQgPSBVdGlsLnN1Yih2YWx1ZSwgMSlcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCByZXN1bHQpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUocmVzdWx0KVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyhyZXN1bHQpXG4gIH0sXG5cbiAgLyogWOOCkuOCpOODs+OCr+ODquODoeODs+ODiOOBmeOCiyAqL1xuICBJTlg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IFV0aWwuYWRkKHRoaXMucmVnaXN0ZXJzLmluZGV4WCwgMSlcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBZ44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLICovXG4gIElOWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gVXRpbC5hZGQodGhpcy5yZWdpc3RlcnMuaW5kZXhZLCAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIFjjgpLjg4fjgq/jg6rjg6Hjg7Pjg4ggKi9cbiAgREVYOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFggPSBVdGlsLnN1Yih0aGlzLnJlZ2lzdGVycy5pbmRleFgsIDEpXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogWeOCkuODh+OCr+ODquODoeODs+ODiCovXG4gIERFWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gVXRpbC5zdWIodGhpcy5yZWdpc3RlcnMuaW5kZXhZLCAxKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjYyAmIG1lbW9yeVthZGRyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlXG4gICAqICAgLSB6ZXJvXG4gICAqICovXG4gIEFORDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjICYgdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhlhPUua8lOeul+OBl+OBpmFjY+OBq+e1kOaenOOCkui/lOOBmSovXG4gIEVPUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjIF4gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjY+OBqOODoeODouODquOCkuirlueQhk9S5ryU566X44GX44Gm57WQ5p6c44KSYWNj44G46L+U44GZICovXG4gIE9SQTogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjIHwgdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIOODoeODouODquOCkuW3puOBuOODreODvOODhuODvOODiOOBmeOCiyAqL1xuICBST0w6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBjYXJyeSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5XG4gICAgY29uc3QgbXNiID0gdGhpcy5yYW0ucmVhZChhZGRyKSA+PiA3XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA9IG1zYlxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsICh0aGlzLnJhbS5yZWFkKGFkZHIpIDw8IDEpIHwgY2FycnkpXG4gIH0sXG5cbiAgLyogYWNj44KS5bem44G444Ot44O844OG44O844OI44GZ44KLXG4gICAqIOWun+ijheOCkuiAg+OBiOOBpuOAgWFjY+OBruWgtOWQiOOCklJPTOOBqOWIhumbouOBl+OBn1xuICAgKiAqL1xuICBSTEE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGNhcnJ5ID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnlcbiAgICBjb25zdCBtc2IgPSB0aGlzLnJlZ2lzdGVycy5hY2MgPj4gN1xuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSBtc2JcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSAodGhpcy5yZWdpc3RlcnMuYWNjIDw8IDEpIHwgY2FycnlcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLlj7Pjgbjjg63jg7zjg4bjg7zjg4jjgZnjgosgKi9cbiAgUk9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgY2FycnkgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA8PCA3XG4gICAgY29uc3QgbHNiID0gdGhpcy5yYW0ucmVhZChhZGRyKSAmIDB4MDFcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c0NhcnJ5ID0gbHNiXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgKHRoaXMucmFtLnJlYWQoYWRkcikgPj4gMSkgfCBjYXJyeSlcbiAgfSxcblxuICAvKiBhY2PjgpLlj7Pjgbjjg63jg7zjg4bjg7zjg4jjgZnjgotcbiAgICog5a6f6KOF44KS6ICD44GI44GmYWNj44Gu5aC05ZCI44KSUk9S44Go5YiG6Zui44GX44GfXG4gICAqICovXG4gIFJSQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FycnkgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA8PCA3XG4gICAgY29uc3QgbHNiID0gdGhpcy5yZWdpc3RlcnMuYWNjICYgMHgwMVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSBsc2JcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSAodGhpcy5yZWdpc3RlcnMuYWNjID4+IDEpIHwgY2FycnlcbiAgfSxcblxuICAvKiBhY2MgKyBtZW1vcnkgKyBjYXJyeUZsYWdcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZVxuICAgKiAgIC0gb3ZlcmZsb3dcbiAgICogICAtIHplcm9cbiAgICogICAtIGNhcnJ5XG4gICAqICovXG4gIEFEQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGFjY1ZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgY29uc3QgbWVtVmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgY29uc3QgYWRkZWQgPSBhY2NWYWx1ZSArIG1lbVZhbHVlXG5cbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSAoYWRkZWQgKyB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSkgJiAweGZmXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAoYWRkZWQgKyB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeSA+IDB4ZmYpICYgMVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm8gPSBVdGlsLmlzWmVybyh0aGlzLnJlZ2lzdGVycy5hY2MpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmUgPSBVdGlsLmlzTmVnYXRpdmUodGhpcy5yZWdpc3RlcnMuYWNjKVxuXG4gICAgY29uc3QgYWNjTmVnYXRpdmVCaXQgPSBVdGlsLmlzTmVnYXRpdmUoYWNjVmFsdWUpXG4gICAgY29uc3QgbWVtTmVnYXRpdmVCaXQgPSBVdGlsLmlzTmVnYXRpdmUobWVtVmFsdWUpXG5cbiAgICBpZiAoYWNjTmVnYXRpdmVCaXQgPT09IG1lbU5lZ2F0aXZlQml0KSB7XG4gICAgICBjb25zdCByZXN1bHROZWdhdGl2ZUJpdCA9IHRoaXMucmVnaXN0ZXJzLmFjYyA+PiA3XG4gICAgICBpZiAocmVzdWx0TmVnYXRpdmVCaXQgIT09IGFjY05lZ2F0aXZlQml0KSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3cgPSAwXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93ID0gMFxuICAgIH1cbiAgfSxcblxuICAvKiAoYWNjIC0g44Oh44Oi44OqIC0g44Kt44Oj44Oq44O844OV44Op44KwKeOCkua8lOeul+OBl+OBpmFjY+OBuOi/lOOBmSAqL1xuICBTQkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBhY2NWYWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIGNvbnN0IG1lbVZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIGNvbnN0IHN1YmVkID0gYWNjVmFsdWUgLSBtZW1WYWx1ZSAtICghdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgJiAxKVxuXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gc3ViZWQgJiAweGZmXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAhKHN1YmVkIDwgMCkgJiAxXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNOZWdhdGl2ZSA9IFV0aWwuaXNOZWdhdGl2ZSh0aGlzLnJlZ2lzdGVycy5hY2MpXG5cbiAgICBjb25zdCBhY2NOZWdhdGl2ZUJpdCA9IFV0aWwuaXNOZWdhdGl2ZShhY2NWYWx1ZSlcbiAgICBjb25zdCBtZW1OZWdhdGl2ZUJpdCA9IFV0aWwuaXNOZWdhdGl2ZShtZW1WYWx1ZSlcblxuICAgIGlmIChhY2NOZWdhdGl2ZUJpdCAhPT0gbWVtTmVnYXRpdmVCaXQpIHtcbiAgICAgIGNvbnN0IHJlc3VsdE5lZ2F0aXZlQml0ID0gdGhpcy5yZWdpc3RlcnMuYWNjID4+IDdcbiAgICAgIGlmIChyZXN1bHROZWdhdGl2ZUJpdCAhPT0gYWNjTmVnYXRpdmVCaXQpIHtcbiAgICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3cgPSAxXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvdyA9IDBcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzT3ZlcmZsb3cgPSAwXG4gICAgfVxuICB9LFxuXG4gIC8qIGFjY+OCkuOCueOCv+ODg+OCr+OBq+ODl+ODg+OCt+ODpSAqL1xuICBQSEE6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhY2tQdXNoKHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgfSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolhY2Pjgavjg53jg4Pjg5fjgqLjg4Pjg5fjgZnjgosgKi9cbiAgUExBOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuc3RhY2tQb3AoKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzWmVybyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICB9LFxuXG4gIC8qIOOCueODhuODvOOCv+OCueODu+ODrOOCuOOCueOCv+OCkuOCueOCv+ODg+OCr+OBq+ODl+ODg+OCt+ODpVxuICAgKiDjgrnjg4bjg7zjgr/jgrnjg6zjgrjjgrnjgr/jgatCUkvjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYvjgonjg5fjg4Pjgrfjg6XjgZXjgozjgotcbiAgICog44OX44OD44K344Ol5b6M44Gv44Kv44Oq44Ki44GV44KM44KL44Gu44Gn44K544K/44OD44Kv44Gr5L+d5a2Y44GV44KM44Gf44K544OG44O844K/44K544Os44K444K544K/44Gg44GRQlJL44GM5pyJ5Yq544Gr44Gq44KLXG4gICAqICovXG4gIFBIUDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGFja1B1c2godGhpcy5yZWdpc3RlcnMuc3RhdHVzQWxsUmF3Qml0cyB8IDB4MTApIC8v44Gq44Gc44GLMHgxMOOBqOOBrk9S44KS5Y+W44KLXG4gIH0sXG5cbiAgLyog44K544K/44OD44Kv44GL44KJ44K544OG44O844K/44K544Os44K444K544K/44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLXG4gICAqIOODneODg+ODl+OBleOCjOOBpuOBi+OCieOCueODhuODvOOCv+OCueODrOOCuOOCueOCv+OBrkJSS+OBjOOCr+ODquOCouOBleOCjOOCi1xuICAgKi9cbiAgUExQOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNBbGxSYXdCaXRzID0gdGhpcy5zdGFja1BvcCgpICYgMHhlZiAvLyDjgarjgZzjgYsweGVm44Go44GuQU5E44KS5Y+W44KLXG4gIH0sXG5cbiAgLyog44Ki44OJ44Os44K544G444K444Oj44Oz44OX44GZ44KLICovXG4gIEpNUDogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICB9LFxuXG4gIC8qIOOCteODluODq+ODvOODgeODs+OCkuWRvOOBs+WHuuOBmVxuICAgKiDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr/jgpLjgrnjgr/jg4Pjgq/jgavnqY3jgb/jgIFhZGRy44Gr44K444Oj44Oz44OX44GZ44KLXG4gICAqICovXG4gIEpTUjogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGpzckFkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYyAtIDFcbiAgICBjb25zdCBoaWdoQWRkciA9IGpzckFkZHIgPj4gOFxuICAgIGNvbnN0IGxvd0FkZHIgPSBqc3JBZGRyICYgMHgwMGZmXG5cbiAgICB0aGlzLnN0YWNrUHVzaChoaWdoQWRkcilcbiAgICB0aGlzLnN0YWNrUHVzaChsb3dBZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICB9LFxuXG4gIC8qIOOCteODluODq+ODvOODgeODs+OBi+OCieW+qeW4sOOBmeOCiyAqL1xuICBSVFM6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnN0YWNrUG9wKClcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMuc3RhY2tQb3AoKVxuICAgIGNvbnN0IGFkZHIgPSAoaGlnaEFkZHIgPDwgOCkgfCBsb3dBZGRyXG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyICsgMVxuICB9LFxuXG4gIC8qIOWJsuOCiui+vOOBv+ODq+ODvOODgeODs+OBi+OCieW+qeW4sOOBmeOCiyAqL1xuICBSVEk6IGZ1bmN0aW9uKCkge30sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJDQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9ICF0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCreODo+ODquODvOODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCQ1M6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNDYXJyeVxuXG4gICAgaWYgKGlzQnJhbmNoYWJsZSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gICAgfVxuICB9LFxuXG4gIC8qIOOCvOODreODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCRVE6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSB0aGlzLnJlZ2lzdGVycy5zdGF0dXNaZXJvXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44K844Ot44OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQk5FOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c1plcm9cblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQk1JOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzTmVnYXRpdmVcblxuICAgIGlmIChpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQlBMOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c05lZ2F0aXZlXG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLKi9cbiAgQlZDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgaXNCcmFuY2hhYmxlID0gIXRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJWUzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGlzQnJhbmNoYWJsZSA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1c092ZXJmbG93XG5cbiAgICBpZiAoaXNCcmFuY2hhYmxlKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5wYyA9IGFkZHJcbiAgICB9XG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44K744OD44OI44GZ44KLICovXG4gIFNFQzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAxXG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44KS44Kv44Oq44Ki44GX44G+44GZICovXG4gIENMQzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzQ2FycnkgPSAwXG4gIH0sXG5cbiAgLyogSVJR5Ymy44KK6L6844G/44KS6Kix5Y+v44GZ44KLICovXG4gIENMSTogZnVuY3Rpb24oKSB7fSxcblxuICAvKiDjgqrjg7zjg5Djg7zjg5Xjg63jg7zjg5Xjg6njgrDjgpLjgq/jg6rjgqLjgZnjgosgKi9cbiAgQ0xWOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNPdmVyZmxvdyA9IDBcbiAgfSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgavoqK3lrprjgZnjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIFNFRDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzRGVjaW1hbCA9IDFcbiAgfSxcblxuICAvKiBCQ0Tjg6Ljg7zjg4njgYvjgonpgJrluLjjg6Ljg7zjg4njgavmiLvjgosgTkVT44Gr44Gv5a6f6KOF44GV44KM44Gm44GE44Gq44GEICovXG4gIENMRDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzRGVjaW1hbCA9IDBcbiAgfSxcblxuICAvKiBJUlHlibLjgorovrzjgb/jgpLnpoHmraLjgZnjgotcbiAgICog44OV44Op44KwXG4gICAqIGludGVycnVwdCDjgpLjgrvjg4Pjg4jjgZnjgotcbiAgICogKi9cbiAgU0VJOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNJbnRlcnJ1cHQgPSAxXG4gIH0sXG5cbiAgLyog44K944OV44OI44Km44Kn44Ki5Ymy44KK6L6844G/44KS6LW344GT44GZKi9cbiAgQlJLOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXNCcmVhayA9IDFcbiAgfSxcblxuICAvKiDnqbrjga7lkb3ku6TjgpLlrp/ooYzjgZnjgosgKi9cbiAgTk9QOiBmdW5jdGlvbigpIHtcbiAgICAvLyDkvZXjgoLjgZfjgarjgYRcbiAgfVxufVxuIiwiaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVdGlsIHtcbiAgc3RhdGljIGRlYnVnU3RyaW5nKGluc3RydWN0aW9uLCBhZGRyZXNzaW5nLCB2YWx1ZV8sIGFkZHJPZk9wY29kZSkge1xuICAgIGxldCBwcmVmaXggPSAnJCdcbiAgICBsZXQgdmFsdWVcblxuICAgIGlmIChhZGRyZXNzaW5nLm5hbWUgPT09ICdib3VuZCBpbW1lZGlhdGUnKSB7XG4gICAgICBwcmVmaXggPSAnIyQnXG4gICAgICB2YWx1ZSA9IHRoaXMucmFtLnJlYWQodmFsdWVfKVxuICAgIH0gZWxzZSBpZiAoYWRkcmVzc2luZy5uYW1lID09PSAnYm91bmQgaW1wbGllZCcpIHtcbiAgICAgIHByZWZpeCA9ICcnXG4gICAgICB2YWx1ZSA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gdmFsdWVfXG4gICAgfVxuXG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygxNilcbiAgICB9XG5cbiAgICBjb25zdCBwcmVmaXhBbmRWYWx1ZSA9IHByZWZpeCArIHZhbHVlXG4gICAgY29uc3QgY2hhcnMgPSBbXG4gICAgICBhZGRyT2ZPcGNvZGUudG9TdHJpbmcoMTYpLFxuICAgICAgaW5zdHJ1Y3Rpb24ubmFtZS5zcGxpdCgnICcpWzFdLFxuICAgICAgYWRkcmVzc2luZy5uYW1lLnNwbGl0KCcgJylbMV0sXG4gICAgICBwcmVmaXhBbmRWYWx1ZSxcbiAgICAgIHRoaXMucmVnaXN0ZXJzLmRlYnVnU3RyaW5nKClcbiAgICBdLmpvaW4oJyAnKVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmxvZyhjaGFycylcbiAgfVxuXG4gIHN0YXRpYyBleGVjdXRlKGluc3RydWN0aW9uTmFtZSwgYWRkcmVzc2luZ05hbWUpIHtcbiAgICBsZXQgYWRkck9mT3Bjb2RlXG4gICAgaWYgKHRoaXMuaXNEZWJ1Zykge1xuICAgICAgYWRkck9mT3Bjb2RlID0gdGhpcy5yZWdpc3RlcnMucGMgLSAxXG4gICAgfVxuXG4gICAgY29uc3QgYWRkcmVzc2luZyA9IEFkZHJlc3NpbmdbYWRkcmVzc2luZ05hbWVdLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gYWRkcmVzc2luZy5jYWxsKClcblxuICAgIGNvbnN0IGluc3RydWN0aW9uID0gSW5zdHJ1Y3Rpb25zW2luc3RydWN0aW9uTmFtZV0uYmluZCh0aGlzLCBhZGRyKVxuXG4gICAgaWYgKHRoaXMuaXNEZWJ1Zykge1xuICAgICAgVXRpbC5kZWJ1Z1N0cmluZy5jYWxsKHRoaXMsIGluc3RydWN0aW9uLCBhZGRyZXNzaW5nLCBhZGRyLCBhZGRyT2ZPcGNvZGUpXG4gICAgfVxuXG4gICAgaW5zdHJ1Y3Rpb24uY2FsbCgpXG4gIH1cbn1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgwMCAtIDB4MEYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgwMDogQlJLIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JSSycsICdpbXBsaWVkJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gIC8qIDB4MDYgQVNMIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdBU0wnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNycsXG4gIC8qIDB4MDg6IFBIUCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdQSFAnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4MDk6IE9SQSBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ09SQScsICdpbW1lZGlhdGUnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4MTAgLSAweDFGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4MTAgQlBMIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCUEwnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4MTggQ0xDIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NMQycsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHgyMCAtIDB4MkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHgyMDogSlNSIGFic29sdXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0pTUicsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4MjE6IElOQyBpbmRleEluZGlyZWN0ICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdJTkMnLCAnaW5kZXhJbmRpcmVjdCcpXG4gIH0sXG4gICcyJyxcbiAgJzMnLFxuICAvKiAweDI0OiBCSVQgemVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JJVCcsICd6ZXJvcGFnZScpXG4gIH0sXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4Mjg6IFBMUCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdQTFAnLCAnaW1wbGllZCcpXG4gIH0sXG4gIC8qIDB4Mjk6IEFORCBJbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0FORCcsICdpbW1lZGlhdGUnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4MzAgLSAweDNGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4MzA6IEJNSSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQk1JJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweDM4OiBTRUMgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU0VDJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDQwIC0gMHg0RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgLyogMHg0NTogRU9SIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdFT1InLCAnemVyb3BhZ2UnKVxuICB9LFxuICAnNicsXG4gICc3JyxcbiAgLyogMHg0ODogUEhBIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BIQScsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHg0OTogRU9SIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnRU9SJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICdhJyxcbiAgJ2InLFxuICAvKiAweDRjOiBKTVAgQWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0pNUCcsICdhYnNvbHV0ZScpXG4gIH0sXG4gICdkJyxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg1MCAtIDB4NUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg1MDogQlZDIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCVkMnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4NjAgLSAweDZGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4NjA6IFJUUyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdSVFMnLCAnaW1wbGllZCcpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHg2ODogUExBIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1BMQScsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHg2OTogQURDIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQURDJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHg3MDogQlZTIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCVlMnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4Nzg6IFNFSSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTRUknLCAnaW1wbGllZCcpXG4gIH0sXG4gICc5JyxcbiAgJ2EnLFxuICAnYicsXG4gICdjJyxcbiAgJ2QnLFxuICAnZScsXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDgwIC0gMHg4RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gIC8qIDB4ODQ6IFNUWSB6ZXJvcGFnZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RZJywgJ3plcm9wYWdlJylcbiAgfSxcbiAgLyogMHg4NTogU1RBIHplcm9wYWdlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVEEnLCAnemVyb3BhZ2UnKVxuICB9LFxuICAvKiAweDg2OiBTVFggWmVyb3BhZ2UgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NUWCcsICd6ZXJvcGFnZScpXG4gIH0sXG4gICc3JyxcbiAgLyogMHg4ODogREVZIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFWScsICdpbXBsaWVkJylcbiAgfSxcbiAgJzknLFxuICAvKiAweDhhOiBUWEEgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnVFhBJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnYicsXG4gICdjJyxcbiAgLyogMHg4ZDogU1RBIGFic29sdXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdTVEEnLCAnYWJzb2x1dGUnKVxuICB9LFxuICAvKiAweDhlOiBTVFggYWJzb2x1dGUqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnU1RYJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJ2YnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwuanMnXG5cbi8qIDB4OTAgLSAweDlGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4OTA6IEJDQyByZWxhdGl2ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCQ0MnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgJzYnLFxuICAnNycsXG4gIC8qIDB4OTg6IFRZQSBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUWUEnLCAnaW1wbGllZCcpXG4gIH0sXG4gICc5JyxcbiAgLyogOUE6IFRYUyBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUWFMnLCAnaW1wbGllZCcpXG4gIH0sXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweEEwIC0gMHhBRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweEEwOiBMRFkgaW1tZWRpYXRlKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEWScsICdpbW1lZGlhdGUnKVxuICB9LFxuICAnMScsXG4gIC8qIDB4QTI6IExEWCBpbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEWCcsICdpbW1lZGlhdGUnKVxuICB9LFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHhhODogVEFZIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1RBWScsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHhhOTogTERBIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERBJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gIC8qIDB4YWE6IFRBWCBpbXBsaWVkICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUQVgnLCAnaW1wbGllZCcpXG4gIH0sXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweGFkOiBMREEgYWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICdhYnNvbHV0ZScpXG4gIH0sXG4gIC8qIDB4YWU6IExEWCBhYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTERYJywgJ2Fic29sdXRlJylcbiAgfSxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhiMCAtIDB4YkYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhiMDogQkNTIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0JDUycsICdyZWxhdGl2ZScpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHhiODogQ0xWIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0NMVicsICdpbXBsaWVkJylcbiAgfSxcbiAgJzknLFxuICAvKiAweGJhOiBUU1ggaW1wbGllZCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdUU1gnLCAnaW1wbGllZCcpXG4gIH0sXG4gICdiJyxcbiAgJ2MnLFxuICAvKiAweGJkOiBMREEgYnNvbHV0ZVggKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0xEQScsICdhYnNvbHV0ZVgnKVxuICB9LFxuICAnZScsXG4gICdmJ1xuXVxuIiwiaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweGMwIC0gMHhjRiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAvKiAweGMwOiBDUFkgaW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDUFknLCAnaW1tZWRpYXRlJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweGM4OiBJTlkgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSU5ZJywgJ2ltcGxpZWQnKVxuICB9LFxuICAvKiAweGM5OiBDTVAgaW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdDTVAnLCAnaW1tZWRpYXRlJylcbiAgfSxcbiAgLyogMHhjYTogREVYIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0RFWCcsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnXG5dXG4iLCJpbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSByZWxhdGl2ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQk5FJywgJ3JlbGF0aXZlJylcbiAgfSxcbiAgJzEnLFxuICAnMicsXG4gICczJyxcbiAgJzQnLFxuICAnNScsXG4gICc2JyxcbiAgJzcnLFxuICAvKiAweGQ4OiBDTEQgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ0xEJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnOScsXG4gICdhJyxcbiAgJ2InLFxuICAnYycsXG4gICdkJyxcbiAgJ2UnLFxuICAnZidcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhlMCAtIDB4ZUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhlMDogQ1BYIGltbWVkaWF0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnQ1BYJywgJ2ltbWVkaWF0ZScpXG4gIH0sXG4gICcxJyxcbiAgJzInLFxuICAnMycsXG4gICc0JyxcbiAgJzUnLFxuICAnNicsXG4gICc3JyxcbiAgLyogMHhlODogSU5YIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ0lOWCcsICdpbXBsaWVkJylcbiAgfSxcbiAgLyogMHhlOTogKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NCQycsICdpbW1lZGlhdGUnKVxuICB9LFxuICAvKiAweGVhOiBOT1AgaW1wbGllZCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnTk9QJywgJ2ltcGxpZWQnKVxuICB9LFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhmMCAtIDB4ZmYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhmMDogQkVRIHJlbGF0aXZlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIFV0aWwuZXhlY3V0ZS5jYWxsKHRoaXMsICdCRVEnLCAncmVsYXRpdmUnKVxuICB9LFxuICAnMScsXG4gICcyJyxcbiAgJzMnLFxuICAnNCcsXG4gICc1JyxcbiAgLyogMHhmNjogSU5DIHplcm9wYWdlWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBVdGlsLmV4ZWN1dGUuY2FsbCh0aGlzLCAnSU5DJywgJ3plcm9wYWdlWCcpXG4gIH0sXG4gICc3JyxcbiAgLyogMHhmODogU0VEIGltcGxpZWQgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgVXRpbC5leGVjdXRlLmNhbGwodGhpcywgJ1NFRCcsICdpbXBsaWVkJylcbiAgfSxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJycsXG4gICcnLFxuICAnJyxcbiAgJydcbl1cbiIsImltcG9ydCB4MHggZnJvbSAnLi8weDB4J1xuaW1wb3J0IHgxeCBmcm9tICcuLzB4MXgnXG5pbXBvcnQgeDJ4IGZyb20gJy4vMHgyeCdcbmltcG9ydCB4M3ggZnJvbSAnLi8weDN4J1xuaW1wb3J0IHg0eCBmcm9tICcuLzB4NHgnXG5pbXBvcnQgeDV4IGZyb20gJy4vMHg1eCdcbmltcG9ydCB4NnggZnJvbSAnLi8weDZ4J1xuaW1wb3J0IHg3eCBmcm9tICcuLzB4N3gnXG5pbXBvcnQgeDh4IGZyb20gJy4vMHg4eCdcbmltcG9ydCB4OXggZnJvbSAnLi8weDl4J1xuaW1wb3J0IHhBeCBmcm9tICcuLzB4QXgnXG5pbXBvcnQgeEJ4IGZyb20gJy4vMHhCeCdcbmltcG9ydCB4Q3ggZnJvbSAnLi8weEN4J1xuaW1wb3J0IHhEeCBmcm9tICcuLzB4RHgnXG5pbXBvcnQgeEV4IGZyb20gJy4vMHhFeCdcbmltcG9ydCB4RnggZnJvbSAnLi8weEZ4J1xuXG5jb25zdCBvcGNvZGVzID0gW10uY29uY2F0KFxuICB4MHgsXG4gIHgxeCxcbiAgeDJ4LFxuICB4M3gsXG4gIHg0eCxcbiAgeDV4LFxuICB4NngsXG4gIHg3eCxcbiAgeDh4LFxuICB4OXgsXG4gIHhBeCxcbiAgeEJ4LFxuICB4Q3gsXG4gIHhEeCxcbiAgeEV4LFxuICB4RnhcbilcblxuZXhwb3J0IGRlZmF1bHQgb3Bjb2Rlc1xuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBpc05vZGVqcygpIHtcbiAgICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJ1xuICB9XG59XG4iLCJpbXBvcnQgUmVnaXN0ZXJzIGZyb20gJy4vcmVnaXN0ZXJzJ1xuaW1wb3J0IFJhbSBmcm9tICcuL3JhbSdcbmltcG9ydCBvcGNvZGVzIGZyb20gJy4vb3Bjb2RlcydcbmltcG9ydCBVdGlsIGZyb20gJy4uL3V0aWwnXG5cbi8qIDY1MDIgQ1BVICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDcHUge1xuICBjb25zdHJ1Y3Rvcihpc0RlYnVnKSB7XG4gICAgdGhpcy5pbml0KClcbiAgICB0aGlzLmlzRGVidWcgPSBpc0RlYnVnXG4gIH1cblxuICBpbml0KCkge1xuICAgIHRoaXMucmVnaXN0ZXJzID0gbmV3IFJlZ2lzdGVycygpXG4gICAgLy90aGlzLm9wY29kZXMgPSBvcGNvZGVzXG4gICAgdGhpcy5vcGNvZGVzID0gb3Bjb2Rlcy5tYXAob3Bjb2RlID0+IHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb3Bjb2RlID09PSAnZnVuY3Rpb24nID8gb3Bjb2RlLmJpbmQodGhpcykgOiBvcGNvZGVcbiAgICB9KVxuXG4gICAgdGhpcy5yYW0gPSBuZXcgUmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy5idXMgJiYgdGhpcy5yYW0uY29ubmVjdChwYXJ0cylcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaW5pdCgpXG4gICAgdGhpcy5ydW4oKVxuICB9XG5cbiAgcnVuKCkge1xuICAgIGNvbnN0IGV4ZWN1dGUgPSB0aGlzLmV2YWwuYmluZCh0aGlzKVxuXG4gICAgVXRpbC5pc05vZGVqcygpID8gc2V0SW50ZXJ2YWwoZXhlY3V0ZSwgMTApIDogZXhlY3V0ZSgpXG4gIH1cblxuICAvLyDlkb3ku6TjgpLlh6bnkIbjgZnjgotcbiAgZXZhbCgpIHtcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IG9wY29kZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcblxuICAgIGlmICh0eXBlb2YgdGhpcy5vcGNvZGVzW29wY29kZV0gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignMHgnICsgb3Bjb2RlLnRvU3RyaW5nKDE2KSArICcgaXMgbm90IGltcGxlbWVudGVkJylcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZXNbb3Bjb2RlXS5jYWxsKClcblxuICAgIGlmICghVXRpbC5pc05vZGVqcygpKSB7XG4gICAgICBjb25zdCBmbiA9IHRoaXMuZXZhbC5iaW5kKHRoaXMpXG4gICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZuKVxuICAgIH1cbiAgfVxuXG4gIC8qIDB4ODAwMH7jga7jg6Hjg6Ljg6rjgatST03lhoXjga5QUkctUk9N44KS6Kqt44G/6L6844KAKi9cbiAgc2V0IHByZ1JvbShwcmdSb20pIHtcbiAgICAvL3RoaXMuaW50ZXJydXB0VmVjdG9ycyhwcmdSb20pXG4gICAgY29uc3Qgc3RhcnRBZGRyID0gMHhmZmZmIC0gcHJnUm9tLmxlbmd0aFxuICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gc3RhcnRBZGRyXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZ1JvbS5sZW5ndGg7IGkrKykge1xuICAgICAgLy90aGlzLm1lbW9yeVtzdGFydEFkZHIraV0gPSBwcmdSb21baV1cbiAgICAgIHRoaXMucmFtLndyaXRlKHN0YXJ0QWRkciArIGksIHByZ1JvbVtpXSlcbiAgICB9XG5cbiAgICAvLyDjg5fjg63jgrDjg6njg6Djgqvjgqbjg7Pjgr/jga7liJ3mnJ/lgKTjgpIweEZGRkPjgYvjgonoqK3lrprjgZnjgotcbiAgICAvL3RoaXMucmVnaXN0ZXJzLnBjID0gdGhpcy5yYW0ucmVhZCgweGZmZmMpIDw8IDJcbiAgfVxuXG4gIC8qIOOCueOCv+ODg+OCr+mgmOWfn+OBq+WvvuOBmeOCi+aTjeS9nCovXG4gIHN0YWNrUHVzaCh2YWx1ZSkge1xuICAgIHRoaXMucmFtLndyaXRlKHRoaXMucmVnaXN0ZXJzLnNwLCB2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zcC0tXG4gIH1cblxuICBzdGFja1BvcCgpIHtcbiAgICByZXR1cm4gdGhpcy5yYW0ucmVhZCgrK3RoaXMucmVnaXN0ZXJzLnNwKVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBWcmFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5tZW1vcnkgPSBuZXcgVWludDhBcnJheSgweDQwMDApXG4gICAgdGhpcy52cCA9IG51bGxcbiAgfVxuXG4gIGNvbm5lY3QocHB1KSB7XG4gICAgdGhpcy5yZWZyZXNoRGlzcGxheSA9IHBwdS5yZWZyZXNoRGlzcGxheS5iaW5kKHBwdSlcbiAgfVxuXG4gIHdyaXRlRnJvbUJ1cyh2YWx1ZSkge1xuICAgIC8vY29uc29sZS5sb2coJ3ZyYW1bJCcgKyB0aGlzLnZwLnRvU3RyaW5nKDE2KSArICddID0gJyArIFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpKVxuICAgIHRoaXMubWVtb3J5W3RoaXMudnBdID0gdmFsdWVcbiAgICB0aGlzLnZwKytcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ICYmIHRoaXMucmVmcmVzaERpc3BsYXkoKVxuICB9XG5cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlXG4gIH1cblxuICByZWFkKGFkZHIpIHtcbiAgICByZXR1cm4gdGhpcy5tZW1vcnlbYWRkcl1cbiAgfVxufVxuIiwiaW1wb3J0IFZyYW0gZnJvbSAnLi92cmFtJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBQcHUge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmluaXQoKVxuICB9XG5cbiAgaW5pdCgpIHtcbiAgICAvKiBBYm91dCBWUkFNXG4gICAgICogMHgwMDAwIC0gMHgwZmZmIDogUGF0dGVybiB0YWJsZSAwXG4gICAgICogMHgxMDAwIC0gMHgxZmZmIDogUGF0dGVybiB0YWJsZSAxXG4gICAgICogMHgyMDAwIC0gMHgyM2JmIDogTmFtZSB0YWJsZSAwXG4gICAgICogMHgyM2MwIC0gMHgyM2ZmIDogQXR0cmlidXRlIHRhYmxlIDBcbiAgICAgKiAweDI0MDAgLSAweDI3YmYgOiBOYW1lIHRhYmxlIDFcbiAgICAgKiAweDJiYzAgLSAweDJiYmYgOiBBdHRyaWJ1dGUgdGFibGUgMVxuICAgICAqIDB4MmMwMCAtIDB4MmZiZiA6IE5hbWUgdGFibGUgMlxuICAgICAqIDB4MmJjMCAtIDB4MmJmZiA6IEF0dHJpYnV0ZSB0YWJsZSAyXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAzXG4gICAgICogMHgyZmMwIC0gMHgyZmZmIDogQXR0cmlidXRlIHRhYmxlIDNcbiAgICAgKiAweDMwMDAgLSAweDNlZmYgOiBNaXJyb3Igb2YgMHgyMDAwIC0gMHgyZmZmXG4gICAgICogMHgzZjAwIC0gMHgzZjBmIDogQmFja2dyb3VuZCBwYWxldHRlXG4gICAgICogMHgzZjEwIC0gMHgzZjFmIDogU3ByaXRlIHBhbGV0dGVcbiAgICAgKiAweDNmMjAgLSAweDNmZmYgOiBNaXJyb3Igb2YgMHgzZjAwIDAgMHgzZjFmXG4gICAgICogKi9cbiAgICB0aGlzLnZyYW0gPSBuZXcgVnJhbSgpXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgaWYgKHBhcnRzLmJ1cykge1xuICAgICAgcGFydHMuYnVzLmNvbm5lY3QoeyB2cmFtOiB0aGlzLnZyYW0gfSlcbiAgICB9XG5cbiAgICBpZiAocGFydHMucmVuZGVyZXIpIHtcbiAgICAgIHRoaXMucmVuZGVyZXIgPSBwYXJ0cy5yZW5kZXJlclxuICAgICAgdGhpcy52cmFtLmNvbm5lY3QodGhpcylcbiAgICB9XG4gIH1cblxuICAvKiAkMjAwMCAtICQyM0JG44Gu44ON44O844Og44OG44O844OW44Or44KS5pu05paw44GZ44KLICovXG4gIHJlZnJlc2hEaXNwbGF5KCkge1xuICAgIC8qIOOCv+OCpOODqyg4eDgp44KSMzIqMzDlgIsgKi9cbiAgICBmb3IgKGxldCBpID0gMHgyMDAwOyBpIDw9IDB4MjNiZjsgaSsrKSB7XG4gICAgICBjb25zdCB0aWxlSWQgPSB0aGlzLnZyYW0ucmVhZChpKVxuICAgICAgLyog44K/44Kk44Or44KS5oyH5a6aICovXG4gICAgICBjb25zdCB0aWxlID0gdGhpcy50aWxlc1t0aWxlSWRdXG4gICAgICAvKiDjgr/jgqTjg6vjgYzkvb/nlKjjgZnjgovjg5Hjg6zjg4Pjg4jjgpLlj5blvpcgKi9cbiAgICAgIGNvbnN0IHBhbGV0dGVJZCA9IHRoaXMuc2VsZWN0UGFsZXR0ZSh0aWxlSWQpXG4gICAgICBjb25zdCBwYWxldHRlID0gdGhpcy5zZWxlY3RCYWNrZ3JvdW5kUGFsZXR0ZXMocGFsZXR0ZUlkKVxuXG4gICAgICAvKiDjgr/jgqTjg6vjgajjg5Hjg6zjg4Pjg4jjgpJSZW5kZXJlcuOBq+a4oeOBmSAqL1xuICAgICAgdGhpcy5yZW5kZXJlci53cml0ZSh0aWxlLCBwYWxldHRlKVxuICAgIH1cbiAgfVxuXG4gIC8qIDB4MDAwMCAtIDB4MWZmZuOBruODoeODouODquOBq0NIUi1ST03jgpLoqq3jgb/ovrzjgoAgKi9cbiAgc2V0IGNoclJvbShjaHJSb20pIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoclJvbS5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy52cmFtLndyaXRlKGksIGNoclJvbVtpXSlcbiAgICB9XG5cbiAgICAvKiBDSFLpoJjln5/jgYvjgonjgr/jgqTjg6vjgpLmir3lh7rjgZfjgabjgYrjgY8gKi9cbiAgICB0aGlzLmV4dHJhY3RUaWxlcygpXG4gIH1cblxuICAvLyA4eDjjga7jgr/jgqTjg6vjgpLjgZnjgbnjgaZ2cmFt44GuQ0hS44GL44KJ5oq95Ye644GX44Gm44GK44GPXG4gIGV4dHJhY3RUaWxlcygpIHtcbiAgICB0aGlzLnRpbGVzID0gW11cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDB4MWZmZjsgKSB7XG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIvkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGxvd2VyQml0TGluZXMgPSBbXVxuICAgICAgZm9yIChsZXQgaCA9IDA7IGggPCA4OyBoKyspIHtcbiAgICAgICAgbGV0IGJ5dGUgPSB0aGlzLnZyYW0ucmVhZChpKyspXG4gICAgICAgIGNvbnN0IGxpbmUgPSBbXVxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAgICAgIGNvbnN0IGJpdCA9IGJ5dGUgJiAweDAxXG4gICAgICAgICAgbGluZS51bnNoaWZ0KGJpdClcbiAgICAgICAgICBieXRlID0gYnl0ZSA+PiAxXG4gICAgICAgIH1cblxuICAgICAgICBsb3dlckJpdExpbmVzLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgLy8g44K/44Kk44Or44Gu5LiK5L2N44OT44OD44OIXG4gICAgICBjb25zdCBoaWdoZXJCaXRMaW5lcyA9IFtdXG4gICAgICBmb3IgKGxldCBoID0gMDsgaCA8IDg7IGgrKykge1xuICAgICAgICBsZXQgYnl0ZSA9IHRoaXMudnJhbS5yZWFkKGkrKylcbiAgICAgICAgY29uc3QgbGluZSA9IFtdXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0IDw8IDEpXG4gICAgICAgICAgYnl0ZSA9IGJ5dGUgPj4gMVxuICAgICAgICB9XG5cbiAgICAgICAgaGlnaGVyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDkuIrkvY3jg5Pjg4Pjg4jjgajkuIvkvY3jg5Pjg4Pjg4jjgpLlkIjmiJDjgZnjgotcbiAgICAgIGNvbnN0IHBlcmZlY3RCaXRzID0gW11cbiAgICAgIGZvciAobGV0IGggPSAwOyBoIDwgODsgaCsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICAgICAgY29uc3QgcGVyZmVjdEJpdCA9IGxvd2VyQml0TGluZXNbaF1bal0gfCBoaWdoZXJCaXRMaW5lc1toXVtqXVxuICAgICAgICAgIHBlcmZlY3RCaXRzLnB1c2gocGVyZmVjdEJpdClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy50aWxlcy5wdXNoKHBlcmZlY3RCaXRzKVxuICAgIH1cbiAgfVxuXG4gIC8qIOWxnuaAp+ODhuODvOODluODq+OBi+OCieipsuW9k+ODkeODrOODg+ODiOOBrueVquWPt+OCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RQYWxldHRlKG4pIHtcbiAgICBjb25zdCBibG9ja1Bvc2l0aW9uID0gKChuIC0gKG4gJSA2NCkpIC8gNjQpICogOCArICgobiAlIDY0KSAtIChuICUgNCkpIC8gNFxuICAgIGNvbnN0IGJpdFBvc2l0aW9uID0gbiAlIDRcbiAgICBjb25zdCBzdGFydCA9IDB4MjNjMFxuXG4gICAgY29uc3QgYmxvY2sgPSB0aGlzLnZyYW0ucmVhZChzdGFydCArIGJsb2NrUG9zaXRpb24pXG4gICAgY29uc3QgYml0ID0gKGJsb2NrID4+IGJpdFBvc2l0aW9uKSAmIDB4MDNcblxuICAgIHJldHVybiBiaXRcbiAgfVxuXG4gIC8qICQzRjAwLSQzRjBG44GL44KJ44OQ44OD44Kv44Kw44Op44Km44Oz44OJKOiDjOaZrynjg5Hjg6zjg4Pjg4jjgpLlj5blvpfjgZnjgosgKi9cbiAgc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMDAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjAwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgcGFsZXR0ZS5wdXNoKHRoaXMudnJhbS5yZWFkKGkpKVxuICAgIH1cblxuICAgIHJldHVybiBwYWxldHRlXG4gIH1cblxuICAvKiAkM0YxMC0kM0YxRuOBi+OCieOCueODl+ODqeOCpOODiOODkeODrOODg+ODiOOCkuWPluW+l+OBmeOCiyAqL1xuICBzZWxlY3RTcHJpdGVQYWxldHRzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMTAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjEwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgcGFsZXR0ZS5wdXNoKHRoaXMudnJhbS5yZWFkKGkpKVxuICAgIH1cblxuICAgIHJldHVybiBwYWxldHRlXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1cyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuYnVmZmVyID0ge31cbiAgICB0aGlzLnZyYW1BZGRyXyA9IFtdXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMudnJhbSAmJiAodGhpcy52cmFtID0gcGFydHMudnJhbSlcbiAgfVxuXG4gIC8qIENQVeWBtOOBi+OCieOBruOBv+OBl+OBi+iAg+aFruOBl+OBpuOBquOBhCAqL1xuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIHN3aXRjaCAoYWRkcikge1xuICAgICAgY2FzZSAweDIwMDY6XG4gICAgICAgIHRoaXMudnJhbUFkZHIgPSB2YWx1ZVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAweDIwMDc6XG4gICAgICAgIHRoaXMudnJhbS53cml0ZUZyb21CdXModmFsdWUpXG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmJ1ZmZlclthZGRyXSA9IHZhbHVlXG4gICAgfVxuICB9XG5cbiAgcmVhZChhZGRyKSB7XG4gICAgc3dpdGNoIChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgcmV0dXJuIHRoaXMudnJhbUFkZHJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1cyBvZiB0aGlzIGFkZHIgaXMgTm90IGltcGxlbWVudGVkJylcbiAgICB9XG4gIH1cblxuICBzZXQgdnJhbUFkZHIoYWRkcikge1xuICAgIGlmICh0aGlzLnZyYW1BZGRyXy5sZW5ndGggPCAxKSB7XG4gICAgICB0aGlzLnZyYW1BZGRyXy5wdXNoKGFkZHIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudnJhbUFkZHJfLnB1c2goYWRkcilcbiAgICAgIHRoaXMudnJhbS52cCA9IHRoaXMudnJhbUFkZHJcbiAgICAgIHRoaXMudnJhbUFkZHJfLmxlbmd0aCA9IDBcbiAgICB9XG4gIH1cblxuICBnZXQgdnJhbUFkZHIoKSB7XG4gICAgcmV0dXJuICh0aGlzLnZyYW1BZGRyX1swXSA8PCA4KSArIHRoaXMudnJhbUFkZHJfWzFdXG4gIH1cbn1cbiIsImltcG9ydCBDcHUgZnJvbSAnLi9jcHUnXG5pbXBvcnQgUHB1IGZyb20gJy4vcHB1J1xuaW1wb3J0IEJ1cyBmcm9tICcuL2J1cydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTmVzIHtcbiAgY29uc3RydWN0b3IoaXNEZWJ1Zykge1xuICAgIHRoaXMuY3B1ID0gbmV3IENwdShpc0RlYnVnKVxuICAgIHRoaXMucHB1ID0gbmV3IFBwdSgpXG4gICAgdGhpcy5idXMgPSBuZXcgQnVzKClcbiAgICB0aGlzLnBwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICAgIHRoaXMuY3B1LmNvbm5lY3QoeyBidXM6IHRoaXMuYnVzIH0pXG4gIH1cblxuICBjb25uZWN0KHJlbmRlcmVyKSB7XG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IHJlbmRlcmVyIH0pXG4gIH1cblxuICBnZXQgcm9tKCkge1xuICAgIHJldHVybiB0aGlzLl9yb21cbiAgfVxuXG4gIHNldCByb20ocm9tKSB7XG4gICAgdGhpcy5fcm9tID0gcm9tXG4gIH1cblxuICBydW4oKSB7XG4gICAgdGhpcy5jcHUucHJnUm9tID0gdGhpcy5yb20ucHJnUm9tXG4gICAgdGhpcy5wcHUuY2hyUm9tID0gdGhpcy5yb20uY2hyUm9tXG5cbiAgICB0aGlzLmNwdS5ydW4oKVxuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSb20ge1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5jaGVjayhkYXRhKVxuICAgIHRoaXMuZGF0YSA9IGRhdGFcbiAgfVxuXG4gIGNoZWNrKGRhdGEpIHtcbiAgICBpZiAoIXRoaXMuaXNOZXNSb20oZGF0YSkpIHRocm93IG5ldyBFcnJvcignVGhpcyBpcyBub3QgTkVTIFJPTS4nKVxuICB9XG5cbiAgZ2V0IE5FU19ST01fSEVBREVSX1NJWkUoKSB7XG4gICAgcmV0dXJuIDB4MTBcbiAgfVxuXG4gIGdldCBOVU1CRVJfT0ZfUFJHX1JPTV9CTE9DS1MoKSB7XG4gICAgLy9jb25zb2xlLmxvZygnTnVtYmVyIG9mIFBSRy1ST00gYmxvY2tzOiAnICsgdGhpcy5kYXRhWzRdKVxuICAgIHJldHVybiB0aGlzLmRhdGFbNF1cbiAgfVxuXG4gIGdldCBOVU1CRVJfT0ZfQ0hSX1JPTV9CTE9DS1MoKSB7XG4gICAgLy9jb25zb2xlLmxvZygnTnVtYmVyIG9mIENIUi1ST00gYmxvY2tzOiAnICsgdGhpcy5kYXRhWzVdKVxuICAgIHJldHVybiB0aGlzLmRhdGFbNV1cbiAgfVxuXG4gIGdldCBTVEFSVF9BRERSRVNTX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuTkVTX1JPTV9IRUFERVJfU0laRSArIHRoaXMuU0laRV9PRl9QUkdfUk9NXG4gIH1cblxuICBnZXQgRU5EX0FERFJFU1NfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5TVEFSVF9BRERSRVNTX09GX0NIUl9ST00gKyB0aGlzLlNJWkVfT0ZfQ0hSX1JPTVxuICB9XG5cbiAgLyogUFJHIFJPTeOBruOCteOCpOOCuuOCkuWPluW+l+OBmeOCi1xuICAgKiogUk9N44OY44OD44OA44GuMeOBi+OCieaVsOOBiOOBpjVCeXRl55uu44Gu5YCk44GrMTZLaSjjgq3jg5Mp44KS44GL44GR44Gf44K144Kk44K6ICovXG4gIGdldCBTSVpFX09GX1BSR19ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuTlVNQkVSX09GX1BSR19ST01fQkxPQ0tTICogMHg0MDAwXG4gIH1cblxuICAvKiBQUkcgUk9N44Gr5ZCM44GYKi9cbiAgZ2V0IFNJWkVfT0ZfQ0hSX1JPTSgpIHtcbiAgICByZXR1cm4gdGhpcy5OVU1CRVJfT0ZfQ0hSX1JPTV9CTE9DS1MgKiAweDIwMDBcbiAgfVxuXG4gIC8qIFJPTeOBi+OCiXByZ1JPTeOBq+ipsuW9k+OBmeOCi+OBqOOBk+OCjeOCkuWIh+OCiuWHuuOBmVxuICAgKiogcHJnUk9N44Gv44OY44OD44OA6aCY5Z+f44Gu5qyh44GuQnl0ZeOBi+OCieWni+OBvuOCiyAqL1xuICBnZXQgcHJnUm9tKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2xpY2UoXG4gICAgICB0aGlzLk5FU19ST01fSEVBREVSX1NJWkUsXG4gICAgICB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSAtIDFcbiAgICApXG4gIH1cblxuICAvKiBST03jgYvjgoljaHJST03jgavoqbLlvZPjgZnjgovjgajjgZPjgo3jgpLliIfjgorlh7rjgZlcbiAgICoqIGNoclJvbeOBr3ByZ1JvbeOBruW+jOOBi+OCieWni+OBvuOCiyAqL1xuICBnZXQgY2hyUm9tKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGEuc2xpY2UoXG4gICAgICB0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSxcbiAgICAgIHRoaXMuRU5EX0FERFJFU1NfT0ZfQ0hSX1JPTSAtIDFcbiAgICApXG4gIH1cblxuICAvKiDjg4fjg7zjgr/jga7jg5jjg4Pjg4DjgasnTkVTJ+OBjOOBguOCi+OBi+OBqeOBhuOBi+OBp05FU+OBrlJPTeOBi+WIpOWIpeOBmeOCiyAqL1xuICBpc05lc1JvbShkYXRhKSB7XG4gICAgY29uc3QgaGVhZGVyID0gZGF0YS5zbGljZSgwLCAzKVxuICAgIGNvbnN0IGhlYWRlclN0ciA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgaGVhZGVyKVxuXG4gICAgcmV0dXJuIGhlYWRlclN0ciA9PT0gJ05FUydcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgW1xuICBbMHg3NSwgMHg3NSwgMHg3NV0sXG4gIFsweDI3LCAweDFiLCAweDhmXSxcbiAgWzB4MDAsIDB4MDAsIDB4YWJdLFxuICBbMHg0NywgMHgwMCwgMHg5Zl0sXG4gIFsweDhmLCAweDAwLCAweDc3XSxcbiAgWzB4YWIsIDB4MDAsIDB4MTNdLFxuICBbMHhhNywgMHgwMCwgMHgwMF0sXG4gIFsweDdmLCAweDBiLCAweDAwXSxcbiAgWzB4NDMsIDB4MmYsIDB4MDBdLFxuICBbMHgwMCwgMHg0NywgMHgwMF0sXG4gIFsweDAwLCAweDUxLCAweDAwXSxcbiAgWzB4MDAsIDB4M2YsIDB4MTddLFxuICBbMHgxYiwgMHgzZiwgMHg1Zl0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweGJjLCAweGJjLCAweGJjXSxcbiAgWzB4MDAsIDB4NzMsIDB4ZWZdLFxuICBbMHgyMywgMHgzYiwgMHhlZl0sXG4gIFsweDgzLCAweDAwLCAweGYzXSxcbiAgWzB4YmYsIDB4MDAsIDB4YmZdLFxuICBbMHhlNywgMHgwMCwgMHg1Yl0sXG4gIFsweGRiLCAweDJiLCAweDAwXSxcbiAgWzB4Y2IsIDB4NGYsIDB4MGZdLFxuICBbMHg4YiwgMHg3MywgMHgwMF0sXG4gIFsweDAwLCAweDk3LCAweDAwXSxcbiAgWzB4MDAsIDB4YWIsIDB4MDBdLFxuICBbMHgwMCwgMHg5MywgMHgzYl0sXG4gIFsweDAwLCAweDgzLCAweDhiXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4ZmYsIDB4ZmYsIDB4ZmZdLFxuICBbMHgzZiwgMHhiZiwgMHhmZl0sXG4gIFsweDVmLCAweDczLCAweGZmXSxcbiAgWzB4YTcsIDB4OGIsIDB4ZmRdLFxuICBbMHhmNywgMHg3YiwgMHhmZl0sXG4gIFsweGZmLCAweDc3LCAweGI3XSxcbiAgWzB4ZmYsIDB4NzcsIDB4NjNdLFxuICBbMHhmZiwgMHg5YiwgMHgzYl0sXG4gIFsweGYzLCAweGJmLCAweDNmXSxcbiAgWzB4ODMsIDB4ZDMsIDB4MTNdLFxuICBbMHg0ZiwgMHhkZiwgMHg0Yl0sXG4gIFsweDU4LCAweGY4LCAweDk4XSxcbiAgWzB4MDAsIDB4ZWIsIDB4ZGJdLFxuICBbMHg3NSwgMHg3NSwgMHg3NV0sXG4gIFsweDAwLCAweDAwLCAweDAwXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHhmZiwgMHhmZiwgMHhmZl0sXG4gIFsweGFiLCAweGU3LCAweGZmXSxcbiAgWzB4YzcsIDB4ZDcsIDB4ZmZdLFxuICBbMHhkNywgMHhjYiwgMHhmZl0sXG4gIFsweGZmLCAweGM3LCAweGZmXSxcbiAgWzB4ZmYsIDB4YzcsIDB4ZGJdLFxuICBbMHhmZiwgMHhiZiwgMHhiM10sXG4gIFsweGZmLCAweGRiLCAweGFiXSxcbiAgWzB4ZmYsIDB4ZTcsIDB4YTNdLFxuICBbMHhlMywgMHhmZiwgMHhhM10sXG4gIFsweGFiLCAweGYzLCAweGJmXSxcbiAgWzB4YjMsIDB4ZmYsIDB4Y2ZdLFxuICBbMHg5ZiwgMHhmZiwgMHhmM10sXG4gIFsweGJjLCAweGJjLCAweGJjXSxcbiAgWzB4MDAsIDB4MDAsIDB4MDBdLFxuICBbMHgwMCwgMHgwMCwgMHgwMF1cbl1cbiIsImltcG9ydCBjb2xvcnMgZnJvbSAnLi9jb2xvcnMnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJlbmRlcmVyIHtcbiAgY29uc3RydWN0b3IoaWQpIHtcbiAgICBpZiAoIWlkKSB0aHJvdyBuZXcgRXJyb3IoXCJJZCBvZiBjYW52YXMgdGFnIGlzbid0IHNwZWNpZmllZC5cIilcblxuICAgIGxldCBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZClcbiAgICB0aGlzLmNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIHRoaXMucG9pbnRlciA9IDBcbiAgICB0aGlzLndpZHRoID0gMzJcbiAgICB0aGlzLmhlaWdodCA9IDMwXG4gIH1cblxuICB3cml0ZSh0aWxlLCBwYWxldHRlKSB7XG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmdlbmVyYXRlVGlsZUltYWdlKHRpbGUsIHBhbGV0dGUpXG4gICAgY29uc3QgeCA9ICh0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSAqIDhcbiAgICBjb25zdCB5ID0gKCh0aGlzLnBvaW50ZXIgLSAodGhpcy5wb2ludGVyICUgdGhpcy53aWR0aCkpIC8gdGhpcy53aWR0aCkgKiA4XG5cbiAgICBpZiAodGhpcy5wb2ludGVyIDwgdGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0IC0gMSkge1xuICAgICAgdGhpcy5wb2ludGVyKytcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wb2ludGVyID0gMFxuICAgIH1cblxuICAgIHRoaXMuY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2UsIHgsIHkpXG4gIH1cblxuICBnZW5lcmF0ZVRpbGVJbWFnZSh0aWxlLCBwYWxldHRlKSB7XG4gICAgY29uc3QgaW1hZ2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlSW1hZ2VEYXRhKDgsIDgpXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY0OyBpKyspIHtcbiAgICAgIGNvbnN0IGJpdCA9IHRpbGVbaV1cbiAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5jb2xvcihwYWxldHRlW2JpdF0pXG5cbiAgICAgIGltYWdlLmRhdGFbaSAqIDRdID0gY29sb3JbMF1cbiAgICAgIGltYWdlLmRhdGFbaSAqIDQgKyAxXSA9IGNvbG9yWzFdXG4gICAgICBpbWFnZS5kYXRhW2kgKiA0ICsgMl0gPSBjb2xvclsyXVxuICAgICAgaW1hZ2UuZGF0YVtpICogNCArIDNdID0gMjU1IC8vIOmAj+aYjuW6plxuICAgIH1cblxuICAgIHJldHVybiBpbWFnZVxuICB9XG5cbiAgY29sb3IoY29sb3JJZCkge1xuICAgIHJldHVybiBjb2xvcnNbY29sb3JJZF1cbiAgfVxufVxuIiwiaW1wb3J0IE5lc18gZnJvbSAnLi9uZXMnXG5pbXBvcnQgUm9tXyBmcm9tICcuL3JvbSdcbmltcG9ydCBSZW5kZXJlcl8gZnJvbSAnLi9yZW5kZXJlcidcblxuZXhwb3J0IGNvbnN0IE5lcyA9IE5lc19cbmV4cG9ydCBjb25zdCBSb20gPSBSb21fXG5leHBvcnQgY29uc3QgUmVuZGVyZXIgPSBSZW5kZXJlcl9cbiJdLCJuYW1lcyI6WyJVdGlsIiwiUmVnaXN0ZXJzIiwiTmVzIiwiTmVzXyIsIlJvbSIsIlJvbV8iLCJSZW5kZXJlciIsIlJlbmRlcmVyXyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0VBQWUsTUFBTSxRQUFRLENBQUM7RUFDOUIsRUFBRSxXQUFXLEdBQUc7RUFDaEIsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUk7RUFDcEIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUk7RUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUk7RUFDdkIsSUFBSSxJQUFJLENBQUMs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SUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3RDLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFDNUMsR0FBRzs7RUFFSCxFQUFFLElBQUksY0FBYyxHQUFHO0VBQ3ZCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUk7RUFDckMsR0FBRzs7RUFFSCxFQUFFLElBQUksY0FBYyxDQUFDLEdBQUcsRUFBRTtFQUMxQixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3RDLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFDNUMsR0FBRzs7RUFFSCxFQUFFLElBQUksV0FBVyxHQUFHO0VBQ3BCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUk7RUFDckMsR0FBRzs7RUFFSCxFQUFFLElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtFQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3RDLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFDNUMsR0FBRzs7RUFFSCxFQUFFLElBQUksYUFBYSxHQUFHO0VBQ3RCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUk7RUFDckMsR0FBRzs7RUFFSCxFQUFFLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRTtFQUN6QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFJO0VBQ3RDLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUM7RUFD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QyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUM7RUFDNUMsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBQztFQUMvQyxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFDO0VBQy9DLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUU7RUFDbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLE1BQUs7RUFDN0I7RUFDQTtFQUNBLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQztFQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFDO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDMUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNsRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFDO0VBQy9CLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUM7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBRztFQUNwQyxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDOztFQUV0QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQU0sR0FBRyxJQUFJLEdBQUcsS0FBSTtFQUN6RSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLE1BQU0sSUFBSSxFQUFDO0VBQy9DLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUk7RUFDeEQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0VBQ25ELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUM7O0VBRTNELElBQUksSUFBSSxNQUFNLElBQUksQ0FBQyxFQUFFO0VBQ3JCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUNwQyxLQUFLLE1BQU07RUFDWCxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLEVBQUM7RUFDcEMsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzlELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7RUFDbkQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBQzs7RUFFM0QsSUFBSSxJQUFJLE1BQU0sSUFBSSxDQUFDLEVBQUU7RUFDckIsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxFQUFDO0VBQ3BDLEtBQUssTUFBTTtFQUNYLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUNwQyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzlELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7RUFDbkQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBQzs7RUFFM0QsSUFBSSxJQUFJLE1BQU0sSUFBSSxDQUFDLEVBQUU7RUFDckIsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxFQUFDO0VBQ3BDLEtBQUssTUFBTTtFQUNYLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUNwQyxLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUM7RUFDaEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0VBQ25ELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUM7RUFDaEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBQztFQUMzRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0VBQ25ELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUM7RUFDOUQsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUM7RUFDOUQsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUM7RUFDOUQsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUM7RUFDOUQsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUMxRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2xELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDbEQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXO0VBQzVDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQzs7RUFFeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBQztFQUM1RCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVc7RUFDNUMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxFQUFDOztFQUV2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxNQUFLO0VBQzFELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxJQUFJLEVBQUM7RUFDakQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFJOztFQUUxQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxFQUFDO0VBQzVELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxJQUFJLEVBQUM7RUFDakQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFJOztFQUV6QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUc7RUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxNQUFLO0VBQzFELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBRztFQUN2QyxJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUN4QyxJQUFJLE1BQU0sS0FBSyxHQUFHLFFBQVEsR0FBRyxTQUFROztFQUVyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxJQUFJLEtBQUk7RUFDcEUsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFJLElBQUksRUFBQztFQUNoRixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUM7RUFDL0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFDOztFQUV2RSxJQUFJLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFDO0VBQ3BELElBQUksTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUM7O0VBRXBELElBQUksSUFBSSxjQUFjLEtBQUssY0FBYyxFQUFFO0VBQzNDLE1BQU0s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QUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXOztFQUVwRCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSTtFQUM5QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFXOztFQUVuRCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSTtFQUM5QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFVOztFQUVsRCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSTtFQUM5QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVU7O0VBRW5ELElBQUksSUFBSSxZQUFZLEVBQUU7RUFDdEIsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxLQUFJO0VBQzlCLEtBQUs7RUFDTCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWM7O0VBRXRELElBQUksSUFBSSxZQUFZLEVBQUU7RUFDdEIsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxLQUFJO0VBQzlCLEtBQUs7RUFDTCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBYzs7RUFFdkQsSUFBSSxJQUFJLFlBQVksRUFBRTtFQUN0QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDOUIsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFjOztFQUV2RCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSTtFQUM5QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFjOztFQUV0RCxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3RCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSTtFQUM5QixLQUFLO0VBQ0wsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxFQUFDO0VBQ2xDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUNsQyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFOztFQUVwQjtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxFQUFDO0VBQ3JDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsRUFBQztFQUNwQyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLEVBQUM7RUFDcEMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsR0FBRyxFQUFDO0VBQ3RDLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsRUFBQztFQUNsQyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQjtFQUNBLEdBQUc7RUFDSCxDQUFDOztFQ2xoQmMsTUFBTUEsTUFBSSxDQUFDO0VBQzFCLEVBQUUsT0FBTyxXQUFXLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFO0VBQ3BFLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBRztFQUNwQixJQUFJLElBQUksTUFBSzs7RUFFYixJQUFJLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxpQkFBaUIsRUFBRTtFQUMvQyxNQUFNLE1BQU0sR0FBRyxLQUFJO0VBQ25CLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNuQyxLQUFLLE1BQU0sSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLGVBQWUsRUFBRTtFQUNwRCxNQUFNLE1BQU0sR0FBRyxHQUFFO0VBQ2pCLE1BQU0sS0FBSyxHQUFHLEdBQUU7RUFDaEIsS0FBSyxNQUFNO0VBQ1gsTUFBTSxLQUFLLEdBQUcsT0FBTTtFQUNwQixLQUFLOztFQUVMLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7RUFDL0MsTUFBTSxLQUFLLEdBQUcsR0FBRTtFQUNoQixLQUFLLE1BQU07RUFDWCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBQztFQUNoQyxLQUFLOztFQUVMLElBQUksTUFBTSxjQUFjLEdBQUcsTUFBTSxHQUFHLE1BQUs7RUFDekMsSUFBSSxNQUFNLEtBQUssR0FBRztFQUNsQixNQUFNLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO0VBQy9CLE1BQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ3BDLE1BQU0sVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ25DLE1BQU0sY0FBYztFQUNwQixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFO0VBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDOztFQUVmO0VBQ0EsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQztFQUN0QixHQUFHOztFQUVILEVBQUUsT0FBTyxPQUFPLENBQUMsZUFBZSxFQUFFLGNBQWMsRUFBRTtFQUNsRCxJQUFJLElBQUksYUFBWTtFQUNwQixJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtFQUN0QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFDO0VBQzFDLEtBQUs7O0VBRUwsSUFBSSxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUM1RCxJQUFJLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxJQUFJLEdBQUU7O0VBRWxDLElBQUksTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFDOztFQUV0RSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtFQUN0QixNQUFNQSxNQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFDO0VBQzlFLEtBQUs7O0VBRUwsSUFBSSxXQUFXLENBQUMsSUFBSSxHQUFFO0VBQ3RCLEdBQUc7RUFDSCxDQUFDOztFQ3BERDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQzlCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQ3hCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFDO0VBQ25ELEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQ2pDRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQ3hCRDtBQUNBLFlBQWU7RUFDZixFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxDQUFDOztFQzlCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQ3JCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQzNCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxDQUFDOztFQ3hCRDtBQUNBLFlBQWU7RUFDZixFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxDQUFDOztFQ3ZDRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQzNCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixDQUFDOztFQ3ZDRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxDQUFDOztFQzlCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQzlCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxDQUFDOztFQ3hCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFDO0VBQy9DLEdBQUc7RUFDSDtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDO0VBQzdDLEdBQUc7RUFDSCxFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixFQUFFLEVBQUU7RUFDSixDQUFDOztFQzlCRDtBQUNBLFlBQWU7RUFDZjtFQUNBLEVBQUUsV0FBVztFQUNiLElBQUlBLE1BQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFDO0VBQzlDLEdBQUc7RUFDSCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxFQUFFLEdBQUc7RUFDTCxF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QUFLLEtBQUs7RUFDOUIsR0FBRztFQUNILENBQUM7O0FDcEVELGVBQWU7RUFDZixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEIsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwQixFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJ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
