import { BaseRegister } from '../../utils'

export default class X400a extends BaseRegister {
  lowerBitsOfFrequency() {
    return this.read()
  }
}
