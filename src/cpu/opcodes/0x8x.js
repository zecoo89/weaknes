import Util from './util'

/* 0x80 - 0x8F */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  /* 0x85: STA zeropage */
  function() {
    Util.execute.call(this, 'STA', 'zeropage')
  },
  /* 0x86: STX Zeropage */
  function() {
    Util.execute.call(this, 'STX', 'zeropage')
  },
  '7',
  /* 0x88: DEY implied */
  function() {
    Util.execute.call(this, 'DEY', 'implied')
  },
  '9',
  'a',
  'b',
  'c',
  /* 0x8d: STA absolute */
  function() {
    Util.execute.call(this, 'STA', 'absolute')
  },
  'e',
  'f'
]
