import { BaseRegister } from '../../utils'

export default class X400c extends BaseRegister {
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
