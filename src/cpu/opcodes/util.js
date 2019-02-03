import Addressing from '../addressing'
import Instructions from '../instructions'

export default class Util {
  static debugString(instruction, addressing, value_, addrOfOpcode) {
    let prefix = '$'
    let value

    if (addressing.name === 'immediate') {
      prefix = '#$'
      value = this.ram.read(value_)
    } else if (addressing.name === 'implied') {
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

  static debug(opcode) {
    let addrOfOpcode
    addrOfOpcode = this.registers.pc - 1

    const addressingName = opcode.addressing

    if (!Addressing[addressingName]) {
      throw new Error(opcode.instruction + ' ' + opcode.addressing)
    }

    const addressing = Addressing[addressingName].bind(this)
    const addr = addressing.call()

    const instructionName = opcode.instruction

    if (!Instructions[instructionName]) {
      throw new Error(opcode.instruction + ' ' + opcode.addressing)
    }

    const instruction = Instructions[instructionName].bind(this, addr)

    Util.debugString.call(this, instruction, addressing, addr, addrOfOpcode)

    instruction.call()

    return opcode.cycle
  }

  static execute(opcode) {
    const addressingName = opcode.addressing
    const addressing = Addressing[addressingName].bind(this)
    const addr = addressing()

    const instructionName = opcode.instruction
    const instruction = Instructions[instructionName].bind(this, addr)

    instruction()

    return opcode.cycle
  }
}
