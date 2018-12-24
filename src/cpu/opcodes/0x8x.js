import Util from './util'

/* 0x80 - 0x8F */
export default [
  '0',
  /* 0x81: STA indexIndirect */
  function() {
    Util.execute.call(this, 'STA', 'indexIndirect')
  },
  '2',
  '3',
  /* 0x84: STY zeropage */
  function() {
    Util.execute.call(this, 'STY', 'zeropage')
  },
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
  /* 0x8a: TXA implied */
  function() {
    Util.execute.call(this, 'TXA', 'implied')
  },
  'b',
  /* 0x8c STY absolute */
  function() {
    Util.execute.call(this, 'STY', 'absolute')
  },
  /* 0x8d: STA absolute */
  function() {
    Util.execute.call(this, 'STA', 'absolute')
  },
  /* 0x8e: STX absolute*/
  function() {
    Util.execute.call(this, 'STX', 'absolute')
  },
  'f'
]
