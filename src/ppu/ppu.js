import Vram from './vram'
import Oam from './oam'
import RegistersFactory from './registers'

export default class Ppu {
  constructor() {
    this.init()
  }

  init() {
    this.vram = new Vram()
    this.oam = new Oam()
    this.registers = RegistersFactory.create(this)

    this.oam.connect({ ppu: this })

    this.backgroundData = []
    this.spritesData = []

    this.pointer = 0
    this.width = 32
    this.height = 30
  }

  connect(parts) {
    parts.cpu && this.oam.connect(parts)
    parts.renderer && (this.renderer = parts.renderer)
  }

  /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
  set chrRom(chrRom) {
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i])
    }

    /* CHR領域からタイルを抽出しておく */
    this.extractTiles()
  }

  run() {
    this.generateBackgroundData()
    this.generateSpritesData()
  }

  readRegister(addr) {
    if (addr === 0x2002) {
      this.registers[0x2005].clearLatch()
      this.registers[0x2006].clearLatch()
    }

    return this.registers[addr].read()
  }

  writeRegister(addr, value) {
    this.registers[addr].write(value)
  }

  generateBackgroundData() {
    this.backgroundData.length = 0
    /* Prepare tile(8x8) * (32*30) */
    for (let i = 0x2000; i <= 0x23bf; i++) {
      const tileId = this.vram.read(i)
      const tile = this.tiles[tileId]
      const paletteId = this.selectPalette(i)
      const palette = this.selectBackgroundPalettes(paletteId)
      const x = (this.pointer % this.width) * 8
      const y = ((this.pointer - (this.pointer % this.width)) / this.width) * 8
      this.pointer++

      this.backgroundData.push({
        tile,
        palette,
        x,
        y
      })
    }
    this.pointer = 0
  }

  generateSpritesData() {
    this.spritesData.length = 0
    const attrs = this.oam.attrs()

    attrs.forEach(attr => {
      const tileId = attr.tileId + 256
      const tile = this.tiles[tileId]
      const paletteId = attr.paletteId
      const palette = this.selectSpritePalettes(paletteId)

      this.spritesData.push({
        tile,
        palette,
        x: attr.x,
        y: attr.y,
        isHorizontalFlip: attr.isHorizontalFlip,
        isVerticalFlip: attr.isVerticalFlip
      })
    })
  }

  // 8x8のタイルをすべてvramのCHRから抽出しておく
  extractTiles() {
    this.tiles = []
    for (let i = 0; i < 0x1fff; ) {
      // タイルの下位ビット
      const lowerBitLines = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit)
          byte = byte >> 1
        }

        lowerBitLines.push(line)
      }

      // タイルの上位ビット
      const higherBitLines = []
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++)
        const line = []
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01
          line.unshift(bit << 1)
          byte = byte >> 1
        }

        higherBitLines.push(line)
      }

      // 上位ビットと下位ビットを合成する
      const perfectBits = []
      for (let h = 0; h < 8; h++) {
        for (let j = 0; j < 8; j++) {
          const perfectBit = lowerBitLines[h][j] | higherBitLines[h][j]
          perfectBits.push(perfectBit)
        }
      }
      this.tiles.push(perfectBits)
    }
  }

  /* 属性テーブルから該当パレットの番号を取得する */
  selectPalette(n) {
    const start = 0x23c0
    const blockPosition = this.blockPosition(n)
    const bitPosition = this.bitPosition(n)

    const block = this.vram.read(start + blockPosition * 2)
    const bit = block >> (bitPosition * 2)

    return bit
  }

  blockPosition(n) {
    const x = n % 32
    const y = (((n - (n % 32)) / 32 - (((n - (n % 32)) / 32) % 2)) * 16) / 2
    const blockPosition = y + (x - (x % 2)) / 2

    return blockPosition
  }

  bitPosition(n) {
    const x = n % 2
    const y = ((n - (n % 32)) / 32) % 2
    const bitPosition = y * 2 + x

    return bitPosition
  }

  /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
  selectBackgroundPalettes(number) {
    const palette = []

    const start = 0x3f01 + number * 4
    const end = 0x3f01 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    palette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
  }

  /* $3F10-$3F1Fからスプライトパレットを取得する */
  selectSpritePalettes(number) {
    const palette = []

    const start = 0x3f11 + number * 4
    const end = 0x3f11 + number * 4 + 3

    // パレット4色の1色目は0x3f00をミラーする
    palette.push(this.vram.read(0x3f00))
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
  }
}
