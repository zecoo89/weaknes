import Bus from '../'
import Vram from '../../ppu/vram'

describe('Bus', () => {
  test('Write $2006 2 times', () => {
    const bus = new Bus()
    const vram = new Vram()
    bus.connect({vram})

    bus.write(0x2006, 0x12)
    bus.write(0x2006, 0x34)

    expect(vram.vp).toBe(0x1234)
  })
})
