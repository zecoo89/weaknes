import BaseRegister from './baseRegister'

/* PPUの表示設定 */
export default class X2001 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  /* 赤色を強調するか */
  isRedColorEmphasized() {
    return !!this.readOnebit(7)
  }

  /* 緑色を強調するか */
  isGreenColorEmphasized() {
    return !!this.readOnebit(6)
  }

  /* 青色を強調するか */
  isBlueColorEmphasized() {
    return !!this.readOnebit(5)
  }

  /* スプライトを表示するか */
  isSpriteDisplayed() {
    return !!this.readOnebit(4)
  }

  /* バックグラウンドを表示するか */
  isBackgroundDisplayed() {
    return !!this.readOnebit(3)
  }

  /* 画面左端8ドットのスプライトを表示するか */
  isLeftSideSpriteDisplayed() {
    return !!this.readOnebit(2)
  }

  /* 画面左端8ドットのバックグラウンドを表示するか */
  isLeftSideBackgroundDisplayed() {
    return !!this.readOnebit(1)
  }

  /* 色設定
   * false: カラー
   * true:  モノクロ */
  isMonochrome() {
    return !!this.readOnebit(0)
  }
}
