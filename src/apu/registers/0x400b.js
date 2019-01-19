import { BaseRegister } from '../../utils'

export default class X400b extends BaseRegister {
  upperBitsOfFrequency() {
    return this.readBits(0, 2)
  }

  duration() {
    return this.readBits(3, 7)
  }
}
