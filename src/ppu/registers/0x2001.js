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
  isSpriteDisplayed() {
    return !!this.readOneBit(4)
  }

  /* バックグラウンドを表示するか */
  isBackgroundDisplayed() {
    return !!this.readOneBit(3)
  }

  /* 画面左端8ドットのスプライトを表示するか */
  isLeftSideSpriteDisplayed() {
    return !!this.readOneBit(2)
  }

  /* 画面左端8ドットのバックグラウンドを表示するか */
  isLeftSideBackgroundDisplayed() {
    return !!this.readOneBit(1)
  }

  /* 色設定
   * false: カラー
   * true:  モノクロ */
  isMonochrome() {
    return !!this.readOneBit(0)
  }
}
