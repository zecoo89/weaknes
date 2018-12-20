import Util from './util'

/* 0xe0 - 0xeF */
export default [
  '0',
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
  '9',
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
