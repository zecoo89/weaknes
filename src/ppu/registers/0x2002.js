import BaseRegister from './baseRegister'

/* PPUの状態 */
export default class X2002 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  setVblank() {
    this.writeOneBit(7, 1)
  }

  clearVblank() {
    this.writeOneBit(7, 0)
  }

  isVblank() {
    return !!this.readOneBit(7)
  }

  /* 描画ラインの0番スプライトが衝突したか */
  isZeroSpriteCollision() {
    return !!this.readOneBit(6)
  }

  /* 描画ラインのスプライト数が9個以上あるか */
  isSpriteMoreThanNine() {
    return !!this.readOneBit(5)
  }

  /* VRAMが書き込み可能か */
  isVramWritable() {
    return !this.readOneBit(4)
  }
}
