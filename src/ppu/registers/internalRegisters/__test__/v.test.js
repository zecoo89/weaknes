import V from '../v'

describe('Internal register v', () => {
  test('writeCoarseX', () => {
    const v = new V()

    let x = 0
    v.writeCoarseX(++x)
    expect(v.register).toBe(1)
    v.writeCoarseX(++x)
    expect(v.register).toBe(2)
    v.writeCoarseX(++x)
    expect(v.register).toBe(3)
  })

  test('readCoarseX', () => {
    const v = new V()

    v.register = 1
    expect(v.readCoarseX()).toBe(1)
    v.register = 2
    expect(v.readCoarseX()).toBe(2)
    v.register = 3
    expect(v.readCoarseX()).toBe(3)
  })
})
