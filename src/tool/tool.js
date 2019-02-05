import colors from '../ppu/renderer/colors'

export default class Tool {
  constructor(nes) {
    this.nes = nes
  }

  set rom(rom) {
    this.ppu.rom = rom
    this.cpu.rom = rom
  }

  dumpChrRom(id, palette) {
    const canvas = document.getElementById(id)
    const context = canvas.getContext('2d')
    const image = context.createImageData(8, 8)
    const tiles = this.nes.ppu.renderer.tiles

    for (let i = 0; i < tiles.length; i++) {
      const x = (i % 32) * 8
      const y = ((i - (i % 32)) / 32) * 8

      const tile = tiles.select(i)
      const tileImage = this.tileImage(image, palette, tile)

      context.putImageData(tileImage, x, y)
    }
  }

  dumpPalette(id) {
    setTimeout(this._dumpPalette.bind(this, id), 500)
    setTimeout(this._dumpPalette.bind(this, id), 1000)
    setTimeout(this._dumpPalette.bind(this, id), 1500)
  }

  _dumpPalette(id) {
    const canvas = document.getElementById(id)
    const context = canvas.getContext('2d')

    /* 0x3f00 ~ 0x3f0f */
    const bgPaletteStartAddr = 0x3f00
    this.drawPalette(context, bgPaletteStartAddr, 0)

    /* 0x3f10 ~ 0x3f1f */
    const spPaletteStartAddr = 0x3f10
    this.drawPalette(context, spPaletteStartAddr, 1)
  }

  drawPalette(context, baseAddr, line) {
    let j = 0
    for(let i=0;i<16;i++) {
      const colorId = this.nes.ppu.vram.read(baseAddr + i)
      const color = colors[colorId]

      context.fillStyle = 'rgb(' + color.join(',') + ')'
      j = i % 4 === 0 && i !== 0 ? j+2: j
      context.fillRect(i*15+j, line*17, 15, 15)
    }
  }

  tileImage(image, palette, tile) {
    for(let h=0;h<8;h++) {
      for(let w=0;w<8;w++) {
        const i = (h * 8 + w) * 4
        const tileBit = tile[h][w]
        const colorId = palette[tileBit]
        const color = colors[colorId]

        image.data[i] = color[0]
        image.data[i+1] = color[1]
        image.data[i+2] = color[2]
        image.data[i+3] = 255
      }
    }

    return image
  }
}
