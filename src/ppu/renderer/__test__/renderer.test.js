import Renderer from '../renderer'

let renderer

beforeEach(() => (renderer = new Renderer()))

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
})
