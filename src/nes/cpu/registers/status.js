import { BaseRegister } from '../../utils'

export default class Status extends BaseRegister {
  constructor() {
    super()
    this.write(0x24)
  }

  write(bits) {
    super.write(bits | 0x20)
  }

  get isNegative() {
    return this.readOneBit(7)
  }

  set isNegative(bit) {
    this.writeOneBit(7, bit)
  }

  get isOverflow() {
    return this.readOneBit(6)
  }

  set isOverflow(bit) {
    this.writeOneBit(6, bit)
  }

  get isBreakMode() {
    return this.readOneBit(4)
  }

  set isBreakMode(bit) {
    this.writeOneBit(4, bit)
  }

  get isDecimalMode() {
    return this.readOneBit(3)
  }

  set isDecimalMode(bit) {
    this.writeOneBit(3, bit)
  }


  get isInterruptDisabled() {
    return this.readOneBit(2)
  }

  set isInterruptDisabled(bit) {
    this.writeOneBit(2, bit)
  }

  get isZero() {
    return this.readOneBit(1)
  }

  set isZero(bit) {
    this.writeOneBit(1, bit)
  }

  get isCarry() {
    return this.readOneBit(0)
  }

  set isCarry(bit) {
    this.writeOneBit(0, bit)
  }
}
