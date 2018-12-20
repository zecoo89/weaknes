import Addressing from '../../addressing'
import Cpu from '../../'

describe('Addressing', () => {
  test('implied', () => {
    const addr = Addressing.implied()

    expect(addr).toBe(null)
  })
  test('immediate', () => {
    const cpu = new Cpu()
    cpu.registers.pc = 0x0001

    const immediate = Addressing.immediate.bind(cpu)
    const addr = immediate()
    expect(addr).toBe(0x01)
  })

  test('zeropage', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.registers.pc = 0x0001

    const zeropage = Addressing.zeropage.bind(cpu)
    const addr = zeropage()
    expect(addr).toBe(0x02)
  })

  test('zeropageX', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.registers.pc = 0x0001
    cpu.registers.indexX = 0x01

    const zeropageX = Addressing.zeropageX.bind(cpu)
    const addr = zeropageX()
    expect(addr).toBe(0x03)
  })

  test('zeropageY', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.ram.write(0x02, 0x03)
    cpu.registers.pc = 0x0001
    cpu.registers.indexY = 0x01

    const zeropageY = Addressing.zeropageY.bind(cpu)
    const addr = zeropageY()
    expect(addr).toBe(0x03)
  })

  test('absolute', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.registers.pc = 0x0000

    const absolute = Addressing.absolute.bind(cpu)
    const addr = absolute()
    expect(addr).toBe(0x201)
  })

  test('absoluteX', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.registers.pc = 0x0000
    cpu.registers.indexX = 0x02

    const absoluteX = Addressing.absoluteX.bind(cpu)
    const addr = absoluteX()
    expect(addr).toBe(0x203)
  })

  test('absoluteY', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.registers.pc = 0x0000
    cpu.registers.indexY = 0x02

    const absoluteY = Addressing.absoluteY.bind(cpu)
    const addr = absoluteY()
    expect(addr).toBe(0x203)
  })

  test('indirect', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x00)
    cpu.ram.write(0x01, 0x01)
    cpu.ram.write(0x0100, 0x0012)
    cpu.registers.pc = 0x0000

    const indirect = Addressing.indirect.bind(cpu)
    const address = indirect()
    expect(address).toBe(0x0012)
  })

  test('indexIndirect', () => {
    const cpu = new Cpu()
    cpu.registers.indexX = 0x02
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x03, 0x00)
    cpu.ram.write(0x04, 0x01)
    cpu.registers.pc = 0x0000

    const indexIndirect = Addressing.indexIndirect.bind(cpu)
    const addr = indexIndirect()
    expect(addr).toBe(0x0100)
  })

  test('indirectIndex', () => {
    const cpu = new Cpu()
    cpu.registers.indexY = 0x02
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x00)
    cpu.ram.write(0x02, 0x01)
    cpu.registers.pc = 0x0000

    const indirectIndex = Addressing.indirectIndex.bind(cpu)
    const addr = indirectIndex()
    expect(addr).toBe(0x0102)
  })

  test('relative(offset >= 0)', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0x02)
    cpu.ram.write(0x02, 0x03)
    cpu.registers.pc = 0x0001

    const relative = Addressing.relative.bind(cpu)
    const addr = relative()
    expect(addr).toBe(0x04)
  })

  test('relative(offset < 0)', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x00, 0x01)
    cpu.ram.write(0x01, 0xfe)
    cpu.ram.write(0x02, 0x03)
    cpu.registers.pc = 0x0001

    const relative = Addressing.relative.bind(cpu)
    const addr = relative()
    expect(addr).toBe(0x00)
  })
})
