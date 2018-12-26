import Vram from './vram'

export default class Ppu {
  constructor() {
    this.init()
  }

  init() {
    this.vram = new Vram()
    this.setting = 0x00 // PPUの基本設定
    this.screenSetting = 0x00 // PPUの表示設定
    this.spriteAddr = 0x00 // スプライトRAMへの書き込みアドレス
    this.state = 0xff
    this.vp = null // 画面の更新位置
    this.horizontalScroll = 0x00 // 水平スクロールの設定
    this.verticalScroll = 0x00 // 垂直スクロールの設定
  }

  connect(parts) {
    if (parts.bus) {
      parts.bus.connect({ ppu: this })
    }

    if (parts.renderer) {
      this.renderer = parts.renderer
    }
  }

  /* $2000 - $23BFのネームテーブルを更新する */
  refreshDisplay() {
    /* タイル(8x8)を32*30個 */
    for (let i = 0x2000; i <= 0x23bf; i++) {
      const tileId = this.vram.read(i)
      /* タイルを指定 */
      const tile = this.tiles[tileId]
      /* タイルが使用するパレットを取得 */
      const paletteId = this.selectPalette(tileId)
      //const palette = this.selectBackgroundPalettes(paletteId)
      const palette = this.selectSpritePalettes(paletteId)

      /* タイルとパレットをRendererに渡す */
      this.renderer.write(tile, palette)
    }
  }

  writeSprite(setting) {
    const tileId = setting.tileId + 256 // bg = 0 ~ 255, sprite = 256~512
    const tile = this.tiles[tileId]
    const paletteId = setting.paletteId

    const palette = this.selectSpritePalettes(paletteId)

    const x = setting.x
    const y = setting.y

    this.renderer.writeSprite(tile, palette, x, y)
  }

  /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
  set chrRom(chrRom) {
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i])
    }

    /* CHR領域からタイルを抽出しておく */
    this.extractTiles()
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
    const blockPosition = ((n - (n % 64)) / 64) * 8 + ((n % 64) - (n % 4)) / 4
    const bitPosition = n % 4
    const start = 0x23c0

    const block = this.vram.read(start + blockPosition)
    const bit = (block >> bitPosition) & 0x03

    return bit
  }

  /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
  selectBackgroundPalettes(number) {
    const palette = []

    const start = 0x3f00 + number * 4
    const end = 0x3f00 + number * 4 + 4
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
  }

  /* $3F10-$3F1Fからスプライトパレットを取得する */
  selectSpritePalettes(number) {
    const palette = []

    const start = 0x3f10 + number * 4
    const end = 0x3f10 + number * 4 + 4
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i))
    }

    return palette
  }
}
