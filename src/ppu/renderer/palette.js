export default class Palette {
  constructor(addr) {
    this.startAddr = addr
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
  }

  select(paletteId, number) {
    if(number < 0 || number > 3) throw new Error('number is 0 ~ 3.')

    if(number === 0) return this.vram.read(0x3f00)

    const addr = this.startAddr + paletteId * 4 + number

    return this.vram.read(addr)
  }
}
