import BaseRegister from '../../utils/baseRegister'

/* スクロールの設定を行う */
export default class X2005 extends BaseRegister {
  constructor(ppu) {
    super(ppu)

    this.horizontalScrollPosition_ = 0x00
    this.verticalScrollPosition_ = 0x00
    this.isFirst = true
  }

  resetRewriteCycles() {
    this.isFirst = true
  }

  write(bits) {
    if(this.isFirst) {
      this.horizontalScrollPosition_ = bits
    } else {
      this.verticalScrollPosition_ = bits
    }

    this.isFirst = this.isFirst ? false : true
  }

  get horizontalScrollPosition() {
    return this.horizontalScrollPosition_
  }

  get verticalScrollPosition() {
    return this.verticalScrollPosition_
  }
}
