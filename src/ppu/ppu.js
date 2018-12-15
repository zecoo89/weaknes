import Vram from "./vram";

export default class Ppu {
  constructor() {
    this.init();
  }

  init() {
    /* About VRAM
     * 0x0000 - 0x0fff : Pattern table 0
     * 0x1000 - 0x1fff : Pattern table 1
     * 0x2000 - 0x23bf : Name table 0
     * 0x23c0 - 0x23ff : Attribute table 0
     * 0x2400 - 0x27bf : Name table 1
     * 0x2bc0 - 0x2bbf : Attribute table 1
     * 0x2c00 - 0x2fbf : Name table 2
     * 0x2bc0 - 0x2bff : Attribute table 2
     * 0x2c00 - 0x2fbf : Name table 3
     * 0x2fc0 - 0x2fff : Attribute table 3
     * 0x3000 - 0x3eff : Mirror of 0x2000 - 0x2fff
     * 0x3f00 - 0x3f0f : Background palette
     * 0x3f10 - 0x3f1f : Sprite palette
     * 0x3f20 - 0x3fff : Mirror of 0x3f00 0 0x3f1f
     * */
    this.vram = new Vram();
  }

  connect(parts) {
    if (parts.bus) {
      parts.bus.connect({ vram: this.vram });
    }

    if (parts.renderer) {
      this.renderer = parts.renderer;
      this.vram.connect(this);
    }
  }

  /* $2000 - $23BFのネームテーブルを更新する */
  refreshDisplay() {
    /* タイル(8x8)を32*30個 */
    for (let i = 0x2000; i <= 0x23bf; i++) {
      const tileId = this.vram.read(i);
      /* タイルを指定 */
      const tile = this.tiles[tileId];
      /* タイルが使用するパレットを取得 */
      const paletteId = this.selectPalette(tileId);
      const palette = this.selectBackgroundPalettes(paletteId);

      /* タイルとパレットをRendererに渡す */
      this.renderer.write(tile, palette);
    }
  }

  /* 0x0000 - 0x1fffのメモリにCHR-ROMを読み込む */
  set chrRom(chrRom) {
    for (let i = 0; i < chrRom.length; i++) {
      this.vram.write(i, chrRom[i]);
    }

    /* CHR領域からタイルを抽出しておく */
    this.extractTiles();
  }

  // 8x8のタイルをすべてvramのCHRから抽出しておく
  extractTiles() {
    this.tiles = [];
    for (let i = 0; i < 0x1fff; ) {
      // タイルの下位ビット
      const lowerBitLines = [];
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++);
        const line = [];
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01;
          line.unshift(bit);
          byte = byte >> 1;
        }

        lowerBitLines.push(line);
      }

      // タイルの上位ビット
      const higherBitLines = [];
      for (let h = 0; h < 8; h++) {
        let byte = this.vram.read(i++);
        const line = [];
        for (let j = 0; j < 8; j++) {
          const bit = byte & 0x01;
          line.unshift(bit << 1);
          byte = byte >> 1;
        }

        higherBitLines.push(line);
      }

      // 上位ビットと下位ビットを合成する
      const perfectBits = [];
      for (let h = 0; h < 8; h++) {
        for (let j = 0; j < 8; j++) {
          const perfectBit = lowerBitLines[h][j] | higherBitLines[h][j];
          perfectBits.push(perfectBit);
        }
      }
      this.tiles.push(perfectBits);
    }
  }

  /* 属性テーブルから該当パレットの番号を取得する */
  selectPalette(n) {
    const blockPosition = ((n - (n % 64)) / 64) * 8 + ((n % 64) - (n % 4)) / 4;
    const bitPosition = n % 4;
    const start = 0x23c0;

    const block = this.vram.read(start + blockPosition);
    const bit = (block >> bitPosition) & 0x03;

    return bit;
  }

  /* $3F00-$3F0Fからバックグラウンド(背景)パレットを取得する */
  selectBackgroundPalettes(number) {
    const palette = [];

    const start = 0x3f00 + number * 4;
    const end = 0x3f00 + number * 4 + 4;
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i));
    }

    return palette;
  }

  /* $3F10-$3F1Fからスプライトパレットを取得する */
  selectSpritePaletts(number) {
    const palette = [];

    const start = 0x3f10 + number * 4;
    const end = 0x3f10 + number * 4 + 4;
    for (let i = start; i < end; i++) {
      palette.push(this.vram.read(i));
    }

    return palette;
  }
}
