import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */
  function() {
    const relative = Addressing.relative.bind(this)
    const addr = relative()

    const BPL = Instructions.BPL.bind(this)
    BPL(addr)

    return Util.debugString(BPL)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x18 CLC */
  function() {
    const CLC = Instructions.CLC.bind(this)

    return Util.debugString(CLC)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
