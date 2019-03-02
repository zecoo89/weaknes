import T from '../t'

let t

beforeEach(() => (t = new T()))

describe('Internal register t', () => {
  test('writeScrollX', () => {
    t.writeScrollX(255)
    expect(t.register).toBe(31)
  })

  test('writeScrollY', () => {
    t.writeScrollY(255)
    expect(t.register).toBe(0b111001111100000)
  })

  test('writeScreenNumber', () => {
    t.writeScreenNumber(0b11)
    expect(t.register).toBe(0b000110000000000)
  })
})
