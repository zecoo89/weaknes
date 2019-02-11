import { BaseRegister } from '../../utils'

/* PPUの基本設定 */
export default class X2000 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
    this.register = 0b00000100
  }

  write(bits) {
    this.t.writeScreenNumber(bits)
    super.write(bits)
  }

  /* VBlank時にNMI割込の発生の有無 */
  isNmiEnabled() {
    return !!this.readOneBit(7)
  }

  /* PPUがマスターかスレーブを決定する(多分使わない) */
  isPpuSlave() {
    return !!this.readOneBit(6)
  }

  /* スプライトサイズを決定する
   * false: 8x8
   * true:  8x16 */
  isSpriteSizeTwice() {
    return !!this.readOneBit(5)
  }

  /* バックグランド用CHRテーブルの開始アドレス
   * 0x0000 or 0x1000 */
  isBackgroundChrBehind() {
    return !!this.readOneBit(4)
  }

  /* スプライト用CHRテーブルの開始アドレス
   * 0x0000 or 0x1000 */
  isSpriteChrBehind() {
    return !!this.readOneBit(3)
  }

  /* VRAM入出力時のアドレスの増分
   * clear: +1
   * set: +32 */
  vramIncremental() {
    const bit = this.readOneBit(2)

    return bit ? 32 : 1
  }

  /* メインスクリーンのアドレス
   * 0: 0x2000
   * 1: 0x2400
   * 2: 0x2800
   * 3: 0x2c00 */
  mainScreenAddr() {
    const bits = this.readBits(0, 1)

    switch (bits) {
      case 0:
        return 0x2000
      case 1:
        return 0x2400
      case 2:
        return 0x2800
      case 3:
        return 0x2c00
      default:
        throw new Error()
    }
  }

  mainScreenNumber() {
    return this.readBits(0, 1)
  }
}
