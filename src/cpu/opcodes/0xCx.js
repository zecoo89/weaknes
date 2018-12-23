import Util from './util'

/* 0xc0 - 0xcF */
export default [
  /* 0xc0: CPY immediate */
  function() {
    Util.execute.call(this, 'CPY', 'immediate')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
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
  '',
  '',
  '',
  '',
  ''
]
