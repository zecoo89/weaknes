import { BaseRegister } from '../../utils'

export default class X4014 extends BaseRegister {
  constructor(ppu) {
    super(ppu)
  }

  write(value) {
    this.ppu.oam.dma(value)
  }
}
