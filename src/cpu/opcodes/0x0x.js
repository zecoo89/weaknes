import Util from './util'

/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK implied */
  function() {
    Util.execute.call(this, 'BRK', 'implied')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  /* 0x06 ASL zeropage */
  function() {
    Util.execute.call(this, 'ASL', 'zeropage')
  },
  '7',
  /* 0x08: PHP*/
  function() {
    Util.execute.call(this, 'PHP', 'implied')
  },
  /* 0x09: ORA immediate */
  function() {
    Util.execute.call(this, 'ORA', 'immediate')
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
