import Instructions from '../instructions'
//import Addressing from '../addressing'
import Util from './util'

/* 0x30 - 0x3F */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x38: SEC */
  function() {
    const SEC = Instructions.SEC.bind(this)

    SEC()

    return Util.debugString(SEC)
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
