import Util from './util.js'

/* 0x90 - 0x9F */
export default [
  /* 0x90: BCC relative*/
  function() {
    Util.execute.call(this, 'BCC', 'relative')
  },
  /* 0x91: STA indirectIndex */
  function() {
    Util.execute.call(this, 'STA', 'indirectIndex')
  },
  '2',
  '3',
  /* 0x94: STY zeropageX */
  function() {
    Util.execute.call(this, 'STY', 'zeropageX')
  },
  /* 0x95: STA zeropageX */
  function() {
    Util.execute.call(this, 'STA', 'zeropageX')
  },
  /* 0x96: STX zeropageY */
  function() {
    Util.execute.call(this, 'STX', 'zeropageY')
  },
  '7',
  /* 0x98: TYA implied */
  function() {
    Util.execute.call(this, 'TYA', 'implied')
  },
  /* 0x99: STA absoluteY */
  function() {
    Util.execute.call(this, 'STA', 'absoluteY')
  },
  /* 0x9a: TXS implied */
  function() {
    Util.execute.call(this, 'TXS', 'implied')
  },
  'b',
  'c',
  /* 0x9d: STA absoluteX */
  function() {
    Util.execute.call(this, 'STA', 'absoluteX')
  },
  'e',
  'f'
]
