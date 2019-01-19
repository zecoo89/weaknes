import BaseRegister from '../../utils/baseRegister'

export default class X400f extends BaseRegister {
  duration() {
    return this.readBits(3, 7)
  }
}
