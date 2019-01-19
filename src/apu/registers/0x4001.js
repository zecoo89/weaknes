import { BaseRegister } from '../../utils'

export default class X4001 extends BaseRegister {
  isSweepEnabled() {
    return this.readOneBit(7)
  }

  sweepRate() {
    return this.readBits(4, 6)
  }

  isSweepUpper() {
    return this.readOneBit(3)
  }

  sweepQuantity() {
    return this.readBits(0, 2)
  }
}
