import Util from './util'

export default {
  /* LD* (Load memory[addr) to * register)
   * フラグ
   *   - negative : 計算結果が負の値のとき1そうでなければ0(accの7bit目と同じ値になる)
   *   - zero : 計算結果がゼロのとき1そうでなければ0
   * */
  LDA: function(addr) {
    const value = this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },
  /* レジスタindexXにdataをロードする */
  LDX: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  LDY: function(addr) {
    const value = this.ram.read(addr)
    this.registers.indexY = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* ST* (Store memory[addr) to * register)
   * フラグ操作は無し
   * */
  STA: function(addr) {
    this.ram.write(addr, this.registers.acc)
  },

  STX: function(addr) {
    this.ram.write(addr, this.registers.indexX)
  },

  STY: function(addr) {
    this.ram.write(addr, this.registers.indexY)
  },

  /* T** (Transfer * register to * register)
   * フラグ
   *   - negative
   *   - zero
   * */
  TAX: function() {
    const value = this.registers.acc
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TAY: function() {
    const value = this.registers.acc
    this.registers.indexY = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TSX: function() {
    const value = this.registers.sp
    this.registers.indexX = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TXA: function() {
    const value = this.registers.indexX
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TXS: function() {
    const value = this.registers.indexX
    this.registers.sp = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  TYA: function() {
    const value = this.registers.indexY
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* acc & memory[addr)
   * フラグ
   *   - negative
   *   - zero
   * */
  AND: function(addr) {
    const value = this.registers.acc & this.ram.read(addr)
    this.registers.acc = value
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Aまたはメモリを左へシフト
   * フラグ
   *   - negative
   *   - zero
   *   - carry
   * */
  ASL: function(addr) {
    const value = this.ram.read(addr)
    const msb = Util.msb(value)
    this.ram.write(addr, value << 1)
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
    this.registers.statusCarry = msb
  },

  /* accまたはメモリを右へシフト
   * フラグ
   *   - negative
   *   - zero
   *   - carry
   * */
  LSR: function(addr) {
    const value = this.ram.read(addr)
    const lsb = Util.lsb(value)
    this.ram.write(addr, value >> 1)
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
    this.registers.statusCarry = lsb
  },

  /* AとメモリをAND演算してフラグを操作する
   * 演算結果は捨てる
   * */
  BIT: function(addr) {
    const memory = this.ram.read(addr)

    this.registers.statusZero = this.registers.acc & memory
    this.registers.statusNegative = memory >> 7
    this.registers.statusOverflow = (memory >> 6) & 0x01
  },

  /* Aとメモリを比較演算してフラグを操作
   * 演算結果は捨てる
   * A == mem -> Z = 0
   * A >= mem -> C = 1
   * A <= mem -> C = 0
   * */
  CMP: function(addr) {
    const result = this.registers.acc - this.ram.read(addr)

    if (result === 0) {
      this.registers.statusZero = 1
    } else {
      this.registers.statusZero = 0
      if (result > 0) {
        this.registers.statusCarry = 1
      } else {
        this.registers.statusCarry = 0
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
    this.ram.write(addr, this.ram.read(addr) + 1)
    const value = this.ram.read(addr)
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* メモリをデクリメント */
  DEC: function(addr) {
    this.ram.write(addr, this.ram.read(addr) - 1)
    const value = this.ram.read(addr)
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Xをインクリメントする */
  INX: function() {
    this.registers.indexX++
    const value = this.registers.indexX
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Yをインクリメントする */
  INY: function() {
    this.registers.indexY++
    const value = this.registers.indexY
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Xをデクリメント */
  DEX: function() {
    this.registers.indexX--
    const value = this.registers.indexX
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* Yをデクリメント*/
  DEY: function() {
    this.registers.indexY--
    const value = this.registers.indexY
    this.registers.statusNegative = Util.isNegative(value)
    this.registers.statusZero = Util.isZero(value)
  },

  /* accとメモリを論理XOR演算してaccに結果を返す*/
  EOR: function(addr) {
    this.registers.acc = this.registers.acc ^ this.ram.read(addr)
  },

  /* accとメモリを論理OR演算して結果をAへ返す */
  ORA: function(addr) {
    this.registers.acc = this.registers.acc | this.ram.read(addr)
  },

  /* メモリを左へローテートする */
  ROL: function(addr) {
    const carry = this.registers.statusCarry
    const msb = this.ram.read(addr) >> 7

    this.registers.statusCarry = msb
    this.ram.write(addr, (this.ram.read(addr) << 1) | carry)
  },

  /* accを左へローテートする
   * 実装を考えて、accの場合をROLと分離した
   * */
  RLA: function() {
    const carry = this.registers.statusCarry
    const msb = this.registers.acc >> 7

    this.registers.statusCarry = msb
    this.registers.acc = (this.registers.acc << 1) | carry
  },

  /* メモリを右へローテートする */
  ROR: function(addr) {
    const carry = this.registers.statusCarry << 7
    const lsb = this.ram.read(addr) & 0x01

    this.registers.statusCarry = lsb
    this.ram.write(addr, (this.ram.read(addr) >> 1) | carry)
  },

  /* accを右へローテートする
   * 実装を考えてaccの場合をRORと分離した
   * */
  RRA: function() {
    const carry = this.registers.statusCarry << 7
    const lsb = this.registers.acc & 0x01

    this.registers.statusCarry = lsb
    this.registers.acc = (this.registers.acc >> 1) | carry
  },

  /* acc + memory + carryFlag
   * フラグ
   *   - negative
   *   - overflow
   *   - zero
   *   - carry
   * */
  ADC: function(addr) {
    const added = this.registers.acc + this.ram.read(addr)
    this.registers.acc = added + this.registers.statusCarry
    this.registers.statusCarry = (added > 0xff) & 1
  },

  /* (acc - メモリ - キャリーフラグ)を演算してaccへ返す */
  SBC: function(addr) {
    const subed = this.registers.acc - this.ram.read(addr)
    this.registers.acc = subed - this.registers.statusCarry
    this.registers.statusCarry = (subed < 0x00) & 1
  },

  /* accをスタックにプッシュ */
  PHA: function() {},

  /* ステータス・レジスタをスタックにプッシュ */
  PHP: function() {
    this.stackPush(this.registers.statusAllRawBits)
  },

  /* スタックからaccにポップアップする */
  PLA: function() {
    this.registers.acc = this.stackPop()
  },

  /* スタックからPにポップアップする */
  PLP: function() {},

  /* アドレスへジャンプする */
  JMP: function(addr) {
    this.registers.pc = addr
  },

  /* サブルーチンを呼び出す
   * プログラムカウンタをスタックに積み、addrにジャンプする
   * */
  JSR: function(addr) {
    const highAddr = this.registers.pc >> 8
    const lowAddr = this.registers.pc & 0x00ff

    this.stackPush(lowAddr)
    this.stackPush(highAddr)
    this.registers.pc = addr
  },

  /* サブルーチンから復帰する */
  RTS: function() {
    const highAddr = this.stackPop()
    const lowAddr = this.stackPop()
    const addr = (highAddr << 8) | lowAddr
    this.registers.pc = addr
  },

  /* 割り込みルーチンから復帰する */
  RTI: function() {},

  /* キャリーフラグがクリアされているときにブランチする */
  BCC: function(addr) {
    const isBranchable = !this.registers.statusCarry

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* キャリーフラグがセットされているときにブランチする */
  BCS: function(addr) {
    const isBranchable = this.registers.statusCarry

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ゼロフラグがセットされているときにブランチする */
  BEQ: function(addr) {
    const isBranchable = this.registers.statusZero

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ゼロフラグがクリアされているときにブランチする*/
  BNE: function(addr) {
    const isBranchable = !this.registers.statusZero

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ネガティブフラグがセットされているときにブランチする */
  BMI: function(addr) {
    const isBranchable = this.registers.statusNegative

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* ネガティブフラグがクリアされているときにブランチする */
  BPL: function(addr) {
    const isBranchable = !this.registers.statusNegative

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* オーバーフローフラグがクリアされているときにブランチする*/
  BVC: function(addr) {
    const isBranchable = !this.registers.statusOverflow

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* オーバーフローフラグがセットされているときにブランチする */
  BVS: function(addr) {
    const isBranchable = this.registers.statusOverflow

    if (isBranchable) {
      this.registers.pc = addr
    }
  },

  /* キャリーフラグをセットする */
  SEC: function() {
    this.registers.statusCarry = 1
  },

  /* キャリーフラグをクリアします */
  CLC: function() {
    this.registers.statusCarry = 0
  },

  /* IRQ割り込みを許可する */
  CLI: function() {},

  /* オーバーフローフラグをクリアする */
  CLV: function() {},

  /* BCDモードに設定する NESには実装されていない */
  SED: function() {
    this.registers.statusDecimal = 1
  },

  /* BCDモードから通常モードに戻る NESには実装されていない */
  CLD: function() {
    this.registers.statusDecimal = 0
  },

  /* IRQ割り込みを禁止する
   * フラグ
   * interrupt をセットする
   * */
  SEI: function() {
    this.registers.statusInterrupt = 1
  },

  /* ソフトウェア割り込みを起こす*/
  BRK: function() {
    this.registers.statusBreak = 1
  },

  /* 空の命令を実行する */
  NOP: function() {
    // 何もしない
  }
}
