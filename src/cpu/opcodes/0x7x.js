import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS */
  function() {
    const relative = Addressing.relative.bind(this)
    const addr = relative()

    const BVS = Instructions.BVS.bind(this)
    BVS(addr)

    return Util.debugString(BVS, relative, addr)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x78: SEI */
  function() {
    const SEI = Instructions.SEI.bind(this)

    SEI()

    return Util.debugString(SEI)
  },
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f'
]
