import Util from './util'

/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ relative */
  function() {
    Util.execute.call(this, 'BEQ', 'relative')
  },
  /* 0xf1: SBC indirectIndex */
  function() {
    Util.execute.call(this, 'SBC', 'indirectIndex')
  },
  '2:STP',
  '3:ISC',
  /* 0xf4: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0xf5: SBC zeropageX */
  function() {
    Util.execute.call(this, 'SBC', 'zeropageX')
  },
  /* 0xf6: INC zeropageX */
  function() {
    Util.execute.call(this, 'INC', 'zeropageX')
  },
  '7:ISC',
  /* 0xf8: SED implied */
  function() {
    Util.execute.call(this, 'SED', 'implied')
  },
  /* 0xf9 SBC absoluteY */
  function() {
    Util.execute.call(this, 'SBC', 'absoluteY')
  },
  /* 0xfa: NOP */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  'b:ISC',
  /* 0xfc: 3byte NOP (Use absolute for 3byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'absolute')
  },
  /* 0xfd: SBC absoluteX */
  function() {
    Util.execute.call(this, 'SBC', 'absoluteX')
  },
  /* 0xfe: INC absoluteX */
  function() {
    Util.execute.call(this, 'INC', 'absoluteX')
  },
  'f:ISC'
]
