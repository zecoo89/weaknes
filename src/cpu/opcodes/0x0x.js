import Instructions from '../instructions'
//import Addressing from '../addressing'
import Util from './util'

/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK */
  function() {
    const BRK = Instructions.BRK.bind(this)

    BRK()

    return Util.debugString(BRK)
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x08: PHP*/
  function() {
    const PHP = Instructions.PHP.bind(this)

    PHP()

    return Util.debugString(PHP)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
