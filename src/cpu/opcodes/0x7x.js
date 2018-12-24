import Util from './util'

/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS relative */
  function() {
    Util.execute.call(this, 'BVS', 'relative')
  },
  /* 0x71: ADC indirectIndex */
  function() {
    Util.execute.call(this, 'ADC', 'indirectIndex')
  },
  '2',
  '3',
  '4',
  /* 0x75: ADC zeropageX */
  function() {
    Util.execute.call(this, 'ADC', 'zeropageX')
  },
  /* 0x76: ROR zeropageX */
  function() {
    Util.execute.call(this, 'ROR', 'zeropageX')
  },
  '7',
  /* 0x78: SEI implied */
  function() {
    Util.execute.call(this, 'SEI', 'implied')
  },
  /* 0x79: ADC absoluteY */
  function() {
    Util.execute.call(this, 'ADC', 'absoluteY')
  },
  'a',
  'b',
  'c',
  /* 0x7d: ADC absoluteX */
  function() {
    Util.execute.call(this, 'ADC', 'absoluteX')
  },
  /* 0x7e: ROR absoluteX */
  function() {
    Util.execute.call(this, 'ROR', 'absoluteX')
  },
  'f'
]
