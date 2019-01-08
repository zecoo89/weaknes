import Instructions from '../'
import Cpu from '../../'

describe('Instructions', () => {
  test('LSR', () => {
    const cpu = new Cpu()
    cpu.registers.acc = 0x08

    const LSR = Instructions.LSR.bind(cpu)

    LSR()

    const result = cpu.registers.acc

    expect(result).toBe(4)
  })
})
