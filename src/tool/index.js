import Ppu from '../ppu'
import Renderer from '../renderer'

export default class Tool {
  constructor(rom) {
    this.rom = rom
    this.padding = 2
  }

  dumpChrRom(id, palette) {
    const ppu = new Ppu()
    const renderer = new Renderer(id)

    ppu.chrRom = this.rom.chrRom
    const tiles = ppu.tiles

    let x = 0,
      y = 0

    for (let i = 0; i < tiles.length; i++) {
      const image = renderer.generateTileImage(tiles[i], palette)
      renderer.renderSprite(image, x, y)

      x += 8 + this.padding

      if (x >= (8 + this.padding) * 32) {
        x = 0
        y += 8 + this.padding
      }
    }
  }
}
