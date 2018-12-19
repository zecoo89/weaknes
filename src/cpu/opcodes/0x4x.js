import Addressing from '../addressing'
import Instructions from '../instructions'
import Util from './util'

/* 0x40 - 0x4F */
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
  '9',
  'a',
  'b',
  /* 0x4c: JMP Absolute */
  function() {
    const absolute = Addressing.absolute.bind(this)
    const addr = absolute()

    const JMP = Instructions.JMP.bind(this)
    JMP(addr)

    return Util.debugString(JMP, absolute, addr)
  },
  'd',
  'e',
  'f'
]
