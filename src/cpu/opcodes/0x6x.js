import Util from './util'

/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS implied */
  function() {
    Util.execute.call(this, 'RTS', 'implied')
  },
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  /* 0x68: PLA implied */
  function() {
    Util.execute.call(this, 'PLA', 'implied')
  },
  /* 0x69: ADC immediate */
  function() {
    Util.execute.call(this, 'ADC', 'immediate')
  },
  '',
  '',
  '',
  '',
  '',
  ''
]
