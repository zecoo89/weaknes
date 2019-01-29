import Ppu from '../ppu'
import colors from '../ppu/renderer/colors'

export default class Tool {
  constructor(id, palette) {
    this.padding = 0
    this.ppu = new Ppu()
    this.id = id
    this.palette = palette

    let canvas = document.getElementById(id)
    this.context = canvas.getContext('2d')
    this.image = this.context.createImageData(8, 8)
  }

  set rom(rom) {
    this.ppu.chrRom = rom.chrRom
  }

  dumpChrRom() {
    const tiles = this.ppu.renderer.tiles

    for (let i = 0; i < tiles.length; i++) {
      const x = (i % 32) * (8 + this.padding)
      const y = ((i - (i % 32)) / 32) * (8 + this.padding)

      const tile = tiles.select(i)
      const image = this.tileImage(tile)
      this.context.putImageData(image, x, y)
    }
  }

  tileImage(tile) {
    for(let h=0;h<8;h++) {
      for(let w=0;w<8;w++) {
        const i = (h * 8 + w) * 4
        const tileBit = tile[h][w]
        const colorId = this.palette[tileBit]
        const color = colors[colorId]

        this.image.data[i] = color[0]
        this.image.data[i+1] = color[1]
        this.image.data[i+2] = color[2]
        this.image.data[i+3] = 255
      }
    }

    return this.image
  }
}
