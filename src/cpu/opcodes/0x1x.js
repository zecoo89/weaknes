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
  '2',
  '3',
  '4',
  /* 0x15: ORA zeropageX*/
  function() {
    Util.execute.call(this, 'ORA', 'zeropageX')
  },
  /* 0x16: ASL zeropageX */
  function() {
    Util.execute.call(this, 'ASL', 'zeropageX')
  },
  '7',
  /* 0x18: CLC implied */
  function() {
    Util.execute.call(this, 'CLC', 'implied')
  },
  /* 0x19: ORA abosluteY*/
  function() {
    Util.execute.call(this, 'ORA', 'absoluteY')
  },
  'a',
  'b',
  'c',
  /* 0x1d ORA absoluteX */
  function() {
    Util.execute.call(this, 'ORA', 'absoluteX')
  },
  /* 0x1e ASL absoluteX*/
  function() {
    Util.execute.call(this, 'ASL', 'absoluteX')
  },
  'f'
]
