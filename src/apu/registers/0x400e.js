import BaseRegister from '../../utils/baseRegister'

export default class X400e extends BaseRegister {
  randomNumberType() {
    return this.readOneBit(7)
  }

  waveLength() {
    return this.readBits(0, 3)
  }
}
