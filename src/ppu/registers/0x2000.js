import { BaseRegister } from '../../utils'

/* PPUの基本設定 */
export default class X2000 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
    this.register = 0b00000100
  }

  /* VBlank時にNMI割込の発生の有無 */
  isNmiInterruptable() {
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
  backgroundChrAddr() {
    const bit = this.readOneBit(4)

    if(bit) {
      return 0x1000
    } else {
      return 0x0000
    }
  }

  /* スプライト用CHRテーブルの開始アドレス
   * 0x0000 or 0x1000 */
  spriteChrAddr() {
    const bit = this.readOneBit(3)

    if(bit) {
      return 0x1000
    } else {
      return 0x0000
    }
  }

  /* VRAM入出力時のアドレスの増分
   * clear: +1
   * set: +32*/
  vramIncremental() {
    const bit = this.readOneBit(2)

    if(bit) {
      return 32
    } else {
      return 1
    }
  }

  /* メインスクリーンのアドレス
   * 0: 0x2000
   * 1: 0x2400
   * 2: 0x2800
   * 3: 0x2c00 */
  mainScreenAddr() {
    const bits = this.readBits(0, 1)

    switch(bits) {
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
}
