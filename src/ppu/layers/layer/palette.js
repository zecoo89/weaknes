export default class Palette {
  constructor(addr) {
    this.startAddr = addr
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
  }

  select(paletteId, number) {
    const addr = this.startAddr + paletteId * 4 + number

    return this.vram.read(addr)
  }
}
