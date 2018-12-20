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
  /* 0x48: PHA implied */
  function() {
    Util.execute.call(this, 'PHA', 'implied')
  },
  '9',
  'a',
  'b',
  /* 0x4c: JMP Absolute */
  function() {
    Util.execute.call(this, 'JMP', 'absolute')
  },
  'd',
  'e',
  'f'
]
