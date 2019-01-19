import { BaseRegister } from '../../utils'

export default class X4003 extends BaseRegister {
  duration() {
    return this.readBits(3, 7)
  }

  timerHigh() {
    return this.readBits(0, 2)
  }
}
