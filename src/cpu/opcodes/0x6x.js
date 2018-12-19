//import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS */
  function() {
    const RTS = Instructions.RTS.bind(this)
    RTS()

    return Util.debugString(RTS)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x68: PLA */
  function() {
    const PLA = Instructions.PLA.bind(this)
    PLA()

    return Util.debugString(PLA)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
