import { BaseRegister } from '../../utils'

export default class X4008 extends BaseRegister {
  isLinearCounterEnabled() {
    return this.readBitOne(7)
  }

  duration() {
    return this.readBits(0, 6)
  }
}
