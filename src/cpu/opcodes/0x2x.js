import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR Absolute*/
  function() {
    const absolute = Addressing.absolute.bind(this)
    const addr = absolute()

    const JSR = Instructions.JSR.bind(this)

    JSR(addr)

    return Util.debugString(JSR, absolute, addr)
  },
  '1',
  '2',
  '3',
  /* 0x24: BIT */
  function() {
    const zeropage = Addressing.zeropage.bind(this)
    const addr = zeropage()

    const BIT = Instructions.BIT.bind(this)

    BIT(addr)

    return Util.debugString(BIT, zeropage, addr)
  },
  '5',
  '6',
  '7',
  '8',
  /* 0x29: AND Immediate */
  function() {
    const immediate = Addressing.immediate.bind(this)
    const addr = immediate()

    const AND = Instructions.AND.bind(this)

    AND(addr)

    return Util.debugString(AND, immediate, addr)
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
