import Loader from '../loader'

let loader

beforeEach(() => (loader = new Loader()))

describe('Loader', () => {
  test('calculate a byte offset of a tile', () => {
    expect(loader.byteOffset(0)).toBe(0)
    expect(loader.byteOffset(1)).toBe(0)
    expect(loader.byteOffset(32)).toBe(0)
    expect(loader.byteOffset(33)).toBe(0)
    expect(loader.byteOffset(4)).toBe(1)
    expect(loader.byteOffset(5)).toBe(1)
    expect(loader.byteOffset(36)).toBe(1)
    expect(loader.byteOffset(37)).toBe(1)
    expect(loader.byteOffset(6)).toBe(1)
    expect(loader.byteOffset(7)).toBe(1)
    expect(loader.byteOffset(38)).toBe(1)
    expect(loader.byteOffset(39)).toBe(1)
  })

  test('calculate a block offset of a byte', () => {
    expect(loader.blockOffset(0)).toBe(0)
    expect(loader.blockOffset(1)).toBe(0)
    expect(loader.blockOffset(32)).toBe(0)
    expect(loader.blockOffset(33)).toBe(0)
    expect(loader.blockOffset(4)).toBe(0)
    expect(loader.blockOffset(5)).toBe(0)
    expect(loader.blockOffset(36)).toBe(0)
    expect(loader.blockOffset(37)).toBe(0)
    expect(loader.blockOffset(6)).toBe(1)
    expect(loader.blockOffset(7)).toBe(1)
    expect(loader.blockOffset(38)).toBe(1)
    expect(loader.blockOffset(39)).toBe(1)
  })
})
