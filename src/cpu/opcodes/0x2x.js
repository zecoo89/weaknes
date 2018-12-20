import Util from './util'

/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR absolute*/
  function() {
    Util.execute.call(this, 'JSR', 'absolute')
  },
  /* 0x21: INC indexIndirect */
  function() {
    Util.execute.call(this, 'INC', 'indexIndirect')
  },
  '2',
  '3',
  /* 0x24: BIT zeropage */
  function() {
    Util.execute.call(this, 'BIT', 'zeropage')
  },
  '5',
  '6',
  '7',
  /* 0x28: PLP implied */
  function() {
    Util.execute.call(this, 'PLP', 'implied')
  },
  /* 0x29: AND Immediate */
  function() {
    Util.execute.call(this, 'AND', 'immediate')
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
