import { BaseRegister } from '../../utils'

/* PPUの表示設定 */
export default class X2001 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  /* 赤色を強調するか */
  isRedColorEmphasized() {
    return !!this.readOneBit(7)
  }

  /* 緑色を強調するか */
  isGreenColorEmphasized() {
    return !!this.readOneBit(6)
  }

  /* 青色を強調するか */
  isBlueColorEmphasized() {
    return !!this.readOneBit(5)
  }

  /* スプライトを表示するか */
  isSpriteEnabled() {
    return !!this.readOneBit(4)
  }

  /* バックグラウンドを表示するか */
  isBackgroundEnabled() {
    return !!this.readOneBit(3)
  }

  /* 画面左端8ドットのスプライトを表示するか */
  isLeftSideSpriteEnabled() {
    return !!this.readOneBit(2)
  }

  /* 画面左端8ドットのバックグラウンドを表示するか */
  isLeftSideBackgroundEnabled() {
    return !!this.readOneBit(1)
  }

  /* 色設定
   * false: カラー
   * true:  モノクロ */
  isMonochrome() {
    return !!this.readOneBit(0)
  }
}
