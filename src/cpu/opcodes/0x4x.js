import Util from './util'

/* 0x40 - 0x4F */
export default [
  /* 0x40: RTI implied */
  function() {
    Util.execute.call(this, 'RTI', 'implied')
  },
  /* 0x41: EOR indexIndirect */
  function() {
    Util.execute.call(this, 'EOR', 'indexIndirect')
  },
  '2',
  '3',
  '4',
  /* 0x45: EOR zeropage */
  function() {
    Util.execute.call(this, 'EOR', 'zeropage')
  },
  /* 0x46: LSR zeropage*/
  function() {
    Util.execute.call(this, 'LSR', 'zeropage')
  },
  '7',
  /* 0x48: PHA implied */
  function() {
    Util.execute.call(this, 'PHA', 'implied')
  },
  /* 0x49: EOR immediate */
  function() {
    Util.execute.call(this, 'EOR', 'immediate')
  },
  /* 0x4a: LSR implied(accumulator) */
  function() {
    Util.execute.call(this, 'LSR', 'implied')
  },
  'b',
  /* 0x4c: JMP absolute */
  function() {
    Util.execute.call(this, 'JMP', 'absolute')
  },
  /* 0x4d: EOR absolute*/
  function() {
    Util.execute.call(this, 'EOR', 'absolute')
  },
  /* 0x4e: LSR absolute*/
  function() {
    Util.execute.call(this, 'LSR', 'absolute')
  },
  'f'
]
