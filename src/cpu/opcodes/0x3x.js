import Util from './util'

/* 0x30 - 0x3F */
export default [
  /* 0x30: BMI relative */
  function() {
    Util.execute.call(this, 'BMI', 'relative')
  },
  /* 0x31: AND indirectIndex */
  function() {
    Util.execute.call(this, 'AND', 'indirectIndex')
  },
  '2:STP',
  '3:RLA',
  /* 0x34: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0x35: AND zeropageX */
  function() {
    Util.execute.call(this, 'AND', 'zeropageX')
  },
  /* 0x36 ROL zeropageX */
  function() {
    Util.execute.call(this, 'ROL', 'zeropageX')
  },
  '7:RLA',
  /* 0x38: SEC implied */
  function() {
    Util.execute.call(this, 'SEC', 'implied')
  },
  /* 0x39: AND absoluteY*/
  function() {
    Util.execute.call(this, 'AND', 'absoluteY')
  },
  /* 0x3a: NOP */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  'b:RLA',
  /* 0x3c: 3byte NOP (Use absolute for 3byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'absolute')
  },
  /* 0x3d: AND absoluteX */
  function() {
    Util.execute.call(this, 'AND', 'absoluteX')
  },
  /* 0x32: ROL absoluteX */
  function() {
    Util.execute.call(this, 'ROL', 'absoluteX')
  },
  'f:RLA'
]
