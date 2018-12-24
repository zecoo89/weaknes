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
  '2',
  '3',
  '4',
  /* 0xd5: CMP zeropageX */
  function() {
    Util.execute.call(this, 'CMP', 'zeropageX')
  },
  /* 0xd6: DEC zeropageX */
  function() {
    Util.execute.call(this, 'DEC', 'zeropageX')
  },
  '7',
  /* 0xd8: CLD implied */
  function() {
    Util.execute.call(this, 'CLD', 'implied')
  },
  /* 0xd9: CMP absoluteY */
  function() {
    Util.execute.call(this, 'CMP', 'absoluteY')
  },
  'a',
  'b',
  'c',
  /* 0xdd: CMP absoluteX */
  function() {
    Util.execute.call(this, 'CMP', 'absoluteX')
  },
  /* 0xde: DEC absoluteX */
  function() {
    Util.execute.call(this, 'DEC', 'absoluteX')
  },
  'f'
]
