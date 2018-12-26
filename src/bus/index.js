export default class Bus {
  constructor() {
    this.vramAddr_ = []
    this.scrollSetting_ = []
    this.spriteWriteSetting_ = []
  }

  connect(parts) {
    parts.ppu && (this.ppu = parts.ppu)
  }

  /* CPU側からのみしか考慮してない */
  write(addr, value) {
    switch (addr) {
      /* PPUの設定を行う */
      case 0x2000:
        this.ppu.setting = value
        break
      /* PPUの表示設定を行う */
      case 0x2001:
        this.ppu.screenSetting = value
        break
      /* PPUのスプライトRAMへの書き込みアドレスを設定する */
      case 0x2003:
        this.ppu.spriteAddr = value
        break
      /* スプライトRAMへ書き込む */
      case 0x2004:
        this.spriteWriteSetting = value
        break
      case 0x2005:
        this.scrollSetting = value
      break
        /* vramへ書き込む際のアドレスを決める
         * 1回目：上位アドレス
         * 2回目：下位アドレス */
      case 0x2006:
        this.vramAddr = value
      break
      /* vramへ書き込む */
      case 0x2007:
        this.ppu.vram.write(this.ppu.vp++, value)
        this.ppu.refreshDisplay()
        break
      default:
        throw new Error('The bus of this addr is not implemented')
    }
  }

  /* CPU側からのみしか考慮してない */
  read(addr) {
    switch (addr) {
      case 0x2002:
        return this.ppu.state
      case 0x2007:
        return this.vram.read(addr)
      default:
        throw new Error('The bus of this addr is not implemented')
    }
  }

  set vramAddr(addr) {
    if (this.vramAddr_.length < 1) {
      this.vramAddr_.push(addr)
    } else {
      this.vramAddr_.push(addr)
      this.ppu.vp = this.vramAddr
      this.vramAddr_.length = 0
    }
  }

  get vramAddr() {
    return (this.vramAddr_[0] << 8) + this.vramAddr_[1]
  }

  set scrollSetting(value) {
    if (this.scrollSetting_.length < 1) {
      this.scrollSetting_.push(value)
    } else {
      this.scrollSetting_.push(value)
      this.ppu.horizontalScroll = this.scrollSetting_[0]
      this.ppu.verticalScroll = this.scrollSetting_[1]
      this.scrollSetting_.length = 0
    }
  }

  get spriteWriteSetting() {
    const spriteAddr = this.spriteWriteSetting_[2]
    const paletteId = spriteAddr & 0x3
    const isFront = (spriteAddr >> 4) & 0x1
    const isHorizontalInverted = (spriteAddr >> 5) & 0x1
    const isVerticalInverted = (spriteAddr >> 6) & 0x1

    return {
      x: this.spriteWriteSetting_[3],
      y: this.spriteWriteSetting_[0],
      tileId: this.spriteWriteSetting_[1],
      paletteId,
      isFront,
      isHorizontalInverted,
      isVerticalInverted
    }
  }

  set spriteWriteSetting(value) {
    this.spriteWriteSetting_.push(value)

    if(this.spriteWriteSetting_.length === 4) {
      this.ppu.writeSprite(this.spriteWriteSetting)
      this.spriteWriteSetting_.length = 0
    }
  }
}
