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
  '8',

  /* 0xA9: LDA immediate */
  function() {
    Util.execute.call(this, 'LDA', 'immediate')
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
