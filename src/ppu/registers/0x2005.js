import { BaseRegister } from '../../utils'

/* スクロールの設定を行う */
export default class X2005 extends BaseRegister {
  constructor(ppu) {
    super(ppu)

    this.horizontalScrollPosition_ = 0x00
    this.verticalScrollPosition_ = 0x00
  }

  write(bits) {
    if (this.w.isLatched()) {
      this.t.writeScrollX(bits)
      this.x.write(bits)
      this.verticalScrollPosition_ = bits
    } else {
      this.t.writeScrollY(bits)
      this.horizontalScrollPosition_ = bits
    }

    this.w.toggle()
  }

  get horizontalScrollPosition() {
    return this.horizontalScrollPosition_
  }

  get verticalScrollPosition() {
    return this.verticalScrollPosition_
  }
}
