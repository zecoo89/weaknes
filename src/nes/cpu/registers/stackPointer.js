import { BaseRegister } from '../../utils'

export default class StackPointer extends BaseRegister {
  constructor() {
    super()
    this.write(0x01fd)
  }

  write(value) {
    this.register = 0x0100 | value
  }

  increment() {
    const old = this.read()
    this.write(old+1)
  }

  decrement() {
    const old = this.read()
    this.write(old-1)
  }
}
