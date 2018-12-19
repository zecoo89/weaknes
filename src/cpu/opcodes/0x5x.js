import Instructions from '../instructions'
import Addressing from '../addressing'
import Util from './util'

/* 0x50 - 0x5F */
export default [
  /* 0x50: BVC relative */
  function() {
    const relative = Addressing.relative.bind(this)
    const addr = relative()

    const BVC = Instructions.BVC.bind(this)
    BVC(addr)

    return Util.debugString(BVC, relative, addr)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
