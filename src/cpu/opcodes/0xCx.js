import Util from './util'

/* 0xc0 - 0xcF */
export default [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  /* 0xc9: CMP immediate */
  function() {
    Util.execute.call(this, 'CMP', 'immediate')
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
