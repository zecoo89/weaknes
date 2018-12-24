import Util from './util'

/* 0xe0 - 0xeF */
export default [
  /* 0xe0: CPX immediate */
  function() {
    Util.execute.call(this, 'CPX', 'immediate')
  },
  /* 0xe1: SBC indexIndirect */
  function() {
    Util.execute.call(this, 'SBC', 'indexIndirect')
  },
  /* 0xe0: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  '3:ISC',
  /* 0xe4: CPX zeropage */
  function() {
    Util.execute.call(this, 'CPX', 'zeropage')
  },
  /* 0xe5: SBC zeropage*/
  function() {
    Util.execute.call(this, 'SBC', 'zeropage')
  },
  /* 0xe6: INC zeropage*/
  function() {
    Util.execute.call(this, 'INC', 'zeropage')
  },
  '7:ISC',
  /* 0xe8: INX implied */
  function() {
    Util.execute.call(this, 'INX', 'implied')
  },
  /* 0xe9: SBC immediate */
  function() {
    Util.execute.call(this, 'SBC', 'immediate')
  },
  /* 0xea: NOP implied */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  'b:SBC',
  /* 0xec: CPX absolute */
  function() {
    Util.execute.call(this, 'CPX', 'absolute')
  },
  /* 0xed: SBC absolute */
  function() {
    Util.execute.call(this, 'SBC', 'absolute')
  },
  /* 0xee: INC absolute*/
  function() {
    Util.execute.call(this, 'INC', 'absolute')
  },
  'f:ISC'
]
