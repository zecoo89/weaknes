export default class Rom {
  constructor(data) {
    this.check(data)
    this.data = data
    this.debugInfo()
  }

  debugInfo() {
    //eslint-disable-next-line
    console.log('Vertical mirror?: ' + this.isVerticalMirror())
    //eslint-disable-next-line
    console.log('PRG-ROM size: 0x' + this.SIZE_OF_PRG_ROM.toString(16))
    //eslint-disable-next-line
    console.log('CHR-ROM size: 0x' + this.SIZE_OF_CHR_ROM.toString(16))
  }

  check(data) {
    if (!this.isNesRom(data)) throw new Error('This is not NES ROM.')
  }

  get NES_ROM_HEADER_SIZE() {
    return 0x10
  }

  get NUMBER_OF_PRG_ROM_BLOCKS() {
    //console.log('Number of PRG-ROM blocks: ' + this.data[4])
    return this.data[4]
  }

  get NUMBER_OF_CHR_ROM_BLOCKS() {
    //console.log('Number of CHR-ROM blocks: ' + this.data[5])
    return this.data[5]
  }

  isVerticalMirror() {
    return !!(this.data[6] & 0x01)
  }

  get START_ADDRESS_OF_CHR_ROM() {
    return this.NES_ROM_HEADER_SIZE + this.SIZE_OF_PRG_ROM
  }

  get END_ADDRESS_OF_CHR_ROM() {
    return this.START_ADDRESS_OF_CHR_ROM + this.SIZE_OF_CHR_ROM
  }

  /* PRG ROMのサイズを取得する
   ** ROMヘッダの1から数えて5Byte目の値に16Ki(キビ)をかけたサイズ */
  get SIZE_OF_PRG_ROM() {
    return this.NUMBER_OF_PRG_ROM_BLOCKS * 0x4000
  }

  /* PRG ROMに同じ*/
  get SIZE_OF_CHR_ROM() {
    return this.NUMBER_OF_CHR_ROM_BLOCKS * 0x2000
  }

  /* ROMからprgROMに該当するところを切り出す
   ** prgROMはヘッダ領域の次のByteから始まる */
  get prgRom() {
    return this.data.slice(
      this.NES_ROM_HEADER_SIZE,
      this.START_ADDRESS_OF_CHR_ROM
    )
  }

  /* ROMからchrROMに該当するところを切り出す
   ** chrRomはprgRomの後から始まる */
  get chrRom() {
    return this.data.slice(
      this.START_ADDRESS_OF_CHR_ROM,
      this.END_ADDRESS_OF_CHR_ROM + 1
    )
  }

  /* データのヘッダに'NES'があるかどうかでNESのROMか判別する */
  isNesRom(data) {
    const header = data.slice(0, 3)
    const headerStr = String.fromCharCode.apply(null, header)

    return headerStr === 'NES'
  }
}
