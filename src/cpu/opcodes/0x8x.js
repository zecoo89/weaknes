import Util from './util'

/* 0x80 - 0x8F */
export default [
  /* 0x80: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0x81: STA indexIndirect */
  function() {
    Util.execute.call(this, 'STA', 'indexIndirect')
  },
  /* 0x82: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  '3:SAX',
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
  '7:SAX',
  /* 0x88: DEY implied */
  function() {
    Util.execute.call(this, 'DEY', 'implied')
  },
  /* 0x89: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0x8a: TXA implied */
  function() {
    Util.execute.call(this, 'TXA', 'implied')
  },
  'b:XAA',
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
  'f:SAX'
]
