import { BaseRegister } from '../../utils'

export default class X4000 extends BaseRegister {
  dutyCycle() {
    return this.readBits(6, 7)
  }

  isDurationDisabled() {
    return this.readOneBit(5)
  }

  isDecayDisabled() {
    return this.readOneBit(4)
  }

  decayRate() {
    return this.readBits(0, 3)
  }
}
