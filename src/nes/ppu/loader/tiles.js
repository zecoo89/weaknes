export default class Tiles {
  constructor() {
    this.tiles = []
  }

  connect(parts) {
    parts.vram && (this.vram = parts.vram)
  }

  select(tileId) {
    return this.tiles[tileId]
  }

  get length() {
    return this.tiles.length
  }

  extract() {
    this.tiles.length = 0
    for (let i = 0; i < 0x1fff; i += 16) {
      // タイルの下位ビット
      const tile = []
      for (let h = 0; h < 8; h++) {
        let lByte = this.vram.read(i + h)
        let uByte = this.vram.read(8 + i + h)

        const line = []
        for (let j = 0; j < 8; j++) {
          const lBit = lByte & 0x01
          const uBit = (uByte & 0x01) << 1
          line.unshift(lBit | uBit)
          lByte = lByte >> 1
          uByte = uByte >> 1
        }

        tile.push(line)
      }

      this.tiles.push(tile)
    }
  }

  dumpTile(tileId) {
    const tile = this.tiles[tileId]
    let output = ''
    for (let h = 0; h < 8; h++) {
      for (let w = 0; w < 8; w++) {
        output += tile[h][w]
      }
      output += '\n'
    }
    console.log('---' + tileId + '---') // eslint-disable-line
    console.log(output) // eslint-disable-line
  }
}
