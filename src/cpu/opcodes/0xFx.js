import Util from './util'

/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ relative */
  function() {
    Util.execute.call(this, 'BEQ', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  /* 0xf6: INC zeropageX */
  function() {
    Util.execute.call(this, 'INC', 'zeropageX')
  },
  '7',
  /* 0xf8: SED implied */
  function() {
    Util.execute.call(this, 'SED', 'implied')
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
