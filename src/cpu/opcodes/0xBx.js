import Util from './util'

/* 0xb0 - 0xbF */
export default [
  /* 0xb0: BCS implied */
  function() {
    Util.execute.call(this, 'BCS', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0xb8: CLV implied */
  function () {
    Util.execute.call(this, 'CLV', 'implied')
  },
  '9',
  'a',
  'b',
  'c',
  /* 0xbd: LDA AbsoluteX */
  function() {
    Util.execute.call(this, 'LDA', 'absoluteX')
  },
  'e',
  'f'
]
