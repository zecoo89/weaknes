import Util from './util'

/* 0xb0 - 0xbF */
export default [
  /* 0xb0: BCS implied */
  function() {
    Util.execute.call(this, 'BCS', 'relative')
  },
  /* 0xb1: LDA indirectIndex */
  function() {
    Util.execute.call(this, 'LDA', 'indirectIndex')
  },
  '2',
  '3',
  /* 0xb4: LDY zeropageX */
  function() {
    Util.execute.call(this, 'LDY', 'zeropageX')
  },
  /* 0xb5: LDA zeropageX */
  function() {
    Util.execute.call(this, 'LDA', 'zeropageX')
  },
  /* 0xb6: LDX zeropageY */
  function() {
    Util.execute.call(this, 'LDX', 'zeropageY')
  },
  '7',
  /* 0xb8: CLV implied */
  function() {
    Util.execute.call(this, 'CLV', 'implied')
  },
  /* 0xb9: LDA absoluteY */
  function() {
    Util.execute.call(this, 'LDA', 'absoluteY')
  },
  /* 0xba: TSX implied */
  function() {
    Util.execute.call(this, 'TSX', 'implied')
  },
  'b',
  /* 0xbc: LDY absoluteX*/
  function() {
    Util.execute.call(this, 'LDY', 'absoluteX')
  },
  /* 0xbd: LDA bsoluteX */
  function() {
    Util.execute.call(this, 'LDA', 'absoluteX')
  },
  /* 0xbe: LDX absoluteY*/
  function() {
    Util.execute.call(this, 'LDX', 'absoluteY')
  },
  'f'
]
