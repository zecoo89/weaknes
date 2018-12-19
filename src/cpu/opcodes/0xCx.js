import Instructions from '../instructions'
import Addressing from '../addressing'
import Util from './util'

/* 0xc0 - 0xcF */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  /* 0xc9: CMP immediate */
  function() {
    const immediate = Addressing.immediate.bind(this)
    const addr = immediate()

    const CMP = Instructions.CMP.bind(this)
    CMP(addr)

    return Util.debugString(CMP, immediate, addr)
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
