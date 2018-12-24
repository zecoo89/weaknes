import Util from './util'

/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS implied */
  function() {
    Util.execute.call(this, 'RTS', 'implied')
  },
  /* 0x61: ADC indexIndirect */
  function() {
    Util.execute.call(this, 'ADC', 'indexIndirect')
  },
  '2:STP',
  '3:RRA',
  /* 0x64: 2byte NOP (Use zeropage for 2byte)*/
  function() {
    Util.execute.call(this, 'NOP', 'zeropage')
  },
  /* 0x65: ADC zeropage */
  function() {
    Util.execute.call(this, 'ADC', 'zeropage')
  },
  /* 0x66: ROR zeropage */
  function() {
    Util.execute.call(this, 'ROR', 'zeropage')
  },
  '7:RRA',
  /* 0x68: PLA implied */
  function() {
    Util.execute.call(this, 'PLA', 'implied')
  },
  /* 0x69: ADC immediate */
  function() {
    Util.execute.call(this, 'ADC', 'immediate')
  },
  /* 0x6a: ROR implied (accmulator) */
  function() {
    Util.execute.call(this, 'ROR', 'implied')
  },
  'b:ROR',
  /* 0x6c: JMP indirect */
  function() {
    Util.execute.call(this, 'JMP', 'indirect')
  },
  /* 0x6d: ADC absolute */
  function() {
    Util.execute.call(this, 'ADC', 'absolute')
  },
  /* 0x6e ROR absolute*/
  function() {
    Util.execute.call(this, 'ROR', 'absolute')
  },
  'f:RRA'
]
