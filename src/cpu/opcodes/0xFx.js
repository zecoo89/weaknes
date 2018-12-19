import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ */
  function() {
    const relative = Addressing.relative.bind(this)
    const addr = relative()

    const BEQ = Instructions.BEQ.bind(this)
    BEQ(addr)

    return Util.debugString(BEQ, relative, addr)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xf8: SED */
  function() {
    const SED = Instructions.SED.bind(this)

    SED()

    return Util.debugString(SED)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
