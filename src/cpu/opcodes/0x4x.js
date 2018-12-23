import Util from './util'

/* 0x40 - 0x4F */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  /* 0x45: EOR zeropage */
  function() {
    Util.execute.call(this, 'EOR', 'zeropage')
  },
  '6',
  '7',
  /* 0x48: PHA implied */
  function() {
    Util.execute.call(this, 'PHA', 'implied')
  },
  /* 0x49: EOR immediate */
  function() {
    Util.execute.call(this, 'EOR', 'immediate')
  },
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
