import Util from './util'

/* 0x50 - 0x5F */
export default [
  /* 0x50: BVC relative */
  function() {
    Util.execute.call(this, 'BVC', 'relative')
  },
  /* 0x51: EOR indirectIndex */
  function() {
    Util.execute.call(this, 'EOR', 'indirectIndex')
  },
  '2',
  '3',
  '4',
  /* 0x55: EOR zeropageX */
  function() {
    Util.execute.call(this, 'EOR', 'zeropageX')
  },
  /* 0x56: LSR zeropageX */
  function() {
    Util.execute.call(this, 'LSR', 'zeropageX')
  },
  '7',
  /* 0x58: CLI */
  function() {
    Util.execute.call(this, 'CLI', 'implied')
  },
  /* 0x59: EOR absoluteY */
  function() {
    Util.execute.call(this, 'EOR', 'absoluteY')
  },
  'a',
  'b',
  'c',
  /* 0x5d EOR absoluteX */
  function() {
    Util.execute.call(this, 'EOR', 'absoluteX')
  },
  /* 0x5e LSR absoluteX */
  function() {
    Util.execute.call(this, 'LSR', 'absoluteX')
  },
  ''
]
