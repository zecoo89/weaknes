export default class Register {
  constructor() {
    this.acc_ = 0x00 // アキュムレータ：汎用演算
    this.indexX_ = 0x00 // アドレッシング、カウンタ等に用いる
    this.indexY_ = 0x00 // 上に同じ
    this.sp_ = 0x01fd // スタックポインタ $0100-$01FF, 初期値は0x01fdっぽい
    this.status_ = 0x24
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
    this.pc = 0x8000 // プログラムカウンタ
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
    this.status_ = bits
    this.statusReserved = 1 // reservedは常に1にセットされている
  }

  get acc() {
    return this.acc_
  }

  set acc(value) {
    this.acc_ = value & 0xff
  }

  get indexX() {
    return this.indexX_
  }

  set indexX(value) {
    this.indexX_ = value & 0xff
  }

  get indexY() {
    return this.indexY_
  }

  set indexY(value) {
    this.indexY_ = value & 0xff
  }

  get sp() {
    return this.sp_
  }

  set sp(value) {
    this.sp_ = 0x0100 | value
  }

  get statusNegative() {
    return this.status_ >> 7
  }

  set statusNegative(bit) {
    this.status_ = this.status_ & 0x7f // 0111 1111
    this.status_ = this.status_ | (bit << 7)
  }

  get statusOverflow() {
    return (this.status_ >> 6) & 0x01
  }

  set statusOverflow(bit) {
    this.status_ = this.status_ & 0xbf // 1011 1111
    this.status_ = this.status_ | (bit << 6)
  }

  get statusReserved() {
    return (this.status_ >> 5) & 0x01
  }

  set statusReserved(bit) {
    this.status_ = this.status_ & 0xdf // 1101 1111
    this.status_ = this.status_ | (bit << 5)
  }

  get statusBreak() {
    return (this.status_ >> 4) & 0x01
  }

  set statusBreak(bit) {
    this.status_ = this.status_ & 0xef // 1110 1111
    this.status_ = this.status_ | (bit << 4)
  }

  get statusDecimal() {
    return (this.status_ >> 3) & 0x01
  }

  set statusDecimal(bit) {
    this.status_ = this.status_ & 0xf7 // 1111 0111
    this.status_ = this.status_ | (bit << 3)
  }

  get statusInterrupt() {
    return (this.status_ >> 2) & 0x01
  }

  set statusInterrupt(bit) {
    this.status_ = this.status_ & 0xfb // 1111 1011
    this.status_ = this.status_ | (bit << 2)
  }

  get statusZero() {
    return (this.status_ >> 1) & 0x01
  }

  set statusZero(bit) {
    this.status_ = this.status_ & 0xfd // 1111 1101
    this.status_ = this.status_ | (bit << 1)
  }

  get statusCarry() {
    return this.status_ & 0x01
  }

  set statusCarry(bit) {
    this.status_ = this.status_ & 0xfe // 1111 1110
    this.status_ = this.status_ | bit
  }
}
