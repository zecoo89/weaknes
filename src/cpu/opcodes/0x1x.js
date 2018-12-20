import Util from './util'

/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */
  function() {
    Util.execute.call(this, 'BPL', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x18 CLC implied */
  function() {
    Util.execute.call(this, 'CLC', 'implied')
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
