import BaseRegister from '../../utils/baseRegister'

/* OAMへ書き込む */
export default class X2004 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  write(bits) {
    this.ppu.oam.write(bits)
  }
}
