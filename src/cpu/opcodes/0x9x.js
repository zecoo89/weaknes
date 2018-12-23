import Util from './util.js'

/* 0x90 - 0x9F */
export default [
  /* 0x90: BCC relative*/
  function() {
    Util.execute.call(this, 'BCC', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x98: TYA implied */
  function() {
    Util.execute.call(this, 'TYA', 'implied')
  },
  '9',
  /* 9A: TXS implied */
  function() {
    Util.execute.call(this, 'TXS', 'implied')
  },
  '',
  '',
  '',
  '',
  ''
]
