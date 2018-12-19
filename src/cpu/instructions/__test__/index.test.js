import Instructions from '../../instructions'
import Cpu from '../../'

describe('Instructions', () => {
  test('LDA assigns data to indexX', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x01, 0xff)
    const LDA = Instructions.LDA.bind(cpu)
    LDA(0x01)

    expect(cpu.registers.acc).toBe(0xff)
  })

  test('LDX assigns data to indexX', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x01, 0xff)
    const LDX = Instructions.LDX.bind(cpu)
    LDX(0x01)

    expect(cpu.registers.indexX).toBe(0xff)
  })

  test('LDY assigns data to indexY', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x01, 0xff)
    const LDY = Instructions.LDY.bind(cpu)
    LDY(0x01)

    expect(cpu.registers.indexY).toBe(0xff)
  })

  test("STA stores acc's data to memory", () => {
    const cpu = new Cpu()
    cpu.registers.acc = 0xff
    const STA = Instructions.STA.bind(cpu)
    STA(0x03)

    expect(cpu.ram.read(0x03)).toBe(0xff)
  })

  test("STX stores indexX's data to memory", () => {
    const cpu = new Cpu()
    cpu.registers.indexX = 0xff
    const STX = Instructions.STX.bind(cpu)
    STX(0x03)

    expect(cpu.ram.read(0x03)).toBe(0xff)
  })

  test("STY stores indexY's data to memory", () => {
    const cpu = new Cpu()
    cpu.registers.indexY = 0xff
    const STY = Instructions.STY.bind(cpu)
    STY(0x03)

    expect(cpu.ram.read(0x03)).toBe(0xff)
  })

  test("TAX transfers acc's data to indexX", () => {
    const cpu = new Cpu()
    cpu.registers.acc = 0xff
    const TAX = Instructions.TAX.bind(cpu)
    TAX()

    expect(cpu.registers.indexX).toBe(0xff)
  })

  test("TAY transfers acc's data to indexY", () => {
    const cpu = new Cpu()
    cpu.registers.acc = 0xff
    const TAY = Instructions.TAY.bind(cpu)
    TAY()

    expect(cpu.registers.indexY).toBe(0xff)
  })

  test("TSX transfers sp's data to indexX", () => {
    const cpu = new Cpu()
    cpu.registers.sp = 0xff
    const TSX = Instructions.TSX.bind(cpu)
    TSX()

    expect(cpu.registers.indexX).toBe(0xff)
  })

  test("TXA transfers indexX's data to acc", () => {
    const cpu = new Cpu()
    cpu.registers.indexX = 0xff
    const TXA = Instructions.TXA.bind(cpu)
    TXA()

    expect(cpu.registers.acc).toBe(0xff)
  })

  test("TXS transfers indexX's data to sp", () => {
    const cpu = new Cpu()
    cpu.registers.indexX = 0xff
    const TXS = Instructions.TXS.bind(cpu)
    TXS()

    expect(cpu.registers.sp).toBe(0xff)
  })

  test("TYA transfers indexY's data to acc", () => {
    const cpu = new Cpu()
    cpu.registers.indexY = 0xff
    const TYA = Instructions.TYA.bind(cpu)
    TYA()

    expect(cpu.registers.acc).toBe(0xff)
  })

  test('ASL shift memory to 1bit left', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x01, 0x01)
    const ASL = Instructions.ASL.bind(cpu)

    ASL(0x01)

    expect(cpu.ram.read(0x01)).toBe(0x02)
  })

  test('LSR shift memory to 1bit right', () => {
    const cpu = new Cpu()
    cpu.ram.write(0x01, 0x02)
    const LSR = Instructions.LSR.bind(cpu)

    LSR(0x01)

    expect(cpu.ram.read(0x01)).toBe(0x01)
  })
})
