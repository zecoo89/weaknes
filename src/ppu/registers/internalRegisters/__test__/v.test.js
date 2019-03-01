import V from '../v'

let v

beforeEach(() => (v = new V()))

describe('Internal register v', () => {
  test('writeCoarseX', () => {
    v.writeCoarseX(1)
    expect(v.register).toBe(1)
    v.writeCoarseX(2)
    expect(v.register).toBe(2)
    v.writeCoarseX(3)
    expect(v.register).toBe(3)

    v.writeCoarseX(31)
    expect(v.register).toBe(31)
    v.writeCoarseX(32)
    expect(v.register).toBe(0)
  })

  test('readCoarseX', () => {
    v.register = 1
    expect(v.readCoarseX()).toBe(1)
    v.register = 2
    expect(v.readCoarseX()).toBe(2)

    v.register = 31
    expect(v.readCoarseX()).toBe(31)
  })

  test('writeCoarseY', () => {
    v.writeCoarseY(1)
    expect(v.register).toBe(0b100000)
    v.writeCoarseY(2)
    expect(v.register).toBe(0b1000000)

    v.writeCoarseY(31)
    expect(v.register).toBe(0b1111100000)
    v.writeCoarseY(32)
    expect(v.register).toBe(0)
  })

  test('readCoarseY', () => {
    v.register = 0x0020
    expect(v.readCoarseY()).toBe(1)
    v.register = 0x0040
    expect(v.readCoarseY()).toBe(2)

    v.register = 0b1111100000
    expect(v.readCoarseY()).toBe(31)
  })

  test('writeFineY', () => {
    v.writeFineY(1)
    expect(v.register).toBe(0x1000)
    v.writeFineY(2)
    expect(v.register).toBe(0x2000)
    v.writeFineY(3)
    expect(v.register).toBe(0x3000)
    v.writeFineY(4)
    expect(v.register).toBe(0x4000)
    v.writeFineY(5)
    expect(v.register).toBe(0x5000)
    v.writeFineY(6)
    expect(v.register).toBe(0x6000)
    v.writeFineY(7)
    expect(v.register).toBe(0x7000)

    v.writeFineY(8)
    expect(v.register).toBe(0x0000)
  })

  test('readFineY', () => {
    v.register = 0x1000
    expect(v.readFineY()).toBe(1)
    v.register = 0x2000
    expect(v.readFineY()).toBe(2)
    v.register = 0x3000
    expect(v.readFineY()).toBe(3)
  })

  test('writeNametable', () => {
    v.writeNametable(0b1)
    expect(v.register).toBe(0b000010000000000)
    v.writeNametable(0b11)
    expect(v.register).toBe(0b000110000000000)

    v.writeNametable(0b111)
    expect(v.register).toBe(0b000110000000000)
    v.writeNametable(0b100)
    expect(v.register).toBe(0)
  })

  test('readNametable', () => {
    v.register = 0b000010000000000
    expect(v.readNametable()).toBe(1)
    v.register = 0b000110000000000
    expect(v.readNametable()).toBe(0b11)
  })
})
