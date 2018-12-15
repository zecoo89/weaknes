(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.NesPack = {})));
}(this, (function (exports) { 'use strict';

  var registers = {
    /* ステータス・レジスタ
     * ステータスレジスタの詳細です。bit5は常に1で、bit3はNESでは未実装です。
     IRQは割り込み、BRKはソフトウエア割り込みです。

     bit7	N	ネガティブ	演算結果のbit7が1の時にセット
     bit6	V	オーバーフロー	P演算結果がオーバーフローを起こした時にセット
     bit5	R	予約済み	常にセットされている
     bit4	B	ブレークモード	BRK発生時にセット、IRQ発生時にクリア
     bit3	D	デシマルモード	0:デフォルト、1:BCDモード (未実装)
     bit2	I	IRQ禁止	0:IRQ許可、1:IRQ禁止
     bit1	Z	ゼロ	演算結果が0の時にセット
     bit0	C	キャリー	キャリー発生時にセット
     */

    acc: 0x00, // アキュムレータ：汎用演算
    indexX: 0x00, // インデックスレジスタ：アドレッシング、カウンタ等
    indexY: 0x00, // 上に同じ
    sp: 0x01FD, // スタックポインタ
    status: { // ステータスレジスタ：CPUの各種状態を保持する
      negative_:  0,
      overflow_:  0,
      reserved_:  1,
      break_:     1, // 割り込みBRK発生時にtrue,IRQ発生時にfalse
      decimal_:   0,
      interrupt_: 1,
      zero_:      0,
      carry_:     0,
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
      if(addr >= 0x2000 && addr <= 0x2007) {
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

  /* 0x70 - 0x7F */
  var x0x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var x1x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var x2x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var x3x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
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

      const addr = lowAddr | highAddr << 8;

      return addr & 0xffff
    },

    absoluteX: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | highAddr << 8) + this.registers.indexX;

      return addr & 0xffff
    },

    absoluteY: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr = (lowAddr | highAddr << 8) + this.registers.indexY;

      return addr & 0xffff
    },

    indirect: function() {
      const lowAddr_ = this.registers.pc++;
      const lowAddr = this.ram.read(lowAddr_);

      const highAddr_ = this.registers.pc++;
      const highAddr = this.ram.read(highAddr_);

      const addr_ = lowAddr | highAddr << 8;
  		const addr = this.ram.read(addr_) | this.ram.read(addr_+1) << 8;

      return addr & 0xffff
    },

    indexIndirect: function() {
      const addr__ = this.registers.pc++;
      let addr_ = this.ram.read(addr__) + this.registers.indexX;
      addr_ = addr_ & 0x00ff;

      const addr = this.ram.read(addr_) | this.ram.read(addr_+1) << 8;

      return addr & 0xffff
  	},

    indirectIndex: function() {
      const addr__ = this.registers.pc++;
      const addr_ = this.ram.read(addr__);

      let addr = this.ram.read(addr_) | this.ram.read(addr_+1) << 8;
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

      let addr = signedNumber >= 0x80 ? this.registers.pc + signedNumber - 0x100 : this.registers.pc + signedNumber;

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
      return addr
    },

    /* Aとメモリを比較演算してフラグを操作
     * 演算結果は捨てる
     * A == mem -> Z = 0
     * A >= mem -> C = 1
     * A <= mem -> C = 0
     * */
    CMP: function(addr) {
      return addr
    },

    /* Xとメモリを比較演算 */
    CPX: function() {

    },

    /* Yとメモリを比較演算*/
    CPY: function() {

    },

    /* *をインクリメントする
     * フラグ
     *   - negative_
     *   - zero_
     * */
    /* メモリをインクリメントする*/
    INC: function(addr) {
      this.ram.write(addr, this.ram.read(addr)+1);
      const value = this.ram.read(addr);
      this.registers.status.negative_ = Util.isNegative(value);
      this.registers.status.zero_ = Util.isZero(value);
    },

    /* メモリをデクリメント */
    DEC: function(addr) {
      this.ram.write(addr, this.ram.read(addr)-1);
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
      this.ram.write(addr, this.ram.read(addr) << 1 | carry_);
    },

    /* accを左へローテートする
     * 実装を考えて、accの場合をROLと分離した
     * */
    RLA: function() {
      const carry_ = this.registers.status.carry_;
      const msb = this.registers.acc >> 7;

      this.registers.status.carry_ = msb;
      this.registers.acc = this.registers.acc << 1 | carry_;
    },

    /* メモリを右へローテートする */
    ROR: function(addr) {
      const carry_ = this.registers.status.carry_ << 7;
      const lsb = this.ram.read(addr) & 0x01;

      this.registers.status.carry_ = lsb;
      this.ram.write(addr, this.ram.read(addr) >> 1 | carry_);
    },

    /* accを右へローテートする
     * 実装を考えてaccの場合をRORと分離した
     * */
    RRA: function() {
      const carry_ = this.registers.status.carry_ << 7;
      const lsb = this.registers.acc & 0x01;

      this.registers.status.carry_ = lsb;
      this.registers.acc = this.registers.acc >> 1 | carry_;
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
    PHA: function() {

    },

    /* Pをスタックにプッシュ */
    PHP: function() {

    },

    /* スタックからAにポップアップする */
    PLA: function() {

    },

    /* スタックからPにポップアップする */
    PLP: function() {

    },

    /* アドレスへジャンプする */
    JMP: function(addr) {
      this.registers.pc = addr;
    },

    /* サブルーチンを呼び出す */
    JSR: function() {

    },

    /* サブルーチンから復帰する */
    RTS: function() {

    },

    /* 割り込みルーチンから復帰する */
    RTI: function() {

    },

    /* キャリーフラグがクリアされているときにブランチする */
    BCC: function() {

    },

    /* キャリーフラグがセットされているときにブランチする */
    BCS: function() {

    },

    /* ゼロフラグがセットされているときにブランチする */
    BEQ: function() {

    },

    /* ネガティブフラグがセットされているときにブランチする */
    BMI: function() {

    },

    /* ゼロフラグがクリアされているときにブランチする*/
    BNE: function(addr) {
      const isBranchable = !this.registers.status.zero_;

      if(isBranchable) {
        this.registers.pc = addr;
      }
    },

    /* ネガティブフラグがクリアされているときにブランチする */
    BPL: function() {

    },

    /* オーバーフローフラグがクリアされているときにブランチする*/
    BVC: function () {

    },

    /* オーバーフローフラグがセットされているときにブランチする */
    BVS: function() {

    },

    /* キャリーフラグをクリアします */
    CLC: function() {

    },

    /* BCDモードから通常モードに戻る NESには実装されていない */
    CLD: function() {

    },

    /* IRQ割り込みを許可する */
    CLI: function() {

    },

    /* オーバーフローフラグをクリアする */
    CLV: function() {

    },

    /* キャリーフラグをセットする */
    SEC: function() {

    },

    /* BCDモードに設定する NESには実装されていない */
    SED: function() {

    },

    /* IRQ割り込みを禁止する
     * フラグ
     * interrupt_ : 1にセットする
     * */
    SEI: function() {
      this.registers.status.interrupt_ = 1;
    },

    /* ソフトウェア割り込みを起こす*/
    BRK: function() {

    },

    /* 空の命令を実行する */
    NOP: function() {

    }
  };

  class Util$1 {
    static debugString(instruction, addressing, value_) {
      let prefix = '$';
      let postfix = '';

      if(!addressing) {
        prefix = '';
      } else if(addressing.name === 'bound immediate') {
        prefix = '#$';
      }

      let value;
      if(value_ === undefined) {
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

  /* 0x40 - 0x4F */
  var x4x = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b',
    /* 0x4c: JMP Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);
      const addr = absolute();

      const JMP = Instructions.JMP.bind(this);
      JMP(addr);

      return Util$1.debugString(JMP, absolute, addr)
    },
    'd', 'e', 'f',
  ];

  /* 0x70 - 0x7F */
  var x5x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var x6x = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var x7x = [
    '0', '1', '2', '3', '4', '5', '6', '7',
    /* 0x78: SEI */
    function() {
      const SEI = Instructions.SEI.bind(this);

      SEI();

      return Util$1.debugString(SEI)
    }, '9', 'a', 'b', 'c', 'd', 'e', 'f'
  ];

  /* 0x80 - 0x8F */
  var x8x = [
    '0', '1', '2', '3', '4', '5', '6', '7',
    /* 0x88: DEY */
    function() {
      const DEY = Instructions.DEY.bind(this);

      DEY();

      return Util$1.debugString(DEY)
    }, '9', 'a', 'b', 'c',
    /* 0x8d: STA Absolute */
    function() {
      const absolute = Addressing.absolute.bind(this);

      const addr = absolute();
      const STA = Instructions.STA.bind(this);

      STA(addr);

      return Util$1.debugString(STA, absolute, addr)
    }, 'e', 'f'
  ];

  //import Addressing from '../addressing'

  /* 0x90 - 0x9F */
  var x9x = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    /* 9A: TXS Implied*/
    function() {
      const TXS = Instructions.TXS.bind(this);
      TXS();

      return Util$1.debugString(TXS)
    },
    '', '', '', '', '',
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
    }
    , '1',
    /* 0xA2: LDX Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDX = Instructions.LDX.bind(this);
      LDX(addr);

      return Util$1.debugString(LDX, immediate, this.ram.read(addr))
    }, '3', '4', '5', '6', '7', '8',

    /* 0xA9: LDA Immediate */
    function() {
      const immediate = Addressing.immediate.bind(this);
      const addr = immediate();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, immediate, this.ram.read(addr))
    }, '', '', '', '', '', '',
  ];

  /* 0xb0 - 0xbF */
  var xBx = [
    '0', '1', '2', '3', '4', '5', '6', '7',
    '8', '9', 'a', 'b', 'c',
    /* 0xbd: LDA Absolutem X */
    function() {
      const absoluteX = Addressing.absoluteX.bind(this);
      const addr = absoluteX();

      const LDA = Instructions.LDA.bind(this);
      LDA(addr);

      return Util$1.debugString(LDA, absoluteX, addr)
    }
    , 'e', 'f'
  ];

  /* 0x70 - 0x7F */
  var xCx = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
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
    }, '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  //import Addressing from '../addressing'

  /* 0xe0 - 0xeF */
  var xEx = [
    '0', '1', '2', '3', '4', '5', '6', '7',
    /* 0xe8: INX */
    function() {
      const INX = Instructions.INX.bind(this);

      INX();

      return Util$1.debugString(INX)
    }, '', '', '', '', '', '', '',
  ];

  /* 0x70 - 0x7F */
  var xFx = [
    '', '', '', '', '', '', '', 'SEI', '', '', '', '', '', '', '', '',
  ];

  const opcodes = [].concat(
    x0x, x1x, x2x, x3x,
    x4x, x5x, x6x, x7x,
    x8x, x9x, xAx, xBx,
    xCx, xDx, xEx, xFx
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

      /* About memory
       * 0x0000 - 0x07ff : WRAM
       * 0x0800 - 0x1fff : Mirror of WRAM
       * 0x2000 - 0x2007 : PPU registers
       * 0x2008 - 0x3fff : Mirror of PPU registers
       * 0x4000 - 0x401f : APU I/O, PAD?
       * 0x4020 - 0x5fff : ROM Extension
       * 0x6000 - 0x7fff : RAM Extension
       * 0x8000 - 0xbfff : Program ROM
       * 0xc000 - 0xffff : Program ROM
       * */
      //this.memory = new Uint8Array(0x10000) //256を超えるとオーバーフローする（してくれる）
      this.ram = new Ram();
    }

    connect(parts) {
      parts.bus && this.ram.connect(parts);
    }

    reset() {
      //TODO プログラムカウンタ等の値は今のところ仮なので見直す
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

      if(typeof this.opcodes[opcode] !== 'function') {
        console.error('Not implemented: ' + opcode.toString(16));
        console.error(this.opcodes[opcode]);
      }

      const debugString = this.opcodes[opcode].bind(this).call();
      console.log(debugString);
    }

    /* 0x8000~のメモリにROM内のPRG-ROMを読み込む*/
    set prgRom(prgRom) {
      const startAddr = 0x8000;

      for(let i = 0;i < prgRom.length;i++) {
        //this.memory[startAddr+i] = prgRom[i]
        this.ram.write(startAddr+i, prgRom[i]);
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
      if(parts.bus) {
        parts.bus.connect({ vram: this.vram });
      }

      if(parts.renderer){
        this.renderer = parts.renderer;
        this.vram.connect(this);
      }
    }

    /* $2000 - $23BFのネームテーブルを更新する */
    refreshDisplay() {
      /* タイル(8x8)を32*30個 */
      for(let i = 0x2000;i <= 0x23bf;i++) {
        const tileId = this.vram.read(i);
        /* タイルを指定 */
        const tile = this.tiles[tileId];
        /* タイルが使用するパレットを取得 */
        const paletteId = this.selectPalette(tileId);
        const palette = this.selectBackgroundPalettes(paletteId);


        //console.log('id:' + paletteId)
        //console.log('palette:' + palette)
        /* タイルとパレットをRendererに渡す */
        this.renderer.write(tile, palette);
      }
    }

    /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
    set chrRom(chrRom) {
      for(let i=0;i<chrRom.length;i++) {
        this.vram.write(i, chrRom[i]);
      }

      /* CHR領域からタイルを抽出しておく */
      this.extractTiles();
    }

    // 8x8のタイルをすべてvramのCHRから抽出しておく
    extractTiles() {
      this.tiles = [];
      for(let i=0;i<0x1fff;) {
        // タイルの下位ビット
        const lowerBitLines = [];
        for(let h=0;h<8;h++) {
          let byte = this.vram.read(i++);
          const line = [];
          for(let j=0;j<8;j++) {
            const bit = byte & 0x01;
            line.unshift(bit);
            byte = byte >> 1;
          }

          lowerBitLines.push(line);
        }

        // タイルの上位ビット
        const higherBitLines = [];
        for(let h=0;h<8;h++) {
          let byte = this.vram.read(i++);
          const line = [];
          for(let j=0;j<8;j++) {
            const bit = byte & 0x01;
            line.unshift(bit << 1);
            byte = byte >> 1;
          }

          higherBitLines.push(line);
        }

        // 上位ビットと下位ビットを合成する
        const perfectBits = [];
        for(let h=0;h<8;h++) {
          for(let j=0;j<8;j++) {
            const perfectBit = lowerBitLines[h][j] | higherBitLines[h][j];
            perfectBits.push(perfectBit);
          }
        }
        this.tiles.push(perfectBits);
      }
    }

    /* 属性テーブル */
    selectPalette(n) {
      const blockPosition = (n - n % 64) / 64 * 8 + ((n % 64) - (n % 4)) / 4;
      const bitPosition = n % 4;
      const start = 0x23c0;

      const block = this.vram.read(start + blockPosition);
      const bit = (block >> bitPosition) & 0x03;

      return bit
    }

    /* $3F00-$3F0Fのバックグラウンド(背景)パレットテーブルを */
    selectBackgroundPalettes(number) {
      const palette = [];

      const start = 0x3f00 + number * 4;
      const end = 0x3f00 + number * 4 + 4;
      for(let i=start;i<end;i++) {
        palette.push(this.vram.read(i));
      }

      return palette
    }

    /* $3F10-$3F1F	スプライトパレットテーブル*/
    selectSpritePaletts(number) {
      const palette = [];

      const start = 0x3f10 + number * 4;
      const end = 0x3f10 + number * 4 + 4;
      for(let i=start;i<end;i++) {
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
      switch(addr) {
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
      switch(addr) {
        case 0x2006:
          return this.vramAddr
        default:
          throw new Error('The bus of this addr is Not implemented')
      }
    }

    set vramAddr(addr) {
      if(this.vramAddr_.length < 1) {
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
      if(!this.isNesRom(data)) throw new Error('This is not NES ROM.')
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
  	** サイズはROMヘッダの1から数えて5Byte目の値に16Ki(キビ)をかけたサイズ
     * https://wiki.nesdev.com/w/index.php/INES#iNES_file_format */
    get SIZE_OF_PRG_ROM() {
      return this.data[4] * 0x4000 // 0x4000 = 16Ki
    }

  	/* PRG ROMに同じ*/
    get SIZE_OF_CHR_ROM() {
      return this.data[5] * 0x2000 // 0x2000 = 8Ki
    }

  	/* ROMからprgROMに該当するところを切り出す
  	** prgROMはヘッダ領域の次のByteから始まる
  	*/
    get prgRom() {
      return this.data.slice(this.NES_ROM_HEADER_SIZE, this.START_ADDRESS_OF_CHR_ROM - 1)
    }
  	/* prgRomに同じ
  	** chrRomはprgRomの後から始まる
  	*/
    get chrRom() {
      return this.data.slice(this.START_ADDRESS_OF_CHR_ROM, this.END_ADDRESS_OF_CHR_ROM - 1)
    }

    /* データのヘッダに'NES'があるかどうかでNESのROMか判別する */
    isNesRom(data) {
      const header = data.slice(0, 3);
      const headerStr = String.fromCharCode.apply(null, header);

      return headerStr === 'NES'
    }

  }

  class Renderer {
    constructor(id) {
      let canvas = document.getElementById(id);
      this.context = canvas.getContext('2d');
      this.pointer = 0;
      this.width = 32;
      this.height = 30;
    }

    write(tile, palette) {
      const image = this.generateTileImage(tile, palette);
      const x = (this.pointer % this.width) * 8;
      const y = (this.pointer - this.pointer % this.width) / this.width * 8;

      if(this.pointer < this.width * this.height - 1) {
        this.pointer++;
      } else {
        this.pointer = 0;
      }

      this.context.putImageData(image, x, y);
    }

    generateTileImage(tile ,palette) {
      const image = this.context.createImageData(8, 8);

      for(let i=0;i<64;i++) {
        const bit = tile[i];
        const color = this.color(palette[bit]);

        image.data[i*4] = color[0];
        image.data[i*4+1] = color[1];
        image.data[i*4+2] = color[2];
        image.data[i*4+3] = 255; // 透明度
      }

      return image
    }

    color(colorId) {
      return [
        [0x75, 0x75, 0x75], [0x27, 0x1b, 0x8f], [0x00, 0x00, 0xab], [0x47, 0x00, 0x9f],
        [0x8f, 0x00, 0x77], [0xab, 0x00, 0x13], [0xa7, 0x00, 0x00], [0x7f, 0x0b, 0x00],
        [0x43, 0x2f, 0x00], [0x00, 0x47, 0x00], [0x00, 0x51, 0x00], [0x00, 0x3f, 0x17],
        [0x1b, 0x3f, 0x5f], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
        [0xbc, 0xbc, 0xbc], [0x00, 0x73, 0xef], [0x23, 0x3b, 0xef], [0x83, 0x00, 0xf3],
        [0xbf, 0x00, 0xbf], [0xe7, 0x00, 0x5b], [0xdb, 0x2b, 0x00], [0xcb, 0x4f, 0x0f],
        [0x8b, 0x73, 0x00], [0x00, 0x97, 0x00], [0x00, 0xab, 0x00], [0x00, 0x93, 0x3b],
        [0x00, 0x83, 0x8b], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff], [0x3f, 0xbf, 0xff], [0x5f, 0x73, 0xff], [0xa7, 0x8b, 0xfd],
        [0xf7, 0x7b, 0xff], [0xff, 0x77, 0xb7], [0xff, 0x77, 0x63], [0xff, 0x9b, 0x3b],
        [0xf3, 0xbf, 0x3f], [0x83, 0xd3, 0x13], [0x4f, 0xdf, 0x4b], [0x58, 0xf8, 0x98],
        [0x00, 0xeb, 0xdb], [0x75, 0x75, 0x75], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff], [0xab, 0xe7, 0xff], [0xc7, 0xd7, 0xff], [0xd7, 0xcb, 0xff],
        [0xff, 0xc7, 0xff], [0xff, 0xc7, 0xdb], [0xff, 0xbf, 0xb3], [0xff, 0xdb, 0xab],
        [0xff, 0xe7, 0xa3], [0xe3, 0xff, 0xa3], [0xab, 0xf3, 0xbf], [0xb3, 0xff, 0xcf],
        [0x9f, 0xff, 0xf3], [0xbc, 0xbc, 0xbc], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00]
      ][colorId]
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY3B1L3JlZ2lzdGVycy5qcyIsIi4uL3NyYy9jcHUvcmFtLmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4MHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHgxeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDJ4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4M3guanMiLCIuLi9zcmMvY3B1L2FkZHJlc3NpbmcvaW5kZXguanMiLCIuLi9zcmMvY3B1L2luc3RydWN0aW9ucy91dGlsLmpzIiwiLi4vc3JjL2NwdS9pbnN0cnVjdGlvbnMvaW5kZXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvdXRpbC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDR4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4NXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg2eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weDd4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4OHguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHg5eC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weEF4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4QnguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhDeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy8weER4LmpzIiwiLi4vc3JjL2NwdS9vcGNvZGVzLzB4RXguanMiLCIuLi9zcmMvY3B1L29wY29kZXMvMHhGeC5qcyIsIi4uL3NyYy9jcHUvb3Bjb2Rlcy9pbmRleC5qcyIsIi4uL3NyYy9jcHUvY3B1LmpzIiwiLi4vc3JjL3BwdS92cmFtLmpzIiwiLi4vc3JjL3BwdS9wcHUuanMiLCIuLi9zcmMvYnVzL2luZGV4LmpzIiwiLi4vc3JjL25lcy5qcyIsIi4uL3NyYy9yb20vaW5kZXguanMiLCIuLi9zcmMvcmVuZGVyZXIvaW5kZXguanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQge1xuICAvKiDjgrnjg4bjg7zjgr/jgrnjg7vjg6zjgrjjgrnjgr9cbiAgICog44K544OG44O844K/44K544Os44K444K544K/44Gu6Kmz57Sw44Gn44GZ44CCYml0NeOBr+W4uOOBqzHjgafjgIFiaXQz44GvTkVT44Gn44Gv5pyq5a6f6KOF44Gn44GZ44CCXG4gICBJUlHjga/libLjgorovrzjgb/jgIFCUkvjga/jgr3jg5Xjg4jjgqbjgqjjgqLlibLjgorovrzjgb/jgafjgZnjgIJcblxuICAgYml0N1x0Tlx044ON44Ks44OG44Kj44OWXHTmvJTnrpfntZDmnpzjga5iaXQ344GMMeOBruaZguOBq+OCu+ODg+ODiFxuICAgYml0Nlx0Vlx044Kq44O844OQ44O844OV44Ot44O8XHRQ5ryU566X57WQ5p6c44GM44Kq44O844OQ44O844OV44Ot44O844KS6LW344GT44GX44Gf5pmC44Gr44K744OD44OIXG4gICBiaXQ1XHRSXHTkuojntITmuIjjgb9cdOW4uOOBq+OCu+ODg+ODiOOBleOCjOOBpuOBhOOCi1xuICAgYml0NFx0Qlx044OW44Os44O844Kv44Oi44O844OJXHRCUkvnmbrnlJ/mmYLjgavjgrvjg4Pjg4jjgIFJUlHnmbrnlJ/mmYLjgavjgq/jg6rjgqJcbiAgIGJpdDNcdERcdOODh+OCt+ODnuODq+ODouODvOODiVx0MDrjg4fjg5Xjgqnjg6vjg4jjgIExOkJDROODouODvOODiSAo5pyq5a6f6KOFKVxuICAgYml0Mlx0SVx0SVJR56aB5q2iXHQwOklSUeioseWPr+OAgTE6SVJR56aB5q2iXG4gICBiaXQxXHRaXHTjgrzjg61cdOa8lOeul+e1kOaenOOBjDDjga7mmYLjgavjgrvjg4Pjg4hcbiAgIGJpdDBcdENcdOOCreODo+ODquODvFx044Kt44Oj44Oq44O855m655Sf5pmC44Gr44K744OD44OIXG4gICAqL1xuXG4gIGFjYzogMHgwMCwgLy8g44Ki44Kt44Ol44Og44Os44O844K/77ya5rGO55So5ryU566XXG4gIGluZGV4WDogMHgwMCwgLy8g44Kk44Oz44OH44OD44Kv44K544Os44K444K544K/77ya44Ki44OJ44Os44OD44K344Oz44Kw44CB44Kr44Km44Oz44K/562JXG4gIGluZGV4WTogMHgwMCwgLy8g5LiK44Gr5ZCM44GYXG4gIHNwOiAweDAxRkQsIC8vIOOCueOCv+ODg+OCr+ODneOCpOODs+OCv1xuICBzdGF0dXM6IHsgLy8g44K544OG44O844K/44K544Os44K444K544K/77yaQ1BV44Gu5ZCE56iu54q25oWL44KS5L+d5oyB44GZ44KLXG4gICAgbmVnYXRpdmVfOiAgMCxcbiAgICBvdmVyZmxvd186ICAwLFxuICAgIHJlc2VydmVkXzogIDEsXG4gICAgYnJlYWtfOiAgICAgMSwgLy8g5Ymy44KK6L6844G/QlJL55m655Sf5pmC44GrdHJ1ZSxJUlHnmbrnlJ/mmYLjgatmYWxzZVxuICAgIGRlY2ltYWxfOiAgIDAsXG4gICAgaW50ZXJydXB0XzogMSxcbiAgICB6ZXJvXzogICAgICAwLFxuICAgIGNhcnJ5XzogICAgIDAsXG4gIH0sXG4gIHBjOiAweDgwMDAgLy8g44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBSYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4MTAwMDApXG4gIH1cblxuICAvKiBNZW1vcnkgbWFwcGVkIEkvT+OBp+OBguOCi+OBn+OCge+8jOODkOOCuShCdXMp44KS5o6l57aa44GX44Gm44GK44GPXG4gICAqIFBQVeetieOBuOOBr0J1c+OCkumAmuOBl+OBpuODh+ODvOOCv+OBruOChOOCiuWPluOCiuOCkuihjOOBhlxuICAgKiAqL1xuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmICh0aGlzLmJ1cyA9IHBhcnRzLmJ1cylcbiAgfVxuXG4gIC8qVE9ETyDlkITjg53jg7zjg4goYWRkcinjgavjgqLjgq/jgrvjgrnjgYzjgYLjgaPjgZ/loLTlkIjjgavjga/jg5Djgrnjgavmm7jjgY3ovrzjgoAgKi9cbiAgd3JpdGUoYWRkciwgdmFsdWUpIHtcbiAgICBpZihhZGRyID49IDB4MjAwMCAmJiBhZGRyIDw9IDB4MjAwNykge1xuICAgICAgdGhpcy5idXMud3JpdGUoYWRkciwgdmFsdWUpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyDpgJrluLjjga7jg6Hjg6Ljg6rjgqLjgq/jgrvjgrlcbiAgICB0aGlzLm1lbW9yeVthZGRyXSA9IHZhbHVlXG4gIH1cblxuICAvKlRPRE8g44Kz44Oz44OI44Ot44O844Op55So44Gu44Od44O844OIICovXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCIvKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ1NFSScsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJyxcbl1cbiIsIi8qIDB4NzAgLSAweDdGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnU0VJJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLFxuXVxuIiwiLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICdTRUknLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCIvKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ1NFSScsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJyxcbl1cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLyogOGJpdOOBruWNs+WApOOBquOBruOBp+OCouODieODrOOCueOCkuOBneOBruOBvuOBvui/lOOBmSAqL1xuICBpbW1lZGlhdGU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgcmV0dXJuIGFkZHJcbiAgfSxcblxuICAvKiDjgqLjg4njg6zjgrlhZGRyKDhiaXQp44KS6L+U44GZICovXG4gIHplcm9wYWdlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXylcbiAgICByZXR1cm4gYWRkclxuICB9LFxuXG4gIC8qICjjgqLjg4njg6zjgrlhZGRyICsg44Os44K444K544K/aW5kZXhYKSg4Yml0KeOCkui/lOOBmSAqL1xuICB6ZXJvcGFnZVg6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKSArIHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHJldHVybiBhZGRyICYgMHhmZlxuICB9LFxuXG4gIC8qIOS4iuOBqOWQjOOBmOOBp2luZGV4WeOBq+abv+OBiOOCi+OBoOOBkSovXG4gIHplcm9wYWdlWTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl8gPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgY29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pICsgdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgcmV0dXJuIGFkZHIgJiAweGZmXG4gIH0sXG5cbiAgLyogemVyb3BhZ2Xjga5hZGRy44GMMTZiaXTniYggKi9cbiAgYWJzb2x1dGU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKVxuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZChoaWdoQWRkcl8pXG5cbiAgICBjb25zdCBhZGRyID0gbG93QWRkciB8IGhpZ2hBZGRyIDw8IDhcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgaGlnaEFkZHIgPDwgOCkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgYWJzb2x1dGVZOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBsb3dBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBsb3dBZGRyID0gdGhpcy5yYW0ucmVhZChsb3dBZGRyXylcblxuICAgIGNvbnN0IGhpZ2hBZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBoaWdoQWRkciA9IHRoaXMucmFtLnJlYWQoaGlnaEFkZHJfKVxuXG4gICAgY29uc3QgYWRkciA9IChsb3dBZGRyIHwgaGlnaEFkZHIgPDwgOCkgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgaW5kaXJlY3Q6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGxvd0FkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGxvd0FkZHIgPSB0aGlzLnJhbS5yZWFkKGxvd0FkZHJfKVxuXG4gICAgY29uc3QgaGlnaEFkZHJfID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGhpZ2hBZGRyID0gdGhpcy5yYW0ucmVhZChoaWdoQWRkcl8pXG5cbiAgICBjb25zdCBhZGRyXyA9IGxvd0FkZHIgfCBoaWdoQWRkciA8PCA4XG5cdFx0Y29uc3QgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgdGhpcy5yYW0ucmVhZChhZGRyXysxKSA8PCA4XG5cbiAgICByZXR1cm4gYWRkciAmIDB4ZmZmZlxuICB9LFxuXG4gIGluZGV4SW5kaXJlY3Q6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFkZHJfXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBsZXQgYWRkcl8gPSB0aGlzLnJhbS5yZWFkKGFkZHJfXykgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICBhZGRyXyA9IGFkZHJfICYgMHgwMGZmXG5cbiAgICBjb25zdCBhZGRyID0gdGhpcy5yYW0ucmVhZChhZGRyXykgfCB0aGlzLnJhbS5yZWFkKGFkZHJfKzEpIDw8IDhcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG5cdH0sXG5cbiAgaW5kaXJlY3RJbmRleDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWRkcl9fID0gdGhpcy5yZWdpc3RlcnMucGMrK1xuICAgIGNvbnN0IGFkZHJfID0gdGhpcy5yYW0ucmVhZChhZGRyX18pXG5cbiAgICBsZXQgYWRkciA9IHRoaXMucmFtLnJlYWQoYWRkcl8pIHwgdGhpcy5yYW0ucmVhZChhZGRyXysxKSA8PCA4XG4gICAgYWRkciA9IGFkZHIgKyB0aGlzLnJlZ2lzdGVycy5pbmRleFlcblxuICAgIHJldHVybiBhZGRyICYgMHhmZmZmXG4gIH0sXG5cbiAgLyogKOODl+ODreOCsOODqeODoOOCq+OCpuODs+OCvyArIOOCquODleOCu+ODg+ODiCnjgpLov5TjgZnjgIJcbiAgICog44Kq44OV44K744OD44OI44Gu6KiI566X44Gn44Gv56ym5Y+35LuY44GN44Gu5YCk44GM5L2/55So44GV44KM44KL44CCXG4gICAqIOespuWPt+S7mOOBjeOBruWApOOBr1xuICAgKiAgIC0xMjgoMHg4MCkgfiAtMSAoMHhmZilcbiAgICogICAwKDB4MDApIH4gMTI3KDB4N2YpXG4gICAqICovXG4gIHJlbGF0aXZlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhZGRyXyA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICBjb25zdCBzaWduZWROdW1iZXIgPSB0aGlzLnJhbS5yZWFkKGFkZHJfKVxuXG4gICAgbGV0IGFkZHIgPSBzaWduZWROdW1iZXIgPj0gMHg4MCA/IHRoaXMucmVnaXN0ZXJzLnBjICsgc2lnbmVkTnVtYmVyIC0gMHgxMDAgOiB0aGlzLnJlZ2lzdGVycy5wYyArIHNpZ25lZE51bWJlclxuXG4gICAgcmV0dXJuIGFkZHJcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBpc05lZ2F0aXZlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID4+IDdcbiAgfVxuXG4gIHN0YXRpYyBpc1plcm8odmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDB4MDAgJiAxXG4gIH1cblxuICBzdGF0aWMgbXNiKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID4+IDdcbiAgfVxuXG4gIHN0YXRpYyBsc2IodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgJiAweDAxXG4gIH1cbn1cbiIsImltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuZXhwb3J0IGRlZmF1bHQge1xuICAvKiBMRCogKExvYWQgbWVtb3J5W2FkZHIpIHRvICogcmVnaXN0ZXIpXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfIDog6KiI566X57WQ5p6c44GM6LKg44Gu5YCk44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDAoYWNj44GuN2JpdOebruOBqOWQjOOBmOWApOOBq+OBquOCiylcbiAgICogICAtIHplcm9fIDog6KiI566X57WQ5p6c44GM44K844Ot44Gu44Go44GNMeOBneOBhuOBp+OBquOBkeOCjOOBsDBcbiAgICogKi9cbiAgTERBOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuICAvKiDjg6zjgrjjgrnjgr9pbmRleFjjgatkYXRh44KS44Ot44O844OJ44GZ44KLICovXG4gIExEWDogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBMRFk6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkgPSB2YWx1ZVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogU1QqIChTdG9yZSBtZW1vcnlbYWRkcikgdG8gKiByZWdpc3RlcilcbiAgICog44OV44Op44Kw5pON5L2c44Gv54Sh44GXXG4gICAqICovXG4gIFNUQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmVnaXN0ZXJzLmFjYylcbiAgfSxcblxuICBTVFg6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJlZ2lzdGVycy5pbmRleFgpXG4gIH0sXG5cbiAgU1RZOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yZWdpc3RlcnMuaW5kZXhZKVxuICB9LFxuXG4gIC8qIFQqKiAoVHJhbnNmZXIgKiByZWdpc3RlciB0byAqIHJlZ2lzdGVyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gemVyb19cbiAgICogKi9cbiAgVEFYOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmFjY1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUQVk6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuYWNjXG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRTWDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5zcFxuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUWEE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhYXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIFRYUzogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zcCA9IHZhbHVlXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICBUWUE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIGFjYyAmIG1lbW9yeVthZGRyKVxuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gemVyb19cbiAgICogKi9cbiAgQU5EOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5hY2MgJiB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdmFsdWVcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIEHjgb7jgZ/jga/jg6Hjg6Ljg6rjgpLlt6bjgbjjgrfjg5Xjg4hcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIHplcm9fXG4gICAqICAgLSBjYXJyeV9cbiAgICogKi9cbiAgQVNMOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgY29uc3QgbXNiID0gVXRpbC5tc2IodmFsdWUpXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdmFsdWUgPDwgMSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBtc2JcbiAgfSxcblxuICAvKiBhY2Pjgb7jgZ/jga/jg6Hjg6Ljg6rjgpLlj7Pjgbjjgrfjg5Xjg4hcbiAgICog44OV44Op44KwXG4gICAqICAgLSBuZWdhdGl2ZV9cbiAgICogICAtIHplcm9fXG4gICAqICAgLSBjYXJyeV9cbiAgICogKi9cbiAgTFNSOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgY29uc3QgbHNiID0gVXRpbC5sc2IodmFsdWUpXG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdmFsdWUgPj4gMSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2JcbiAgfSxcblxuICAvKiBB44Go44Oh44Oi44Oq44KSQU5E5ryU566X44GX44Gm44OV44Op44Kw44KS5pON5L2c44GZ44KLXG4gICAqIOa8lOeul+e1kOaenOOBr+aNqOOBpuOCi1xuICAgKiAqL1xuICBCSVQ6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICByZXR1cm4gYWRkclxuICB9LFxuXG4gIC8qIEHjgajjg6Hjg6Ljg6rjgpLmr5TovIPmvJTnrpfjgZfjgabjg5Xjg6njgrDjgpLmk43kvZxcbiAgICog5ryU566X57WQ5p6c44Gv5o2o44Gm44KLXG4gICAqIEEgPT0gbWVtIC0+IFogPSAwXG4gICAqIEEgPj0gbWVtIC0+IEMgPSAxXG4gICAqIEEgPD0gbWVtIC0+IEMgPSAwXG4gICAqICovXG4gIENNUDogZnVuY3Rpb24oYWRkcikge1xuICAgIHJldHVybiBhZGRyXG4gIH0sXG5cbiAgLyogWOOBqOODoeODouODquOCkuavlOi8g+a8lOeulyAqL1xuICBDUFg6IGZ1bmN0aW9uKCkge1xuXG4gIH0sXG5cbiAgLyogWeOBqOODoeODouODquOCkuavlOi8g+a8lOeulyovXG4gIENQWTogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiAq44KS44Kk44Oz44Kv44Oq44Oh44Oz44OI44GZ44KLXG4gICAqIOODleODqeOCsFxuICAgKiAgIC0gbmVnYXRpdmVfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAqL1xuICAvKiDjg6Hjg6Ljg6rjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosqL1xuICBJTkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpKzEpXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJhbS5yZWFkKGFkZHIpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLjg4fjgq/jg6rjg6Hjg7Pjg4ggKi9cbiAgREVDOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yYW0ud3JpdGUoYWRkciwgdGhpcy5yYW0ucmVhZChhZGRyKS0xKVxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogWOOCkuOCpOODs+OCr+ODquODoeODs+ODiOOBmeOCiyAqL1xuICBJTlg6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJzLmluZGV4WCsrXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnJlZ2lzdGVycy5pbmRleFhcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMubmVnYXRpdmVfID0gVXRpbC5pc05lZ2F0aXZlKHZhbHVlKVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy56ZXJvXyA9IFV0aWwuaXNaZXJvKHZhbHVlKVxuICB9LFxuXG4gIC8qIFnjgpLjgqTjg7Pjgq/jg6rjg6Hjg7Pjg4jjgZnjgosgKi9cbiAgSU5ZOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5pbmRleFkrK1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5yZWdpc3RlcnMuaW5kZXhZXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLm5lZ2F0aXZlXyA9IFV0aWwuaXNOZWdhdGl2ZSh2YWx1ZSlcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuemVyb18gPSBVdGlsLmlzWmVybyh2YWx1ZSlcbiAgfSxcblxuICAvKiBY44KS44OH44Kv44Oq44Oh44Oz44OIICovXG4gIERFWDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhYLS1cbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WFxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogWeOCkuODh+OCr+ODquODoeODs+ODiCovXG4gIERFWTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuaW5kZXhZLS1cbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVnaXN0ZXJzLmluZGV4WVxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5uZWdhdGl2ZV8gPSBVdGlsLmlzTmVnYXRpdmUodmFsdWUpXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fID0gVXRpbC5pc1plcm8odmFsdWUpXG4gIH0sXG5cbiAgLyogYWNj44Go44Oh44Oi44Oq44KS6KuW55CGWE9S5ryU566X44GX44GmYWNj44Gr57WQ5p6c44KS6L+U44GZKi9cbiAgRU9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5yZWdpc3RlcnMuYWNjIF4gdGhpcy5yYW0ucmVhZChhZGRyKVxuICB9LFxuXG5cbiAgLyogYWNj44Go44Oh44Oi44Oq44KS6KuW55CGT1LmvJTnrpfjgZfjgabntZDmnpzjgpJB44G46L+U44GZICovXG4gIE9SQTogZnVuY3Rpb24oYWRkcikge1xuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IHRoaXMucmVnaXN0ZXJzLmFjYyB8IHRoaXMucmFtLnJlYWQoYWRkcilcbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgosgKi9cbiAgUk9MOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5X1xuICAgIGNvbnN0IG1zYiA9IHRoaXMucmFtLnJlYWQoYWRkcikgPj4gN1xuXG4gICAgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA9IG1zYlxuICAgIHRoaXMucmFtLndyaXRlKGFkZHIsIHRoaXMucmFtLnJlYWQoYWRkcikgPDwgMSB8IGNhcnJ5XylcbiAgfSxcblxuICAvKiBhY2PjgpLlt6bjgbjjg63jg7zjg4bjg7zjg4jjgZnjgotcbiAgICog5a6f6KOF44KS6ICD44GI44Gm44CBYWNj44Gu5aC05ZCI44KSUk9M44Go5YiG6Zui44GX44GfXG4gICAqICovXG4gIFJMQTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5X1xuICAgIGNvbnN0IG1zYiA9IHRoaXMucmVnaXN0ZXJzLmFjYyA+PiA3XG5cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfID0gbXNiXG4gICAgdGhpcy5yZWdpc3RlcnMuYWNjID0gdGhpcy5yZWdpc3RlcnMuYWNjIDw8IDEgfCBjYXJyeV9cbiAgfSxcblxuICAvKiDjg6Hjg6Ljg6rjgpLlj7Pjgbjjg63jg7zjg4bjg7zjg4jjgZnjgosgKi9cbiAgUk9SOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgY29uc3QgY2FycnlfID0gdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5XyA8PCA3XG4gICAgY29uc3QgbHNiID0gdGhpcy5yYW0ucmVhZChhZGRyKSAmIDB4MDFcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2JcbiAgICB0aGlzLnJhbS53cml0ZShhZGRyLCB0aGlzLnJhbS5yZWFkKGFkZHIpID4+IDEgfCBjYXJyeV8pXG4gIH0sXG5cbiAgLyogYWNj44KS5Y+z44G444Ot44O844OG44O844OI44GZ44KLXG4gICAqIOWun+ijheOCkuiAg+OBiOOBpmFjY+OBruWgtOWQiOOCklJPUuOBqOWIhumbouOBl+OBn1xuICAgKiAqL1xuICBSUkE6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGNhcnJ5XyA9IHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPDwgN1xuICAgIGNvbnN0IGxzYiA9IHRoaXMucmVnaXN0ZXJzLmFjYyAmIDB4MDFcblxuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSBsc2JcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSB0aGlzLnJlZ2lzdGVycy5hY2MgPj4gMSB8IGNhcnJ5X1xuICB9LFxuXG4gIC8qIGFjYyArIG1lbW9yeSArIGNhcnJ5RmxhZ1xuICAgKiDjg5Xjg6njgrBcbiAgICogICAtIG5lZ2F0aXZlX1xuICAgKiAgIC0gb3ZlcmZsb3dfXG4gICAqICAgLSB6ZXJvX1xuICAgKiAgIC0gY2FycnlfXG4gICAqICovXG4gIEFEQzogZnVuY3Rpb24oYWRkcikge1xuICAgIGNvbnN0IGFkZGVkID0gdGhpcy5yZWdpc3RlcnMuYWNjICsgdGhpcy5yYW0ucmVhZChhZGRyKVxuICAgIHRoaXMucmVnaXN0ZXJzLmFjYyA9IGFkZGVkICsgdGhpcy5yZWdpc3RlcnMuc3RhdHVzLmNhcnJ5X1xuICAgIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV8gPSAoYWRkZWQgPiAweGZmKSAmIDFcbiAgfSxcblxuICAvKiAoYWNjIC0g44Oh44Oi44OqIC0g44Kt44Oj44Oq44O844OV44Op44KwKeOCkua8lOeul+OBl+OBpmFjY+OBuOi/lOOBmSAqL1xuICBTQkM6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBzdWJlZCA9IHRoaXMucmVnaXN0ZXJzLmFjYyAtIHRoaXMucmFtLnJlYWQoYWRkcilcbiAgICB0aGlzLnJlZ2lzdGVycy5hY2MgPSBzdWJlZCAtIHRoaXMucmVnaXN0ZXJzLnN0YXR1cy5jYXJyeV9cbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuY2FycnlfID0gKHN1YmVkIDwgMHgwMCkgJiAxXG4gIH0sXG5cbiAgLyogYWNj44KS44K544K/44OD44Kv44Gr44OX44OD44K344OlICovXG4gIFBIQTogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiBQ44KS44K544K/44OD44Kv44Gr44OX44OD44K344OlICovXG4gIFBIUDogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolB44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMQTogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgrnjgr/jg4Pjgq/jgYvjgolQ44Gr44Od44OD44OX44Ki44OD44OX44GZ44KLICovXG4gIFBMUDogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgqLjg4njg6zjgrnjgbjjgrjjg6Pjg7Pjg5fjgZnjgosgKi9cbiAgSk1QOiBmdW5jdGlvbihhZGRyKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMucGMgPSBhZGRyXG4gIH0sXG5cbiAgLyog44K144OW44Or44O844OB44Oz44KS5ZG844Gz5Ye644GZICovXG4gIEpTUjogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgrXjg5bjg6vjg7zjg4Hjg7PjgYvjgonlvqnluLDjgZnjgosgKi9cbiAgUlRTOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIOWJsuOCiui+vOOBv+ODq+ODvOODgeODs+OBi+OCieW+qeW4sOOBmeOCiyAqL1xuICBSVEk6IGZ1bmN0aW9uKCkge1xuXG4gIH0sXG5cbiAgLyog44Kt44Oj44Oq44O844OV44Op44Kw44GM44Kv44Oq44Ki44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJDQzogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgYzjgrvjg4Pjg4jjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQkNTOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIOOCvOODreODleODqeOCsOOBjOOCu+ODg+ODiOOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyAqL1xuICBCRVE6IGZ1bmN0aW9uKCkge1xuXG4gIH0sXG5cbiAgLyog44ON44Ks44OG44Kj44OW44OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJNSTogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgrzjg63jg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosqL1xuICBCTkU6IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICBjb25zdCBpc0JyYW5jaGFibGUgPSAhdGhpcy5yZWdpc3RlcnMuc3RhdHVzLnplcm9fXG5cbiAgICBpZihpc0JyYW5jaGFibGUpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLnBjID0gYWRkclxuICAgIH1cbiAgfSxcblxuICAvKiDjg43jgqzjg4bjgqPjg5bjg5Xjg6njgrDjgYzjgq/jg6rjgqLjgZXjgozjgabjgYTjgovjgajjgY3jgavjg5bjg6njg7Pjg4HjgZnjgosgKi9cbiAgQlBMOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIOOCquODvOODkOODvOODleODreODvOODleODqeOCsOOBjOOCr+ODquOCouOBleOCjOOBpuOBhOOCi+OBqOOBjeOBq+ODluODqeODs+ODgeOBmeOCiyovXG4gIEJWQzogZnVuY3Rpb24gKCkge1xuXG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44GM44K744OD44OI44GV44KM44Gm44GE44KL44Go44GN44Gr44OW44Op44Oz44OB44GZ44KLICovXG4gIEJWUzogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgq/jg6rjgqLjgZfjgb7jgZkgKi9cbiAgQ0xDOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBi+OCiemAmuW4uOODouODvOODieOBq+aIu+OCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgQ0xEOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuioseWPr+OBmeOCiyAqL1xuICBDTEk6IGZ1bmN0aW9uKCkge1xuXG4gIH0sXG5cbiAgLyog44Kq44O844OQ44O844OV44Ot44O844OV44Op44Kw44KS44Kv44Oq44Ki44GZ44KLICovXG4gIENMVjogZnVuY3Rpb24oKSB7XG5cbiAgfSxcblxuICAvKiDjgq3jg6Pjg6rjg7zjg5Xjg6njgrDjgpLjgrvjg4Pjg4jjgZnjgosgKi9cbiAgU0VDOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIEJDROODouODvOODieOBq+ioreWumuOBmeOCiyBORVPjgavjga/lrp/oo4XjgZXjgozjgabjgYTjgarjgYQgKi9cbiAgU0VEOiBmdW5jdGlvbigpIHtcblxuICB9LFxuXG4gIC8qIElSUeWJsuOCiui+vOOBv+OCkuemgeatouOBmeOCi1xuICAgKiDjg5Xjg6njgrBcbiAgICogaW50ZXJydXB0XyA6IDHjgavjgrvjg4Pjg4jjgZnjgotcbiAgICogKi9cbiAgU0VJOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlZ2lzdGVycy5zdGF0dXMuaW50ZXJydXB0XyA9IDFcbiAgfSxcblxuICAvKiDjgr3jg5Xjg4jjgqbjgqfjgqLlibLjgorovrzjgb/jgpLotbfjgZPjgZkqL1xuICBCUks6IGZ1bmN0aW9uKCkge1xuXG4gIH0sXG5cbiAgLyog56m644Gu5ZG95Luk44KS5a6f6KGM44GZ44KLICovXG4gIE5PUDogZnVuY3Rpb24oKSB7XG5cbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVXRpbCB7XG4gIHN0YXRpYyBkZWJ1Z1N0cmluZyhpbnN0cnVjdGlvbiwgYWRkcmVzc2luZywgdmFsdWVfKSB7XG4gICAgbGV0IHByZWZpeCA9ICckJ1xuICAgIGxldCBwb3N0Zml4ID0gJydcblxuICAgIGlmKCFhZGRyZXNzaW5nKSB7XG4gICAgICBwcmVmaXggPSAnJ1xuICAgIH0gZWxzZSBpZihhZGRyZXNzaW5nLm5hbWUgPT09ICdib3VuZCBpbW1lZGlhdGUnKSB7XG4gICAgICBwcmVmaXggPSAnIyQnXG4gICAgfVxuXG4gICAgbGV0IHZhbHVlXG4gICAgaWYodmFsdWVfID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB2YWx1ZV8udG9TdHJpbmcoMTYpXG4gICAgfVxuXG4gICAgY29uc3QgY2hhcnMgPSBbXG4gICAgICBpbnN0cnVjdGlvbi5uYW1lLnNwbGl0KCcgJylbMV0sXG4gICAgICAnICcsXG4gICAgICBwcmVmaXgsXG4gICAgICB2YWx1ZSxcbiAgICAgIHBvc3RmaXhcbiAgICBdLmpvaW4oJycpXG5cbiAgICByZXR1cm4gY2hhcnNcbiAgfVxufVxuIiwiaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDQwIC0gMHg0RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOScsICdhJywgJ2InLFxuICAvKiAweDRjOiBKTVAgQWJzb2x1dGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYWJzb2x1dGUgPSBBZGRyZXNzaW5nLmFic29sdXRlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGUoKVxuXG4gICAgY29uc3QgSk1QID0gSW5zdHJ1Y3Rpb25zLkpNUC5iaW5kKHRoaXMpXG4gICAgSk1QKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhKTVAsIGFic29sdXRlLCBhZGRyKVxuICB9LFxuICAnZCcsICdlJywgJ2YnLFxuXVxuIiwiLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICdTRUknLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCIvKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ1NFSScsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJyxcbl1cbiIsImltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsJ1xuXG4vKiAweDcwIC0gMHg3RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JyxcbiAgLyogMHg3ODogU0VJICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFNFSSA9IEluc3RydWN0aW9ucy5TRUkuYmluZCh0aGlzKVxuXG4gICAgU0VJKClcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKFNFSSlcbiAgfSwgJzknLCAnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ODAgLSAweDhGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJywgJzEnLCAnMicsICczJywgJzQnLCAnNScsICc2JywgJzcnLFxuICAvKiAweDg4OiBERVkgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgREVZID0gSW5zdHJ1Y3Rpb25zLkRFWS5iaW5kKHRoaXMpXG5cbiAgICBERVkoKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoREVZKVxuICB9LCAnOScsICdhJywgJ2InLCAnYycsXG4gIC8qIDB4OGQ6IFNUQSBBYnNvbHV0ZSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhYnNvbHV0ZSA9IEFkZHJlc3NpbmcuYWJzb2x1dGUuYmluZCh0aGlzKVxuXG4gICAgY29uc3QgYWRkciA9IGFic29sdXRlKClcbiAgICBjb25zdCBTVEEgPSBJbnN0cnVjdGlvbnMuU1RBLmJpbmQodGhpcylcblxuICAgIFNUQShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoU1RBLCBhYnNvbHV0ZSwgYWRkcilcbiAgfSwgJ2UnLCAnZidcbl1cbiIsIi8vaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi91dGlsLmpzJ1xuXG4vKiAweDkwIC0gMHg5RiAqL1xuZXhwb3J0IGRlZmF1bHQgW1xuICAnMCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOScsXG4gIC8qIDlBOiBUWFMgSW1wbGllZCovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IFRYUyA9IEluc3RydWN0aW9ucy5UWFMuYmluZCh0aGlzKVxuICAgIFRYUygpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhUWFMpXG4gIH0sXG4gICcnLCAnJywgJycsICcnLCAnJyxcbl1cbiIsImltcG9ydCBJbnN0cnVjdGlvbnMgZnJvbSAnLi4vaW5zdHJ1Y3Rpb25zJ1xuaW1wb3J0IEFkZHJlc3NpbmcgZnJvbSAnLi4vYWRkcmVzc2luZydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhBMCAtIDB4QUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgLyogMHhBMDogTERZIEltbWVkaWF0ZSovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGltbWVkaWF0ZSA9IEFkZHJlc3NpbmcuaW1tZWRpYXRlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gaW1tZWRpYXRlKClcblxuICAgIGNvbnN0IExEWSA9IEluc3RydWN0aW9ucy5MRFkuYmluZCh0aGlzKVxuICAgIExEWShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERZLCBpbW1lZGlhdGUsIHRoaXMucmFtLnJlYWQoYWRkcikpXG4gIH1cbiAgLCAnMScsXG4gIC8qIDB4QTI6IExEWCBJbW1lZGlhdGUgKi9cbiAgZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgaW1tZWRpYXRlID0gQWRkcmVzc2luZy5pbW1lZGlhdGUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSBpbW1lZGlhdGUoKVxuXG4gICAgY29uc3QgTERYID0gSW5zdHJ1Y3Rpb25zLkxEWC5iaW5kKHRoaXMpXG4gICAgTERYKGFkZHIpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhMRFgsIGltbWVkaWF0ZSwgdGhpcy5yYW0ucmVhZChhZGRyKSlcbiAgfSwgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsICc4JyxcblxuICAvKiAweEE5OiBMREEgSW1tZWRpYXRlICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGltbWVkaWF0ZSA9IEFkZHJlc3NpbmcuaW1tZWRpYXRlLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gaW1tZWRpYXRlKClcblxuICAgIGNvbnN0IExEQSA9IEluc3RydWN0aW9ucy5MREEuYmluZCh0aGlzKVxuICAgIExEQShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERBLCBpbW1lZGlhdGUsIHRoaXMucmFtLnJlYWQoYWRkcikpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4YjAgLSAweGJGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gICcwJywgJzEnLCAnMicsICczJywgJzQnLCAnNScsICc2JywgJzcnLFxuICAnOCcsICc5JywgJ2EnLCAnYicsICdjJyxcbiAgLyogMHhiZDogTERBIEFic29sdXRlbSBYICovXG4gIGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFic29sdXRlWCA9IEFkZHJlc3NpbmcuYWJzb2x1dGVYLmJpbmQodGhpcylcbiAgICBjb25zdCBhZGRyID0gYWJzb2x1dGVYKClcblxuICAgIGNvbnN0IExEQSA9IEluc3RydWN0aW9ucy5MREEuYmluZCh0aGlzKVxuICAgIExEQShhZGRyKVxuXG4gICAgcmV0dXJuIFV0aWwuZGVidWdTdHJpbmcoTERBLCBhYnNvbHV0ZVgsIGFkZHIpXG4gIH1cbiAgLCAnZScsICdmJ1xuXVxuIiwiLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICdTRUknLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCJpbXBvcnQgQWRkcmVzc2luZyBmcm9tICcuLi9hZGRyZXNzaW5nJ1xuaW1wb3J0IEluc3RydWN0aW9ucyBmcm9tICcuLi9pbnN0cnVjdGlvbnMnXG5pbXBvcnQgVXRpbCBmcm9tICcuL3V0aWwnXG5cbi8qIDB4ZDAgLSAweGRGICovXG5leHBvcnQgZGVmYXVsdCBbXG4gIC8qIDB4ZDA6IEJORSAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCByZWxhdGl2ZSA9IEFkZHJlc3NpbmcucmVsYXRpdmUuYmluZCh0aGlzKVxuICAgIGNvbnN0IGFkZHIgPSByZWxhdGl2ZSgpXG5cbiAgICBjb25zdCBCTkUgPSBJbnN0cnVjdGlvbnMuQk5FLmJpbmQodGhpcylcbiAgICBCTkUoYWRkcilcblxuICAgIHJldHVybiBVdGlsLmRlYnVnU3RyaW5nKEJORSwgcmVsYXRpdmUsIGFkZHIpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICdTRUknLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCIvL2ltcG9ydCBBZGRyZXNzaW5nIGZyb20gJy4uL2FkZHJlc3NpbmcnXG5pbXBvcnQgSW5zdHJ1Y3Rpb25zIGZyb20gJy4uL2luc3RydWN0aW9ucydcbmltcG9ydCBVdGlsIGZyb20gJy4vdXRpbCdcblxuLyogMHhlMCAtIDB4ZUYgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJzAnLCAnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNycsXG4gIC8qIDB4ZTg6IElOWCAqL1xuICBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBJTlggPSBJbnN0cnVjdGlvbnMuSU5YLmJpbmQodGhpcylcblxuICAgIElOWCgpXG5cbiAgICByZXR1cm4gVXRpbC5kZWJ1Z1N0cmluZyhJTlgpXG4gIH0sICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLFxuXVxuIiwiLyogMHg3MCAtIDB4N0YgKi9cbmV4cG9ydCBkZWZhdWx0IFtcbiAgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICdTRUknLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsXG5dXG4iLCJpbXBvcnQgeDB4IGZyb20gJy4vMHgweCdcbmltcG9ydCB4MXggZnJvbSAnLi8weDF4J1xuaW1wb3J0IHgyeCBmcm9tICcuLzB4MngnXG5pbXBvcnQgeDN4IGZyb20gJy4vMHgzeCdcbmltcG9ydCB4NHggZnJvbSAnLi8weDR4J1xuaW1wb3J0IHg1eCBmcm9tICcuLzB4NXgnXG5pbXBvcnQgeDZ4IGZyb20gJy4vMHg2eCdcbmltcG9ydCB4N3ggZnJvbSAnLi8weDd4J1xuaW1wb3J0IHg4eCBmcm9tICcuLzB4OHgnXG5pbXBvcnQgeDl4IGZyb20gJy4vMHg5eCdcbmltcG9ydCB4QXggZnJvbSAnLi8weEF4J1xuaW1wb3J0IHhCeCBmcm9tICcuLzB4QngnXG5pbXBvcnQgeEN4IGZyb20gJy4vMHhDeCdcbmltcG9ydCB4RHggZnJvbSAnLi8weER4J1xuaW1wb3J0IHhFeCBmcm9tICcuLzB4RXgnXG5pbXBvcnQgeEZ4IGZyb20gJy4vMHhGeCdcblxuY29uc3Qgb3Bjb2RlcyA9IFtdLmNvbmNhdChcbiAgeDB4LCB4MXgsIHgyeCwgeDN4LFxuICB4NHgsIHg1eCwgeDZ4LCB4N3gsXG4gIHg4eCwgeDl4LCB4QXgsIHhCeCxcbiAgeEN4LCB4RHgsIHhFeCwgeEZ4XG4pXG5cbmV4cG9ydCBkZWZhdWx0IG9wY29kZXNcbiIsImltcG9ydCByZWdpc3RlcnMgZnJvbSAnLi9yZWdpc3RlcnMnXG5pbXBvcnQgUmFtIGZyb20gJy4vcmFtJ1xuaW1wb3J0IG9wY29kZXMgZnJvbSAnLi9vcGNvZGVzJ1xuXG4vKiA2NTAyIENQVSAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ3B1IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5pbml0KClcbiAgfVxuXG4gIGluaXQoKSB7XG4gICAgdGhpcy5yZWdpc3RlcnMgPSByZWdpc3RlcnMgLy8g44Os44K444K544K/XG4gICAgdGhpcy5vcGNvZGVzID0gb3Bjb2RlcyAvL+WRveS7pOS4gOimp1xuICAgIC8vdGhpcy5vcGNvZGVzID0gb3Bjb2Rlcy5tYXAob3Bjb2RlID0+IG9wY29kZS5iaW5kKHRoaXMpKSAvLyDlkb3ku6TkuIDopqdcblxuICAgIC8qIEFib3V0IG1lbW9yeVxuICAgICAqIDB4MDAwMCAtIDB4MDdmZiA6IFdSQU1cbiAgICAgKiAweDA4MDAgLSAweDFmZmYgOiBNaXJyb3Igb2YgV1JBTVxuICAgICAqIDB4MjAwMCAtIDB4MjAwNyA6IFBQVSByZWdpc3RlcnNcbiAgICAgKiAweDIwMDggLSAweDNmZmYgOiBNaXJyb3Igb2YgUFBVIHJlZ2lzdGVyc1xuICAgICAqIDB4NDAwMCAtIDB4NDAxZiA6IEFQVSBJL08sIFBBRD9cbiAgICAgKiAweDQwMjAgLSAweDVmZmYgOiBST00gRXh0ZW5zaW9uXG4gICAgICogMHg2MDAwIC0gMHg3ZmZmIDogUkFNIEV4dGVuc2lvblxuICAgICAqIDB4ODAwMCAtIDB4YmZmZiA6IFByb2dyYW0gUk9NXG4gICAgICogMHhjMDAwIC0gMHhmZmZmIDogUHJvZ3JhbSBST01cbiAgICAgKiAqL1xuICAgIC8vdGhpcy5tZW1vcnkgPSBuZXcgVWludDhBcnJheSgweDEwMDAwKSAvLzI1NuOCkui2heOBiOOCi+OBqOOCquODvOODkOODvOODleODreODvOOBmeOCi++8iOOBl+OBpuOBj+OCjOOCi++8iVxuICAgIHRoaXMucmFtID0gbmV3IFJhbSgpXG4gIH1cblxuICBjb25uZWN0KHBhcnRzKSB7XG4gICAgcGFydHMuYnVzICYmIHRoaXMucmFtLmNvbm5lY3QocGFydHMpXG4gIH1cblxuICByZXNldCgpIHtcbiAgICAvL1RPRE8g44OX44Ot44Kw44Op44Og44Kr44Km44Oz44K/562J44Gu5YCk44Gv5LuK44Gu44Go44GT44KN5Luu44Gq44Gu44Gn6KaL55u044GZXG4gICAgdGhpcy5pbml0KClcbiAgfVxuXG4gIHJ1bihpc0RlYnVnKSB7XG4gICAgY29uc3QgcnVuID0gaXNEZWJ1ZyA/IHRoaXMuZGVidWcuYmluZCh0aGlzKSA6IHRoaXMuZXZhbC5iaW5kKHRoaXMpXG5cbiAgICBzZXRJbnRlcnZhbChydW4sIDcwKVxuICB9XG5cbiAgLy8g5ZG95Luk44KS5Yem55CG44GZ44KLXG4gIGV2YWwoKSB7XG4gICAgY29uc3QgYWRkciA9IHRoaXMucmVnaXN0ZXJzLnBjKytcbiAgICAvL2NvbnN0IG9wY29kZSA9IHRoaXMubWVtb3J5W2ldXG4gICAgY29uc3Qgb3Bjb2RlID0gdGhpcy5yYW0ucmVhZChhZGRyKVxuXG4gICAgdGhpcy5vcGNvZGVzW29wY29kZV0uY2FsbCgpXG4gIH1cblxuICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG4gIGRlYnVnKCkge1xuICAgIGNvbnN0IGFkZHIgPSB0aGlzLnJlZ2lzdGVycy5wYysrXG4gICAgLy9jb25zdCBvcGNvZGUgPSB0aGlzLm1lbW9yeVtpXVxuICAgIGNvbnN0IG9wY29kZSA9IHRoaXMucmFtLnJlYWQoYWRkcilcblxuICAgIGlmKHR5cGVvZiB0aGlzLm9wY29kZXNbb3Bjb2RlXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY29uc29sZS5lcnJvcignTm90IGltcGxlbWVudGVkOiAnICsgb3Bjb2RlLnRvU3RyaW5nKDE2KSlcbiAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5vcGNvZGVzW29wY29kZV0pXG4gICAgfVxuXG4gICAgY29uc3QgZGVidWdTdHJpbmcgPSB0aGlzLm9wY29kZXNbb3Bjb2RlXS5iaW5kKHRoaXMpLmNhbGwoKVxuICAgIGNvbnNvbGUubG9nKGRlYnVnU3RyaW5nKVxuICB9XG5cbiAgLyogMHg4MDAwfuOBruODoeODouODquOBq1JPTeWGheOBrlBSRy1ST03jgpLoqq3jgb/ovrzjgoAqL1xuICBzZXQgcHJnUm9tKHByZ1JvbSkge1xuICAgIGNvbnN0IHN0YXJ0QWRkciA9IDB4ODAwMFxuXG4gICAgZm9yKGxldCBpID0gMDtpIDwgcHJnUm9tLmxlbmd0aDtpKyspIHtcbiAgICAgIC8vdGhpcy5tZW1vcnlbc3RhcnRBZGRyK2ldID0gcHJnUm9tW2ldXG4gICAgICB0aGlzLnJhbS53cml0ZShzdGFydEFkZHIraSwgcHJnUm9tW2ldKVxuICAgIH1cbiAgfVxuXG5cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFZyYW0ge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1lbW9yeSA9IG5ldyBVaW50OEFycmF5KDB4NDAwMClcbiAgICB0aGlzLnZwID0gbnVsbFxuICB9XG5cbiAgY29ubmVjdChwcHUpIHtcbiAgICB0aGlzLnJlZnJlc2hEaXNwbGF5ID0gcHB1LnJlZnJlc2hEaXNwbGF5LmJpbmQocHB1KVxuICB9XG5cbiAgd3JpdGVGcm9tQnVzKHZhbHVlKSB7XG4gICAgLy9jb25zb2xlLmxvZygndnJhbVskJyArIHRoaXMudnAudG9TdHJpbmcoMTYpICsgJ10gPSAnICsgU3RyaW5nLmZyb21DaGFyQ29kZSh2YWx1ZSkpXG4gICAgdGhpcy5tZW1vcnlbdGhpcy52cF0gPSB2YWx1ZVxuICAgIHRoaXMudnArK1xuICAgIHRoaXMucmVmcmVzaERpc3BsYXkgJiYgdGhpcy5yZWZyZXNoRGlzcGxheSgpXG4gIH1cblxuICB3cml0ZShhZGRyLCB2YWx1ZSkge1xuICAgIHRoaXMubWVtb3J5W2FkZHJdID0gdmFsdWVcbiAgfVxuXG4gIHJlYWQoYWRkcikge1xuICAgIHJldHVybiB0aGlzLm1lbW9yeVthZGRyXVxuICB9XG59XG4iLCJpbXBvcnQgVnJhbSBmcm9tICcuL3ZyYW0nXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFBwdSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuaW5pdCgpXG4gIH1cblxuICBpbml0KCkge1xuICAgIC8qIEFib3V0IFZSQU1cbiAgICAgKiAweDAwMDAgLSAweDBmZmYgOiBQYXR0ZXJuIHRhYmxlIDBcbiAgICAgKiAweDEwMDAgLSAweDFmZmYgOiBQYXR0ZXJuIHRhYmxlIDFcbiAgICAgKiAweDIwMDAgLSAweDIzYmYgOiBOYW1lIHRhYmxlIDBcbiAgICAgKiAweDIzYzAgLSAweDIzZmYgOiBBdHRyaWJ1dGUgdGFibGUgMFxuICAgICAqIDB4MjQwMCAtIDB4MjdiZiA6IE5hbWUgdGFibGUgMVxuICAgICAqIDB4MmJjMCAtIDB4MmJiZiA6IEF0dHJpYnV0ZSB0YWJsZSAxXG4gICAgICogMHgyYzAwIC0gMHgyZmJmIDogTmFtZSB0YWJsZSAyXG4gICAgICogMHgyYmMwIC0gMHgyYmZmIDogQXR0cmlidXRlIHRhYmxlIDJcbiAgICAgKiAweDJjMDAgLSAweDJmYmYgOiBOYW1lIHRhYmxlIDNcbiAgICAgKiAweDJmYzAgLSAweDJmZmYgOiBBdHRyaWJ1dGUgdGFibGUgM1xuICAgICAqIDB4MzAwMCAtIDB4M2VmZiA6IE1pcnJvciBvZiAweDIwMDAgLSAweDJmZmZcbiAgICAgKiAweDNmMDAgLSAweDNmMGYgOiBCYWNrZ3JvdW5kIHBhbGV0dGVcbiAgICAgKiAweDNmMTAgLSAweDNmMWYgOiBTcHJpdGUgcGFsZXR0ZVxuICAgICAqIDB4M2YyMCAtIDB4M2ZmZiA6IE1pcnJvciBvZiAweDNmMDAgMCAweDNmMWZcbiAgICAgKiAqL1xuICAgIHRoaXMudnJhbSA9IG5ldyBWcmFtKClcbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBpZihwYXJ0cy5idXMpIHtcbiAgICAgIHBhcnRzLmJ1cy5jb25uZWN0KHsgdnJhbTogdGhpcy52cmFtIH0pXG4gICAgfVxuXG4gICAgaWYocGFydHMucmVuZGVyZXIpe1xuICAgICAgdGhpcy5yZW5kZXJlciA9IHBhcnRzLnJlbmRlcmVyXG4gICAgICB0aGlzLnZyYW0uY29ubmVjdCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIC8qICQyMDAwIC0gJDIzQkbjga7jg43jg7zjg6Djg4bjg7zjg5bjg6vjgpLmm7TmlrDjgZnjgosgKi9cbiAgcmVmcmVzaERpc3BsYXkoKSB7XG4gICAgLyog44K/44Kk44OrKDh4OCnjgpIzMiozMOWAiyAqL1xuICAgIGZvcihsZXQgaSA9IDB4MjAwMDtpIDw9IDB4MjNiZjtpKyspIHtcbiAgICAgIGNvbnN0IHRpbGVJZCA9IHRoaXMudnJhbS5yZWFkKGkpXG4gICAgICAvKiDjgr/jgqTjg6vjgpLmjIflrpogKi9cbiAgICAgIGNvbnN0IHRpbGUgPSB0aGlzLnRpbGVzW3RpbGVJZF1cbiAgICAgIC8qIOOCv+OCpOODq+OBjOS9v+eUqOOBmeOCi+ODkeODrOODg+ODiOOCkuWPluW+lyAqL1xuICAgICAgY29uc3QgcGFsZXR0ZUlkID0gdGhpcy5zZWxlY3RQYWxldHRlKHRpbGVJZClcbiAgICAgIGNvbnN0IHBhbGV0dGUgPSB0aGlzLnNlbGVjdEJhY2tncm91bmRQYWxldHRlcyhwYWxldHRlSWQpXG5cblxuICAgICAgLy9jb25zb2xlLmxvZygnaWQ6JyArIHBhbGV0dGVJZClcbiAgICAgIC8vY29uc29sZS5sb2coJ3BhbGV0dGU6JyArIHBhbGV0dGUpXG4gICAgICAvKiDjgr/jgqTjg6vjgajjg5Hjg6zjg4Pjg4jjgpJSZW5kZXJlcuOBq+a4oeOBmSAqL1xuICAgICAgdGhpcy5yZW5kZXJlci53cml0ZSh0aWxlLCBwYWxldHRlKVxuICAgIH1cbiAgfVxuXG4gIC8qIDB4MDAwMCAtIDB4MWZmZuOBruODoeODouODquOBq0NIUi1ST03jgpLoqq3jgb/ovrzjgoAgKi9cbiAgc2V0IGNoclJvbShjaHJSb20pIHtcbiAgICBmb3IobGV0IGk9MDtpPGNoclJvbS5sZW5ndGg7aSsrKSB7XG4gICAgICB0aGlzLnZyYW0ud3JpdGUoaSwgY2hyUm9tW2ldKVxuICAgIH1cblxuICAgIC8qIENIUumgmOWfn+OBi+OCieOCv+OCpOODq+OCkuaKveWHuuOBl+OBpuOBiuOBjyAqL1xuICAgIHRoaXMuZXh0cmFjdFRpbGVzKClcbiAgfVxuXG4gIC8vIDh4OOOBruOCv+OCpOODq+OCkuOBmeOBueOBpnZyYW3jga5DSFLjgYvjgonmir3lh7rjgZfjgabjgYrjgY9cbiAgZXh0cmFjdFRpbGVzKCkge1xuICAgIHRoaXMudGlsZXMgPSBbXVxuICAgIGZvcihsZXQgaT0wO2k8MHgxZmZmOykge1xuICAgICAgLy8g44K/44Kk44Or44Gu5LiL5L2N44OT44OD44OIXG4gICAgICBjb25zdCBsb3dlckJpdExpbmVzID0gW11cbiAgICAgIGZvcihsZXQgaD0wO2g8ODtoKyspIHtcbiAgICAgICAgbGV0IGJ5dGUgPSB0aGlzLnZyYW0ucmVhZChpKyspXG4gICAgICAgIGNvbnN0IGxpbmUgPSBbXVxuICAgICAgICBmb3IobGV0IGo9MDtqPDg7aisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0KVxuICAgICAgICAgIGJ5dGUgPSBieXRlID4+IDFcbiAgICAgICAgfVxuXG4gICAgICAgIGxvd2VyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDjgr/jgqTjg6vjga7kuIrkvY3jg5Pjg4Pjg4hcbiAgICAgIGNvbnN0IGhpZ2hlckJpdExpbmVzID0gW11cbiAgICAgIGZvcihsZXQgaD0wO2g8ODtoKyspIHtcbiAgICAgICAgbGV0IGJ5dGUgPSB0aGlzLnZyYW0ucmVhZChpKyspXG4gICAgICAgIGNvbnN0IGxpbmUgPSBbXVxuICAgICAgICBmb3IobGV0IGo9MDtqPDg7aisrKSB7XG4gICAgICAgICAgY29uc3QgYml0ID0gYnl0ZSAmIDB4MDFcbiAgICAgICAgICBsaW5lLnVuc2hpZnQoYml0IDw8IDEpXG4gICAgICAgICAgYnl0ZSA9IGJ5dGUgPj4gMVxuICAgICAgICB9XG5cbiAgICAgICAgaGlnaGVyQml0TGluZXMucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICAvLyDkuIrkvY3jg5Pjg4Pjg4jjgajkuIvkvY3jg5Pjg4Pjg4jjgpLlkIjmiJDjgZnjgotcbiAgICAgIGNvbnN0IHBlcmZlY3RCaXRzID0gW11cbiAgICAgIGZvcihsZXQgaD0wO2g8ODtoKyspIHtcbiAgICAgICAgZm9yKGxldCBqPTA7ajw4O2orKykge1xuICAgICAgICAgIGNvbnN0IHBlcmZlY3RCaXQgPSBsb3dlckJpdExpbmVzW2hdW2pdIHwgaGlnaGVyQml0TGluZXNbaF1bal1cbiAgICAgICAgICBwZXJmZWN0Qml0cy5wdXNoKHBlcmZlY3RCaXQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMudGlsZXMucHVzaChwZXJmZWN0Qml0cylcbiAgICB9XG4gIH1cblxuICAvKiDlsZ7mgKfjg4bjg7zjg5bjg6sgKi9cbiAgc2VsZWN0UGFsZXR0ZShuKSB7XG4gICAgY29uc3QgYmxvY2tQb3NpdGlvbiA9IChuIC0gbiAlIDY0KSAvIDY0ICogOCArICgobiAlIDY0KSAtIChuICUgNCkpIC8gNFxuICAgIGNvbnN0IGJpdFBvc2l0aW9uID0gbiAlIDRcbiAgICBjb25zdCBzdGFydCA9IDB4MjNjMFxuXG4gICAgY29uc3QgYmxvY2sgPSB0aGlzLnZyYW0ucmVhZChzdGFydCArIGJsb2NrUG9zaXRpb24pXG4gICAgY29uc3QgYml0ID0gKGJsb2NrID4+IGJpdFBvc2l0aW9uKSAmIDB4MDNcblxuICAgIHJldHVybiBiaXRcbiAgfVxuXG4gIC8qICQzRjAwLSQzRjBG44Gu44OQ44OD44Kv44Kw44Op44Km44Oz44OJKOiDjOaZrynjg5Hjg6zjg4Pjg4jjg4bjg7zjg5bjg6vjgpIgKi9cbiAgc2VsZWN0QmFja2dyb3VuZFBhbGV0dGVzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMDAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjAwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IobGV0IGk9c3RhcnQ7aTxlbmQ7aSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxuXG4gIC8qICQzRjEwLSQzRjFGXHTjgrnjg5fjg6njgqTjg4jjg5Hjg6zjg4Pjg4jjg4bjg7zjg5bjg6sqL1xuICBzZWxlY3RTcHJpdGVQYWxldHRzKG51bWJlcikge1xuICAgIGNvbnN0IHBhbGV0dGUgPSBbXVxuXG4gICAgY29uc3Qgc3RhcnQgPSAweDNmMTAgKyBudW1iZXIgKiA0XG4gICAgY29uc3QgZW5kID0gMHgzZjEwICsgbnVtYmVyICogNCArIDRcbiAgICBmb3IobGV0IGk9c3RhcnQ7aTxlbmQ7aSsrKSB7XG4gICAgICBwYWxldHRlLnB1c2godGhpcy52cmFtLnJlYWQoaSkpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhbGV0dGVcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnVzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5idWZmZXIgPSB7fVxuICAgIHRoaXMudnJhbUFkZHJfID0gW11cbiAgfVxuXG4gIGNvbm5lY3QocGFydHMpIHtcbiAgICBwYXJ0cy52cmFtICYmICh0aGlzLnZyYW0gPSBwYXJ0cy52cmFtKVxuICB9XG5cbiAgLyogQ1BV5YG044GL44KJ44Gu44G/44GX44GL6ICD5oWu44GX44Gm44Gq44GEICovXG4gIHdyaXRlKGFkZHIsIHZhbHVlKSB7XG4gICAgc3dpdGNoKGFkZHIpIHtcbiAgICAgIGNhc2UgMHgyMDA2OlxuICAgICAgICB0aGlzLnZyYW1BZGRyID0gdmFsdWVcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMHgyMDA3OlxuICAgICAgICB0aGlzLnZyYW0ud3JpdGVGcm9tQnVzKHZhbHVlKVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5idWZmZXJbYWRkcl0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIHJlYWQoYWRkcikge1xuICAgIHN3aXRjaChhZGRyKSB7XG4gICAgICBjYXNlIDB4MjAwNjpcbiAgICAgICAgcmV0dXJuIHRoaXMudnJhbUFkZHJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1cyBvZiB0aGlzIGFkZHIgaXMgTm90IGltcGxlbWVudGVkJylcbiAgICB9XG4gIH1cblxuICBzZXQgdnJhbUFkZHIoYWRkcikge1xuICAgIGlmKHRoaXMudnJhbUFkZHJfLmxlbmd0aCA8IDEpIHtcbiAgICAgIHRoaXMudnJhbUFkZHJfLnB1c2goYWRkcilcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52cmFtQWRkcl8ucHVzaChhZGRyKVxuICAgICAgdGhpcy52cmFtLnZwID0gdGhpcy52cmFtQWRkclxuICAgICAgdGhpcy52cmFtQWRkcl8ubGVuZ3RoID0gMFxuICAgIH1cbiAgfVxuXG4gIGdldCB2cmFtQWRkcigpIHtcbiAgICByZXR1cm4gKHRoaXMudnJhbUFkZHJfWzBdIDw8IDgpICsgdGhpcy52cmFtQWRkcl9bMV1cbiAgfVxufVxuIiwiaW1wb3J0IENwdSBmcm9tICcuL2NwdSdcbmltcG9ydCBQcHUgZnJvbSAnLi9wcHUnXG5pbXBvcnQgQnVzIGZyb20gJy4vYnVzJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBOZXMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNwdSA9IG5ldyBDcHUoKVxuICAgIHRoaXMucHB1ID0gbmV3IFBwdSgpXG4gICAgdGhpcy5idXMgPSBuZXcgQnVzKClcbiAgICB0aGlzLnBwdS5jb25uZWN0KHsgYnVzOiB0aGlzLmJ1cyB9KVxuICAgIHRoaXMuY3B1LmNvbm5lY3QoeyBidXM6IHRoaXMuYnVzIH0pXG4gIH1cblxuICBjb25uZWN0KHJlbmRlcmVyKSB7XG4gICAgdGhpcy5wcHUuY29ubmVjdCh7IHJlbmRlcmVyIH0pXG4gIH1cblxuICBnZXQgcm9tKCkge1xuICAgIHJldHVybiB0aGlzLl9yb21cbiAgfVxuXG4gIHNldCByb20ocm9tKSB7XG4gICAgdGhpcy5fcm9tID0gcm9tXG4gIH1cblxuICBydW4oaXNEZWJ1Zykge1xuICAgIHRoaXMuY3B1LnByZ1JvbSA9IHRoaXMucm9tLnByZ1JvbVxuICAgIHRoaXMucHB1LmNoclJvbSA9IHRoaXMucm9tLmNoclJvbVxuXG4gICAgdGhpcy5jcHUucnVuKGlzRGVidWcpXG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvbSB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmNoZWNrKGRhdGEpXG4gICAgdGhpcy5kYXRhID0gZGF0YVxuICB9XG5cbiAgY2hlY2soZGF0YSkge1xuICAgIGlmKCF0aGlzLmlzTmVzUm9tKGRhdGEpKSB0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgaXMgbm90IE5FUyBST00uJylcbiAgfVxuXG4gIGdldCBORVNfUk9NX0hFQURFUl9TSVpFKCkge1xuICAgIHJldHVybiAweDEwXG4gIH1cblxuICBnZXQgU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLk5FU19ST01fSEVBREVSX1NJWkUgKyB0aGlzLlNJWkVfT0ZfUFJHX1JPTVxuICB9XG5cbiAgZ2V0IEVORF9BRERSRVNTX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NICsgdGhpcy5TSVpFX09GX0NIUl9ST01cbiAgfVxuXG4gIC8qIFBSRyBST03jga7jgrXjgqTjgrrjgpLlj5blvpfjgZnjgotcblx0Kiog44K144Kk44K644GvUk9N44OY44OD44OA44GuMeOBi+OCieaVsOOBiOOBpjVCeXRl55uu44Gu5YCk44GrMTZLaSjjgq3jg5Mp44KS44GL44GR44Gf44K144Kk44K6XG4gICAqIGh0dHBzOi8vd2lraS5uZXNkZXYuY29tL3cvaW5kZXgucGhwL0lORVMjaU5FU19maWxlX2Zvcm1hdCAqL1xuICBnZXQgU0laRV9PRl9QUkdfUk9NKCkge1xuICAgIHJldHVybiB0aGlzLmRhdGFbNF0gKiAweDQwMDAgLy8gMHg0MDAwID0gMTZLaVxuICB9XG5cblx0LyogUFJHIFJPTeOBq+WQjOOBmCovXG4gIGdldCBTSVpFX09GX0NIUl9ST00oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YVs1XSAqIDB4MjAwMCAvLyAweDIwMDAgPSA4S2lcbiAgfVxuXG5cdC8qIFJPTeOBi+OCiXByZ1JPTeOBq+ipsuW9k+OBmeOCi+OBqOOBk+OCjeOCkuWIh+OCiuWHuuOBmVxuXHQqKiBwcmdST03jga/jg5jjg4Pjg4DpoJjln5/jga7mrKHjga5CeXRl44GL44KJ5aeL44G+44KLXG5cdCovXG4gIGdldCBwcmdSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZSh0aGlzLk5FU19ST01fSEVBREVSX1NJWkUsIHRoaXMuU1RBUlRfQUREUkVTU19PRl9DSFJfUk9NIC0gMSlcbiAgfVxuXHQvKiBwcmdSb23jgavlkIzjgZhcblx0KiogY2hyUm9t44GvcHJnUm9t44Gu5b6M44GL44KJ5aeL44G+44KLXG5cdCovXG4gIGdldCBjaHJSb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5zbGljZSh0aGlzLlNUQVJUX0FERFJFU1NfT0ZfQ0hSX1JPTSwgdGhpcy5FTkRfQUREUkVTU19PRl9DSFJfUk9NIC0gMSlcbiAgfVxuXG4gIC8qIOODh+ODvOOCv+OBruODmOODg+ODgOOBqydORVMn44GM44GC44KL44GL44Gp44GG44GL44GnTkVT44GuUk9N44GL5Yik5Yil44GZ44KLICovXG4gIGlzTmVzUm9tKGRhdGEpIHtcbiAgICBjb25zdCBoZWFkZXIgPSBkYXRhLnNsaWNlKDAsIDMpXG4gICAgY29uc3QgaGVhZGVyU3RyID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBoZWFkZXIpXG5cbiAgICByZXR1cm4gaGVhZGVyU3RyID09PSAnTkVTJ1xuICB9XG5cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJlbmRlcmVyIHtcbiAgY29uc3RydWN0b3IoaWQpIHtcbiAgICBsZXQgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpXG4gICAgdGhpcy5jb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICB0aGlzLnBvaW50ZXIgPSAwXG4gICAgdGhpcy53aWR0aCA9IDMyXG4gICAgdGhpcy5oZWlnaHQgPSAzMFxuICB9XG5cbiAgd3JpdGUodGlsZSwgcGFsZXR0ZSkge1xuICAgIGNvbnN0IGltYWdlID0gdGhpcy5nZW5lcmF0ZVRpbGVJbWFnZSh0aWxlLCBwYWxldHRlKVxuICAgIGNvbnN0IHggPSAodGhpcy5wb2ludGVyICUgdGhpcy53aWR0aCkgKiA4XG4gICAgY29uc3QgeSA9ICh0aGlzLnBvaW50ZXIgLSB0aGlzLnBvaW50ZXIgJSB0aGlzLndpZHRoKSAvIHRoaXMud2lkdGggKiA4XG5cbiAgICBpZih0aGlzLnBvaW50ZXIgPCB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgLSAxKSB7XG4gICAgICB0aGlzLnBvaW50ZXIrK1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBvaW50ZXIgPSAwXG4gICAgfVxuXG4gICAgdGhpcy5jb250ZXh0LnB1dEltYWdlRGF0YShpbWFnZSwgeCwgeSlcbiAgfVxuXG4gIGdlbmVyYXRlVGlsZUltYWdlKHRpbGUgLHBhbGV0dGUpIHtcbiAgICBjb25zdCBpbWFnZSA9IHRoaXMuY29udGV4dC5jcmVhdGVJbWFnZURhdGEoOCwgOClcblxuICAgIGZvcihsZXQgaT0wO2k8NjQ7aSsrKSB7XG4gICAgICBjb25zdCBiaXQgPSB0aWxlW2ldXG4gICAgICBjb25zdCBjb2xvciA9IHRoaXMuY29sb3IocGFsZXR0ZVtiaXRdKVxuXG4gICAgICBpbWFnZS5kYXRhW2kqNF0gPSBjb2xvclswXVxuICAgICAgaW1hZ2UuZGF0YVtpKjQrMV0gPSBjb2xvclsxXVxuICAgICAgaW1hZ2UuZGF0YVtpKjQrMl0gPSBjb2xvclsyXVxuICAgICAgaW1hZ2UuZGF0YVtpKjQrM10gPSAyNTUgLy8g6YCP5piO5bqmXG4gICAgfVxuXG4gICAgcmV0dXJuIGltYWdlXG4gIH1cblxuICBjb2xvcihjb2xvcklkKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIFsweDc1LCAweDc1LCAweDc1XSwgWzB4MjcsIDB4MWIsIDB4OGZdLCBbMHgwMCwgMHgwMCwgMHhhYl0sIFsweDQ3LCAweDAwLCAweDlmXSxcbiAgICAgIFsweDhmLCAweDAwLCAweDc3XSwgWzB4YWIsIDB4MDAsIDB4MTNdLCBbMHhhNywgMHgwMCwgMHgwMF0sIFsweDdmLCAweDBiLCAweDAwXSxcbiAgICAgIFsweDQzLCAweDJmLCAweDAwXSwgWzB4MDAsIDB4NDcsIDB4MDBdLCBbMHgwMCwgMHg1MSwgMHgwMF0sIFsweDAwLCAweDNmLCAweDE3XSxcbiAgICAgIFsweDFiLCAweDNmLCAweDVmXSwgWzB4MDAsIDB4MDAsIDB4MDBdLCBbMHgwMCwgMHgwMCwgMHgwMF0sIFsweDAwLCAweDAwLCAweDAwXSxcbiAgICAgIFsweGJjLCAweGJjLCAweGJjXSwgWzB4MDAsIDB4NzMsIDB4ZWZdLCBbMHgyMywgMHgzYiwgMHhlZl0sIFsweDgzLCAweDAwLCAweGYzXSxcbiAgICAgIFsweGJmLCAweDAwLCAweGJmXSwgWzB4ZTcsIDB4MDAsIDB4NWJdLCBbMHhkYiwgMHgyYiwgMHgwMF0sIFsweGNiLCAweDRmLCAweDBmXSxcbiAgICAgIFsweDhiLCAweDczLCAweDAwXSwgWzB4MDAsIDB4OTcsIDB4MDBdLCBbMHgwMCwgMHhhYiwgMHgwMF0sIFsweDAwLCAweDkzLCAweDNiXSxcbiAgICAgIFsweDAwLCAweDgzLCAweDhiXSwgWzB4MDAsIDB4MDAsIDB4MDBdLCBbMHgwMCwgMHgwMCwgMHgwMF0sIFsweDAwLCAweDAwLCAweDAwXSxcbiAgICAgIFsweGZmLCAweGZmLCAweGZmXSwgWzB4M2YsIDB4YmYsIDB4ZmZdLCBbMHg1ZiwgMHg3MywgMHhmZl0sIFsweGE3LCAweDhiLCAweGZkXSxcbiAgICAgIFsweGY3LCAweDdiLCAweGZmXSwgWzB4ZmYsIDB4NzcsIDB4YjddLCBbMHhmZiwgMHg3NywgMHg2M10sIFsweGZmLCAweDliLCAweDNiXSxcbiAgICAgIFsweGYzLCAweGJmLCAweDNmXSwgWzB4ODMsIDB4ZDMsIDB4MTNdLCBbMHg0ZiwgMHhkZiwgMHg0Yl0sIFsweDU4LCAweGY4LCAweDk4XSxcbiAgICAgIFsweDAwLCAweGViLCAweGRiXSwgWzB4NzUsIDB4NzUsIDB4NzVdLCBbMHgwMCwgMHgwMCwgMHgwMF0sIFsweDAwLCAweDAwLCAweDAwXSxcbiAgICAgIFsweGZmLCAweGZmLCAweGZmXSwgWzB4YWIsIDB4ZTcsIDB4ZmZdLCBbMHhjNywgMHhkNywgMHhmZl0sIFsweGQ3LCAweGNiLCAweGZmXSxcbiAgICAgIFsweGZmLCAweGM3LCAweGZmXSwgWzB4ZmYsIDB4YzcsIDB4ZGJdLCBbMHhmZiwgMHhiZiwgMHhiM10sIFsweGZmLCAweGRiLCAweGFiXSxcbiAgICAgIFsweGZmLCAweGU3LCAweGEzXSwgWzB4ZTMsIDB4ZmYsIDB4YTNdLCBbMHhhYiwgMHhmMywgMHhiZl0sIFsweGIzLCAweGZmLCAweGNmXSxcbiAgICAgIFsweDlmLCAweGZmLCAweGYzXSwgWzB4YmMsIDB4YmMsIDB4YmNdLCBbMHgwMCwgMHgwMCwgMHgwMF0sIFsweDAwLCAweDAwLCAweDAwXVxuICAgIF1bY29sb3JJZF1cbiAgfVxufVxuIiwiaW1wb3J0IE5lc18gZnJvbSAnLi9uZXMnXG5pbXBvcnQgUm9tXyBmcm9tICcuL3JvbSdcbmltcG9ydCBSZW5kZXJlcl8gZnJvbSAnLi9yZW5kZXJlcidcblxuZXhwb3J0IGNvbnN0IE5lcyA9IE5lc19cbmV4cG9ydCBjb25zdCBSb20gPSBSb21fXG5leHBvcnQgY29uc3QgUmVuZGVyZXIgPSBSZW5kZXJlcl9cbiJdLCJuYW1lcyI6WyJVdGlsIiwiTmVzIiwiTmVzXyIsIlJvbSIsIlJvbV8iLCJSZW5kZXJlciIsIlJlbmRlcmVyXyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsa0JBQWU7RUFDZjtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBLEVBQUUsR0FBRyxFQUFFLElBQUk7RUFDWCxFQUFFLE1BQU0sRUFBRSxJQUFJO0VBQ2QsRUFBRSxNQUFNLEVBQUUsSUFBSTtFQUNkLEVBQUUsRUFBRSxFQUFFLE1BQU07RUFDWixFQUFFLE1BQU0sRUFBRTtFQUNWLElBQUksU0FBUyxHQUFHLENBQUM7RUFDakIsSUFBSSxTQUFTLEdBQUcsQ0FBQztFQUNqQixJQUFJLFNBQVMsR0FBRyxDQUFDO0VBQ2pCLElBQUksTUFBTSxNQUFNLENBQUM7RUFDakIsSUFBSSxRQUFRLElBQUksQ0FBQztFQUNqQixJQUFJLFVBQVUsRUFBRSxDQUFDO0VBQ2pCLElBQUksS0FBSyxPQUFPLENBQUM7RUFDakIsSUFBSSxNQUFNLE1BQU0sQ0FBQztFQUNqQixHQUFHO0VBQ0gsRUFBRSxFQUFFLEVBQUUsTUFBTTtFQUNaLENBQUM7O0VDOUJjLE1BQU0sR0FBRyxDQUFDO0VBQ3pCLEVBQUUsV0FBVyxHQUFHO0VBQ2hCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUM7RUFDekMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUU7RUFDakIsSUFBSSxLQUFLLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBQztFQUN2QyxHQUFHOztFQUVIO0VBQ0EsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtFQUNyQixJQUFJLEdBQUcsSUFBSSxJQUFJLE1BQU0sSUFBSSxJQUFJLElBQUksTUFBTSxFQUFFO0VBQ3pDLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBQztFQUNqQyxNQUFNLE1BQU07RUFDWixLQUFLOztFQUVMO0VBQ0EsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQUs7RUFDN0IsR0FBRzs7RUFFSDtFQUNBLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRTtFQUNiLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztFQUM1QixHQUFHO0VBQ0gsQ0FBQzs7RUMzQkQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQ25FLENBQUM7O0VDSEQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQ25FLENBQUM7O0VDSEQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQ25FLENBQUM7O0VDSEQ7QUFDQSxZQUFlO0VBQ2YsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQ25FLENBQUM7O0FDSEQsbUJBQWU7RUFDZjtFQUNBLEVBQUUsU0FBUyxFQUFFLFdBQVc7RUFDeEIsSUFBSSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEVB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RUFFSCxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNyQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLE1BQUs7RUFDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDcEQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBQztFQUM1QyxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFDO0VBQy9DLEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUM7RUFDL0MsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBRztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLE1BQUs7RUFDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDcEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFHO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBSztFQUNqQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUU7RUFDbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxNQUFLO0VBQ2pDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ3BELEdBQUc7O0VBRUgsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLE1BQUs7RUFDOUIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDcEQsR0FBRzs7RUFFSCxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsTUFBSztFQUM3QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxHQUFHOztFQUVILEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxNQUFLO0VBQzlCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ3BELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsTUFBSztFQUM5QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxHQUFHOztFQUVIO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUM7RUFDL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBQztFQUNwQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFHO0VBQ3RDLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBQztFQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFDO0VBQ3BDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ3BELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUc7RUFDdEMsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE9BQU8sSUFBSTtFQUNmLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxPQUFPLElBQUk7RUFDZixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFDO0VBQy9DLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQ3JDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ3BELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUM7RUFDL0MsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDckMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDcEQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRTtFQUMzQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFFO0VBQzNCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFNO0VBQ3ZDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFDO0VBQzVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ3BELEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUU7RUFDM0IsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU07RUFDdkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUM7RUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDcEQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7RUFDbEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRTtFQUMzQixJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTTtFQUN2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBQztFQUM1RCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBQztFQUNwRCxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFDakUsR0FBRzs7O0VBR0g7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztFQUNqRSxHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEVBQUU7RUFDdEIsSUFBSSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFNO0VBQy9DLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQzs7RUFFeEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBRztFQUN0QyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxFQUFDO0VBQzNELEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVztFQUNsQixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU07RUFDL0MsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxFQUFDOztFQUV2QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFHO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU07RUFDekQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUM7RUFDcEQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFJOztFQUUxQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFHO0VBQ3RDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLEVBQUM7RUFDM0QsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUM7RUFDcEQsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxLQUFJOztFQUV6QyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFHO0VBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU07RUFDekQsR0FBRzs7RUFFSDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU07RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxFQUFFO0VBQ3RCLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQzFELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU07RUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUM7RUFDckQsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDNUIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksRUFBRTtFQUN0QixJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBSzs7RUFFckQsSUFBSSxHQUFHLFlBQVksRUFBRTtFQUNyQixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEtBQUk7RUFDOUIsS0FBSztFQUNMLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsWUFBWTs7RUFFbkIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHOztFQUVIO0VBQ0EsRUFBRSxHQUFHLEVBQUUsV0FBVzs7RUFFbEIsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQTtFQUNBO0VBQ0E7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXO0VBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxHQUFHLEVBQUM7RUFDeEMsR0FBRzs7RUFFSDtFQUNBLEVBQUUsR0FBRyxFQUFFLFdBQVc7O0VBRWxCLEdBQUc7O0VBRUg7RUFDQSxFQUFFLEdBQUcsRUFBRSxXQUFXOztFQUVsQixHQUFHO0VBQ0gsQ0FBQzs7RUMvWmMsTUFBTUEsTUFBSSxDQUFDO0VBQzFCLEVBQUUsT0FBTyxXQUFXLENBQUMs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LE9BQU8sRUFBRTtFQUNqQixJQUFJLE9BQU87RUFDWCxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwRixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwRixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwRixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwRixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3BGLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUNwRixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7RUFDcEYsS0FBSyxDQUFDLE9BQU8sQ0FBQztFQUNkLEdBQUc7RUFDSCxDQUFDOztBQ3ZEVyxRQUFDQyxLQUFHLEdBQUdDLElBQUk7QUFDdkIsQUFBWSxRQUFDQyxLQUFHLEdBQUdDLElBQUk7QUFDdkIsQUFBWSxRQUFDQyxVQUFRLEdBQUdDOzs7Ozs7Ozs7Ozs7OzsifQ==
