import xAx from '../0xAx'
import Cpu from '../../'

test('0xA2: LDX immediate', () => {
  const cpu = new Cpu()

  cpu.registers.pc = 0x0000
  cpu.ram.write(0x00, 0x01)

  xAx[2].bind(cpu).call()

  const indexX = cpu.registers.indexX
  expect(indexX).toBe(0x01)
})
