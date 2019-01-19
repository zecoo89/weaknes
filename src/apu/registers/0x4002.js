import BaseRegister from '../../utils/baseRegister'

export default class X4002 extends BaseRegister {
  timerLow() {
    return this.read()
  }
}
