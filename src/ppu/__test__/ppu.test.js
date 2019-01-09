import Ppu from '../ppu'

describe('PPU', () => {
  test('calculate a block position of a tile', () => {
    const ppu = new Ppu()

    expect(ppu.blockPosition(4)).toBe(2)
    expect(ppu.blockPosition(5)).toBe(2)
    expect(ppu.blockPosition(6)).toBe(3)
    expect(ppu.blockPosition(7)).toBe(3)
    expect(ppu.blockPosition(36)).toBe(2)
    expect(ppu.blockPosition(68)).toBe(18)
    expect(ppu.blockPosition(100)).toBe(18)
  })

  test('calculate a bit position of a block', () => {
    const ppu = new Ppu()

    expect(ppu.bitPosition(4)).toBe(0)
    expect(ppu.bitPosition(5)).toBe(1)
    expect(ppu.bitPosition(6)).toBe(0)
    expect(ppu.bitPosition(7)).toBe(1)
    expect(ppu.bitPosition(36)).toBe(2)
    expect(ppu.bitPosition(37)).toBe(3)
  })
})
