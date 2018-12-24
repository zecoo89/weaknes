import Util from './util'

/* 0xA0 - 0xAF */
export default [
  /* 0xa0: LDY immediate*/
  function() {
    Util.execute.call(this, 'LDY', 'immediate')
  },
  /* 0xa1: LDA indexIndirect */
  function() {
    Util.execute.call(this, 'LDA', 'indexIndirect')
  },
  /* 0xA2: LDX immediate */
  function() {
    Util.execute.call(this, 'LDX', 'immediate')
  },
  '3',
  /* 0xa4: LDY zeropage */
  function() {
    Util.execute.call(this, 'LDY', 'zeropage')
  },
  /* 0xa5: LDA zeropage */
  function() {
    Util.execute.call(this, 'LDA', 'zeropage')
  },
  /* 0xa6 LDX zeropage */
  function() {
    Util.execute.call(this, 'LDX', 'zeropage')
  },
  '7',
  /* 0xa8: TAY implied */
  function() {
    Util.execute.call(this, 'TAY', 'implied')
  },
  /* 0xa9: LDA immediate */
  function() {
    Util.execute.call(this, 'LDA', 'immediate')
  },
  /* 0xaa: TAX implied */
  function() {
    Util.execute.call(this, 'TAX', 'implied')
  },
  'b',
  /* 0xac: LDY absolute */
  function() {
    Util.execute.call(this, 'LDY', 'absolute')
  },
  /* 0xad: LDA absolute */
  function() {
    Util.execute.call(this, 'LDA', 'absolute')
  },
  /* 0xae: LDX absolute */
  function() {
    Util.execute.call(this, 'LDX', 'absolute')
  },
  ''
]
