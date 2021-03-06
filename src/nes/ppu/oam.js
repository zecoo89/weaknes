/* OAM(Object Attribute Memory)
 * スプライトの設定を保持するメモリ
 * */
export default class Oam {
  constructor() {
    this.init()
  }

  connect(parts) {
    parts.cpu && (this.cpu = parts.cpu)
    parts.ppu && (this.ppu = parts.ppu)
  }

  init() {
    this.pOffset = 0 // pointerからのオフセット(0~3)
    this.memory = new Array(0x100).fill(0)
    this._attrs = this.createAttrs()
    this._zeroSpritePosition = {
      x: null,
      y: null
    }
  }

  createAttrs() {
    const attrs = new Array(64)

    for (let i = 0; i < attrs.length; i++) {
      attrs[i] = {
        x: null,
        y: null,
        tileId: null,
        paletteId: null,
        priority: null,
        isHorizontalFlip: null,
        isVerticalFlip: null
      }
    }

    return attrs
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
    const pointer = this.ppu.registers[0x2003].read()
    const addr = pointer + this.pOffset++
    this.memory[addr] = value

    if (this.pOffset > 3) {
      this.pOffset = 0
      this.formatSpriteSettingData(pointer % 4)
      if (pointer === 0) {
        this.extractZeroSpritePosition()
      }
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
        this.memory[addr++] = this.cpu.ram.read(i + j)
      }
    }

    for (let i = 0; i < 64; i++) {
      this.formatSpriteSettingData(i)
    }

    this.extractZeroSpritePosition()
  }

  zeroSpritePosition() {
    return this._zeroSpritePosition
  }

  extractZeroSpritePosition() {
    let tileIdOffset = this.ppu.registers[0x2000].isSpriteChrBehind() ? 256 : 0
    const isSpriteSizeTwice = this.ppu.registers[0x2000].isSpriteSizeTwice()
    const attr = this._attrs[0]

    let tileId
    if (isSpriteSizeTwice) {
      tileIdOffset = attr.tileId & 0b1 ? 256 : 0
      tileId = (attr.tileId & 0xfe) + tileIdOffset
    } else {
      tileId = attr.tileId + tileIdOffset
    }

    const tile = this.ppu.loader.tiles.select(tileId)

    for (let i = 0; i < tile.length; i++) {
      const line = tile[i]
      for (let j = 0; j < line.length; j++) {
        if (line[j]) {
          this._zeroSpritePosition.x = attr.x + j
          this._zeroSpritePosition.y = attr.y + i + 1
          return
        }
      }
    }
  }

  attrs() {
    return this._attrs
  }

  formatSpriteSettingData(id) {
    const baseAddr = id * 4

    this._attrs[id].x = this.memory[baseAddr + 3]
    this._attrs[id].y = this.memory[baseAddr + 0]
    this._attrs[id].tileId = this.memory[baseAddr + 1]

    this.extractAttr(id, this.memory[baseAddr + 2])
  }

  extractAttr(id, attr) {
    const paletteId = attr & 0x03
    const priority = (attr >> 5) & 0x01
    const isHorizontalFlip = (attr >> 6) & 0x01
    const isVerticalFlip = (attr >> 7) & 0x01

    this._attrs[id].paletteId = paletteId
    this._attrs[id].priority = priority
    this._attrs[id].isHorizontalFlip = isHorizontalFlip
    this._attrs[id].isVerticalFlip = isVerticalFlip
  }
}
