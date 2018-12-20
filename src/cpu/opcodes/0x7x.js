import Util from './util'

/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS relative */
  function() {
    Util.execute.call(this, 'BVS', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x78: SEI implied */
  function() {
    Util.execute.call(this, 'SEI', 'implied')
  },
  '9',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f'
]
