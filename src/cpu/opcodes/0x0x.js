import Util from './util'

/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK implied */
  function() {
    Util.execute.call(this, 'BRK', 'implied')
  },
  /* 0x01: ORA indexIndirect */
  function() {
    Util.execute.call(this, 'ORA', 'indexIndirect')
  },
  '2',
  '3',
  '4',
  /* 0x05: ORA zeropage */
  function() {
    Util.execute.call(this, 'ORA', 'zeropage')
  },
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
  /* 0x0a: ASL implied(accmulator)*/
  function() {
    Util.execute.call(this, 'ASL', 'implied')
  },
  'b',
  'c',
  /* 0x0d: ORA absolute */
  function() {
    Util.execute.call(this, 'ORA', 'absolute')
  },
  /* 0x0e: ASL absolute */
  function() {
    Util.execute.call(this, 'ASL', 'absolute')
  },
  ''
]
