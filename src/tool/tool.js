import colors from '../ppu/layers/layer/colors'

export default class Tool {
  constructor(nes) {
    this.nes = nes
  }

  dumpBackground(id, isShadowEnabled) {
    const width = 256 * 2
    const height = 240 * 2
    const canvas = document.getElementById(id)
    const context = canvas.getContext('2d')
    const image = context.createImageData(width, height)
    const bg = this.nes.ppu.loader.bgLayer
    const sx = this.nes.ppu.registers[0x2005].horizontalScrollPosition()
    const sy = this.nes.ppu.registers[0x2005].verticalScrollPosition()
    const mainScreenNumber = this.nes.ppu.registers[0x2000].mainScreenNumber()
    const ox = (mainScreenNumber & 0b1) * 256
    const oy = (mainScreenNumber >> 1) * 240
    const tx = sx + ox
    const ty = sy + oy
    const ex = this.nes.ppu.renderer.endX
    const ey = this.nes.ppu.renderer.endY

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const pixel = bg.getPixel(x % ex, y % ey)
        const rgb = pixel.rgb()

        if (isShadowEnabled) {
          const isAreaX =
            (x >= tx && x < tx + 256) ||
            (x < (tx + 256) % width && tx + 256 != (tx + 256) % width)
          const isAreaY =
            (y >= ty && y < ty + 240) ||
            (y < (ty + 240) % height && ty + 240 != (ty + 240) % height)

          if (isAreaX && isAreaY) {
            this.setPixel(image, i, rgb, 255)
          } else {
            this.setPixel(image, i, rgb, 150)
          }
        } else {
          this.setPixel(image, i, rgb, 255)
        }
      }
    }
    context.putImageData(image, 0, 0)
  }

  dumpChrRom(id, palette) {
    const canvas = document.getElementById(id)
    const context = canvas.getContext('2d')
    const image = context.createImageData(8, 8)
    const tiles = this.nes.ppu.loader.tiles

    for (let i = 0; i < tiles.length; i++) {
      const x = (i % 32) * 8
      const y = ((i - (i % 32)) / 32) * 8

      const tile = tiles.select(i)
      const tileImage = this.tileImage(image, palette, tile)

      context.putImageData(tileImage, x, y)
    }
  }

  dumpPalette(id) {
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
    for (let i = 0; i < 16; i++) {
      const colorId = this.nes.ppu.vram.read(baseAddr + i)
      const color = colors[colorId]

      context.fillStyle = 'rgb(' + color.join(',') + ')'
      j = i % 4 === 0 && i !== 0 ? j + 2 : j
      context.fillRect(i * 15 + j, line * 17, 15, 15)
    }
  }

  tileImage(image, palette, tile) {
    for (let h = 0; h < 8; h++) {
      for (let w = 0; w < 8; w++) {
        const i = (h * 8 + w) * 4
        const tileBit = tile[h][w]
        const colorId = palette[tileBit]
        const color = colors[colorId]

        this.setPixel(image, i, color, 255)
      }
    }

    return image
  }

  setPixel(image, i, rgb, alpha) {
    image.data[i] = rgb[0]
    image.data[i + 1] = rgb[1]
    image.data[i + 2] = rgb[2]
    image.data[i + 3] = alpha
  }
}
