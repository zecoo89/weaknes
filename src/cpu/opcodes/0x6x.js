/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS implied */

  { instruction: 'RTS', addressing: 'implied' },
  /* 0x61: ADC indexIndirect */

  { instruction: 'ADC', addressing: 'indexIndirect' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'RRA', addressing: 'null' },
  /* 0x64: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x65: ADC zeropage */

  { instruction: 'ADC', addressing: 'zeropage' },
  /* 0x66: ROR zeropage */

  { instruction: 'ROR', addressing: 'zeropage' },
  { instruction: 'RRA', addressing: 'null' },
  /* 0x68: PLA implied */

  { instruction: 'PLA', addressing: 'implied' },
  /* 0x69: ADC immediate */

  { instruction: 'ADC', addressing: 'immediate' },
  /* 0x6a: ROR implied (accmulator} */

  { instruction: 'ROR', addressing: 'implied' },
  { instruction: 'ROR', addressing: 'null' },
  /* 0x6c: JMP indirect */

  { instruction: 'JMP', addressing: 'indirect' },
  /* 0x6d: ADC absolute */

  { instruction: 'ADC', addressing: 'absolute' },
  /* 0x6e ROR absolute*/

  { instruction: 'ROR', addressing: 'absolute' },
  { instruction: 'RRA', addressing: 'null' }
]
