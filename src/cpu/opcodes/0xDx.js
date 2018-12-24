import Util from './util'

/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE relative */
  function() {
    Util.execute.call(this, 'BNE', 'relative')
  },
  /* 0xd1: CMP indirectIndex */
  function() {
    Util.execute.call(this, 'CMP', 'indirectIndex')
  },
  '2:STP',
  '3:DCP',
  /* 0xd4: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0xd5: CMP zeropageX */
  function() {
    Util.execute.call(this, 'CMP', 'zeropageX')
  },
  /* 0xd6: DEC zeropageX */
  function() {
    Util.execute.call(this, 'DEC', 'zeropageX')
  },
  '7:DCP',
  /* 0xd8: CLD implied */
  function() {
    Util.execute.call(this, 'CLD', 'implied')
  },
  /* 0xd9: CMP absoluteY */
  function() {
    Util.execute.call(this, 'CMP', 'absoluteY')
  },
  /* 0xda: NOP */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  'b:DCP',
  /* 0xdc: 3byte NOP (Use absolute for 3byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'absolute')
  },
  /* 0xdd: CMP absoluteX */
  function() {
    Util.execute.call(this, 'CMP', 'absoluteX')
  },
  /* 0xde: DEC absoluteX */
  function() {
    Util.execute.call(this, 'DEC', 'absoluteX')
  },
  'f:DCP'
]
