import Util from './util'

/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR absolute*/
  function() {
    Util.execute.call(this, 'JSR', 'absolute')
  },
  /* 0x21: AND indexIndirect */
  function() {
    Util.execute.call(this, 'AND', 'indexIndirect')
  },
  '2',
  '3',
  /* 0x24: BIT zeropage */
  function() {
    Util.execute.call(this, 'BIT', 'zeropage')
  },
  /* 0x25: AND zeropage */
  function() {
    Util.execute.call(this, 'AND', 'zeropage')
  },
  /* 0x26: ROL zeropage */
  function() {
    Util.execute.call(this, 'ROL', 'zeropage')
  },
  '7',
  /* 0x28: PLP implied */
  function() {
    Util.execute.call(this, 'PLP', 'implied')
  },
  /* 0x29: AND Immediate */
  function() {
    Util.execute.call(this, 'AND', 'immediate')
  },
  /* 0x2a: ROL implied (accmulator)*/
  function() {
    Util.execute.call(this, 'ROL', 'implied')
  },
  'b',
  /* 0x2c: BIT absolute */
  function() {
    Util.execute.call(this, 'BIT', 'absolute')
  },
  /* 0x2d: AND absolute */
  function() {
    Util.execute.call(this, 'AND', 'absolute')
  },
  /* 0x2e: ROL absolute*/
  function() {
    Util.execute.call(this, 'ROL', 'absolute')
  },
  ''
]
