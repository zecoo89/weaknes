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
  '2',
  '3',
  '4',
  /* 0x35: AND zeropageX */
  function() {
    Util.execute.call(this, 'AND', 'zeropageX')
  },
  /* 0x36 ROL zeropageX */
  function() {
    Util.execute.call(this, 'ROL', 'zeropageX')
  },
  '7',
  /* 0x38: SEC implied */
  function() {
    Util.execute.call(this, 'SEC', 'implied')
  },
  /* 0x39: AND absoluteY*/
  function() {
    Util.execute.call(this, 'AND', 'absoluteY')
  },
  'a',
  'b',
  'c',
  /* 0x3d: AND absoluteX */
  function() {
    Util.execute.call(this, 'AND', 'absoluteX')
  },
  /* 0x32: ROL absoluteX */
  function() {
    Util.execute.call(this, 'ROL', 'absoluteX')
  },
  'f'
]
