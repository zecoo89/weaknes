import Util from './util'

/* 0x30 - 0x3F */
export default [
  /* 0x30: BMI relative */
  function() {
    Util.execute.call(this, 'BMI', 'relative')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x38: SEC implied */
  function() {
    Util.execute.call(this, 'SEC', 'implied')
  },
  '',
  '',
  '',
  '',
  '',
  '',
  ''
]
