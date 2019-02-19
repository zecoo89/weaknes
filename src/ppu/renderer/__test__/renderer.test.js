import Renderer from '../renderer'

let renderer

beforeEach(() => renderer = new Renderer)

describe('Renderer', () => {
  test('calculate a byte offset of a tile', () => {
    expect(renderer.byteOffset(0)).toBe(0)
    expect(renderer.byteOffset(1)).toBe(0)
    expect(renderer.byteOffset(32)).toBe(0)
    expect(renderer.byteOffset(33)).toBe(0)
    expect(renderer.byteOffset(4)).toBe(1)
    expect(renderer.byteOffset(5)).toBe(1)
    expect(renderer.byteOffset(36)).toBe(1)
    expect(renderer.byteOffset(37)).toBe(1)
    expect(renderer.byteOffset(6)).toBe(1)
    expect(renderer.byteOffset(7)).toBe(1)
    expect(renderer.byteOffset(38)).toBe(1)
    expect(renderer.byteOffset(39)).toBe(1)
  })

  test('calculate a block offset of a byte', () => {
    expect(renderer.blockOffset(0)).toBe(0)
    expect(renderer.blockOffset(1)).toBe(0)
    expect(renderer.blockOffset(32)).toBe(0)
    expect(renderer.blockOffset(33)).toBe(0)
    expect(renderer.blockOffset(4)).toBe(0)
    expect(renderer.blockOffset(5)).toBe(0)
    expect(renderer.blockOffset(36)).toBe(0)
    expect(renderer.blockOffset(37)).toBe(0)
    expect(renderer.blockOffset(6)).toBe(1)
    expect(renderer.blockOffset(7)).toBe(1)
    expect(renderer.blockOffset(38)).toBe(1)
    expect(renderer.blockOffset(39)).toBe(1)
  })

  test('nametable addr belonging to attribute table', () => {
    let addrs = renderer.nametableBelongingToAttr(0x23c0, 0x2000)

    expect(addrs[0]).toBe(0)
    expect(addrs[1]).toBe(1)
    expect(addrs[2]).toBe(0x20)
    expect(addrs[3]).toBe(0x21)

    addrs = renderer.nametableBelongingToAttr(0x23d0, 0x2000)
    expect(addrs[0]).toBe(0x40)
    expect(addrs[1]).toBe(0x41)
    expect(addrs[2]).toBe(0x60)
    expect(addrs[3]).toBe(0x61)
  })
})
