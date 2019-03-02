import { BaseRegister } from '../../utils'

export default class X400f extends BaseRegister {
  duration() {
    return this.readBits(3, 7)
  }
}
