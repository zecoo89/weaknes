import Util from './util'

/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */
  function() {
    Util.execute.call(this, 'BPL', 'relative')
  },
  /* 0x11 ORA indirectIndex */
  function() {
    Util.execute.call(this, 'ORA', 'indirectIndex')
  },
  '2:STP',
  '3:SLO',
  /* 0x14: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0x15: ORA zeropageX*/
  function() {
    Util.execute.call(this, 'ORA', 'zeropageX')
  },
  /* 0x16: ASL zeropageX */
  function() {
    Util.execute.call(this, 'ASL', 'zeropageX')
  },
  '7:SLO',
  /* 0x18: CLC implied */
  function() {
    Util.execute.call(this, 'CLC', 'implied')
  },
  /* 0x19: ORA abosluteY*/
  function() {
    Util.execute.call(this, 'ORA', 'absoluteY')
  },
  /* 0x1a: NOP */
  function() {
    Util.execute.call(this, 'NOP', 'implied')
  },
  'b:SLO',
  /* 0x1c: 3byte NOP (Use absolute for 3byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'absolute')
  },
  /* 0x1d ORA absoluteX */
  function() {
    Util.execute.call(this, 'ORA', 'absoluteX')
  },
  /* 0x1e ASL absoluteX*/
  function() {
    Util.execute.call(this, 'ASL', 'absoluteX')
  },
  'f:SLO'
]
