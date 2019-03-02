import { BaseRegister } from '../../utils'

export default class ProgramCounter extends BaseRegister {
  constructor(cpu) {
    super(cpu)
  }

  write(bits) {
    this.register = bits & 0xffff
  }

  init(addr) {
    this.write(addr)
  }

  increment() {
    const old = this.read()
    this.write(old+1)
  }
}
