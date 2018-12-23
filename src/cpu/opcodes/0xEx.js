import Util from './util'

/* 0xe0 - 0xeF */
export default [
  /* 0xe0: CPX immediate */
  function() {
    Util.execute.call(this, 'CPX', 'immediate')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xe8: INX implied */
  function() {
    Util.execute.call(this, 'INX', 'implied')
  },
  /* 0xe9: */
  function() {
    Util.execute.call(this, 'SBC', 'immediate')
  },
  /* 0xea: NOP implied */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  '',
  '',
  '',
  '',
  ''
]
