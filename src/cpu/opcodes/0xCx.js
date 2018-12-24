import Util from './util'

/* 0xc0 - 0xcF */
export default [
  /* 0xc0: CPY immediate */
  function() {
    Util.execute.call(this, 'CPY', 'immediate')
  },
  /* 0xc1: CMP indexIndirect */
  function() {
    Util.execute.call(this, 'CMP', 'indexIndirect')
  },
  /* 0xc2: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  '3:ISC',
  /* 0xc4: CPY zeropage*/
  function() {
    Util.execute.call(this, 'CPY', 'zeropage')
  },
  /* 0xc5: CMP zeropage */
  function() {
    Util.execute.call(this, 'CMP', 'zeropage')
  },
  /* 0xc6: DEC zeropage*/
  function() {
    Util.execute.call(this, 'DEC', 'zeropage')
  },
  '7:ISC',
  /* 0xc8: INY implied */
  function() {
    Util.execute.call(this, 'INY', 'implied')
  },
  /* 0xc9: CMP immediate */
  function() {
    Util.execute.call(this, 'CMP', 'immediate')
  },
  /* 0xca: DEX implied */
  function() {
    Util.execute.call(this, 'DEX', 'implied')
  },
  'b:SBC',
  /* 0xcc: CPY absolute */
  function() {
    Util.execute.call(this, 'CPY', 'absolute')
  },
  /* 0xcd: CMP absolute*/
  function() {
    Util.execute.call(this, 'CMP', 'absolute')
  },
  /* 0xce: DEC absolute */
  function() {
    Util.execute.call(this, 'DEC', 'absolute')
  },
  'f:DCP'
]
