import { BaseRegister } from '../../utils'

/* OAMへの書き込みアドレスを設定する */
export default class X2003 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }
}
