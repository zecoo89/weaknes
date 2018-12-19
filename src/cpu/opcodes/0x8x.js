import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x80 - 0x8F */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  /* 0x85: STA zeropage */
  function() {
    const zeropage = Addressing.zeropage.bind(this)

    const addr = zeropage()
    const STA = Instructions.STA.bind(this)

    STA(addr)

    return Util.debugString(STA, zeropage, addr)
  },
  /* 0x86: STX Zeropage */
  function() {
    const zeropage = Addressing.zeropage.bind(this)

    const addr = zeropage()
    const STX = Instructions.STX.bind(this)

    STX(addr)

    return Util.debugString(STX, zeropage, addr)
  },
  '7',
  /* 0x88: DEY */
  function() {
    const DEY = Instructions.DEY.bind(this)

    DEY()

    return Util.debugString(DEY)
  },
  '9',
  'a',
  'b',
  'c',
  /* 0x8d: STA Absolute */
  function() {
    const absolute = Addressing.absolute.bind(this)

    const addr = absolute()
    const STA = Instructions.STA.bind(this)

    STA(addr)

    return Util.debugString(STA, absolute, addr)
  },
  'e',
  'f'
]
