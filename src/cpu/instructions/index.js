import Util from "./util";

export default {
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
