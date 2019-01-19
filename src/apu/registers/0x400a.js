import BaseRegister from '../../utils/baseRegister'

export default class X400a extends BaseRegister {
  lowerBitsOfFrequency() {
    return this.read()
  }
}
