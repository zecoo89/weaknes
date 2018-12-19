//import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0xe0 - 0xeF */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xe8: INX */
  function() {
    const INX = Instructions.INX.bind(this)

    INX()

    return Util.debugString(INX)
  },
  '9',
  /* 0xea: NOP */
  function() {
    //何もしない
    return Util.debugString(Instructions.NOP.bind(this))
  },
  '',
  '',
  '',
  '',
  ''
]
