/* OAM(Object Attribute Memory)
 * スプライトの設定を保持するメモリ
 * */
export default class Oam {
  constructor() {
    this.pointer = 0x00
    this.pOffset = 0 // pointerからのオフセット(0~3)
    this.memory = new Array(0xff).fill(0)
  }

  connect(parts) {
    parts.cpu && (this.ram = parts.cpu.ram)
  }

  /* pointerの指すメモリにvalue(スプライトの設定)を書き込む
   * 1st byte: point y
   *
   * 2nd byte: tile index
   *
   * 3rd byte:
   * bit0-1: パレットの上位2bit
   * bit2-4: 無し
   * bit5: 背景の手前か奥かを決める(0: 手前, 1: 奥)
   * bit6: Horizontal inverted(0: clear, 1: set)
   * bit7: Vertical inverted(0: clear, 1: set)
   *
   * 4th byte: point x
   * */
  write(value) {
    const addr = this.pointer + this.pOffset++
    this.memory[addr] = value

    if (this.pOffset > 3) {
      this.pOffset = 0
    }
  }

  read(addr) {
    return this.memory[addr]
  }

  // DMA(Direct Memory Access)
  dma(value) {
    const start = value << 8
    const end = start + 0x100
    let addr = 0x00

    for (let i = start; i < end; i += 4) {
      for (let j = 0; j < 4; j++) {
        this.memory[addr++] = this.ram.read(i + j)
      }
    }
  }

  attrs() {
    const attrs_ = []

    for (let i = 0; i < 64; i++) {
      const attr = this.formatSpriteSettingData(i)
      attrs_.push(attr)
    }

    return attrs_
  }

  formatSpriteSettingData(id) {
    const baseAddr = id * 4
    return {
      x: this.memory[baseAddr + 3],
      y: this.memory[baseAddr + 0],
      tileId: this.memory[baseAddr + 1],
      ...this.extractAttr(this.memory[baseAddr + 2])
    }
  }

  extractAttr(attr) {
    const paletteId = attr & 0x03
    const priority = (attr >> 5) & 0x01
    const isHorizontalFlip = (attr >> 6) & 0x01
    const isVerticalFlip = (attr >> 7) & 0x01

    return {
      paletteId,
      priority,
      isHorizontalFlip,
      isVerticalFlip
    }
  }
}
