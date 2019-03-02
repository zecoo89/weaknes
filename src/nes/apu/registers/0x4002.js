import { BaseRegister } from '../../utils'

export default class X4002 extends BaseRegister {
  timerLow() {
    return this.read()
  }
}
