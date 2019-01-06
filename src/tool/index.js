import Ppu from '../ppu'
import Renderer from '../renderer'

export default class Tool {
  constructor(rom) {
    this.rom = rom
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

      x += 9

      if (x >= 288) {
        x = 0
        y += 9
      }
    }
  }
}
