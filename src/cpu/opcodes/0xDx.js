import Util from './util'

/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE relative */
  function() {
    Util.execute.call(this, 'BNE', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xd8: CLD implied */
  function() {
    Util.execute.call(this, 'CLD', 'implied')
  },
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f'
]
