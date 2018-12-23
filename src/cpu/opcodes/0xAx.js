import Util from './util'

/* 0xA0 - 0xAF */
export default [
  /* 0xA0: LDY immediate*/
  function() {
    Util.execute.call(this, 'LDY', 'immediate')
  },
  '1',
  /* 0xA2: LDX immediate */
  function() {
    Util.execute.call(this, 'LDX', 'immediate')
  },
  '3',
  '4',
  '5',
  '6',
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
  'c',
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
