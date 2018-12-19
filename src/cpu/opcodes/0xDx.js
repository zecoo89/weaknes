import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE */
  function() {
    const relative = Addressing.relative.bind(this)
    const addr = relative()

    const BNE = Instructions.BNE.bind(this)
    BNE(addr)

    return Util.debugString(BNE, relative, addr)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xd8: CLD */
  function() {
    const CLD = Instructions.CLD.bind(this)
    CLD()

    return Util.debugString(CLD)
  },
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f'
]
