import X2000 from './0x2000'
import X2001 from './0x2001'
import X2002 from './0x2002'
import X2003 from './0x2003'
import X2004 from './0x2004'
import X2005 from './0x2005'
import X2006 from './0x2006'
import X2007 from './0x2007'
import X4014 from './0x4014'

export default class RegistersFactory {
  static create(ppu) {
    return {
      0x2000: new X2000(ppu),
      0x2001: new X2001(ppu),
      0x2002: new X2002(ppu),
      0x2003: new X2003(ppu),
      0x2004: new X2004(ppu),
      0x2005: new X2005(ppu),
      0x2006: new X2006(ppu),
      0x2007: new X2007(ppu),
      0x4014: new X4014(ppu)
    }
  }
}
