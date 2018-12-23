import Addressing from '../addressing'
import Instructions from '../instructions'

export default class Util {
  static debugString(instruction, addressing, value_, addrOfOpcode) {
    let prefix = '$'
    let value

    if (addressing.name === 'bound immediate') {
      prefix = '#$'
      value = this.ram.read(value_)
    } else if (addressing.name === 'bound implied') {
      prefix = ''
      value = ''
    } else {
      value = value_
    }

    if (value === null || value === undefined) {
      value = ''
    } else {
      value = value.toString(16)
    }

    const prefixAndValue = prefix + value
    const chars = [
      addrOfOpcode.toString(16),
      instruction.name.split(' ')[1],
      addressing.name.split(' ')[1],
      prefixAndValue,
      this.registers.debugString()
    ].join(' ')

    // eslint-disable-next-line no-console
    console.log(chars)
  }

  static execute(instructionName, addressingName) {
    let addrOfOpcode
    if (this.isDebug) {
      addrOfOpcode = this.registers.pc - 1
    }

    const addressing = Addressing[addressingName].bind(this)
    const addr = addressing.call()

    const instruction = Instructions[instructionName].bind(this, addr)

    if (this.isDebug) {
      Util.debugString.call(this, instruction, addressing, addr, addrOfOpcode)
    }

    instruction.call()
  }
}
