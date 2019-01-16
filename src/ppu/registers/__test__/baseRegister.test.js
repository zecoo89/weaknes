import BaseRegister from '../baseRegister'

let register

beforeEach(() => {
  register = new BaseRegister()
})

describe('BaseRegister', () => {
  test('readOneBit', () => {
    register.write(0b01010101)
    const first = register.readOneBit(0)
    const second = register.readOneBit(1)

    expect(first).toBe(1)
    expect(second).toBe(0)
  })

  test('writeOneBit', () => {
    register.writeOneBit(0, 1)

    let result = register.read()
    expect(result).toBe(1)

    register.writeOneBit(2, 1)

    result = register.read()
    expect(result).toBe(0b101)
  })

  test('readBits', () => {
    register.write(0b01010101)
    const result = register.readBits(0, 2)

    expect(result).toBe(0b101)
  })

  test('writeBits', () => {
    register.write(0b11100011)
    register.writeBits(2, 4, 0b111)
    let result = register.read()
    expect(result).toBe(0b11111111)


    register.write(0b11100011)
    register.writeBits(2, 4, 0b010)
    result = register.read()
    expect(result).toBe(0b11101011)
  })
})
