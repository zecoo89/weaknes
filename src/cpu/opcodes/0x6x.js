/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS implied */
  { instruction: 'RTS', addressing: 'implied', cycle: 6 },
  /* 0x61: ADC indexIndirect */
  { instruction: 'ADC', addressing: 'indexIndirect', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'null', cycle: null },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'indexIndirect', cycle: 8 },
  /* 0x64: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 3 },
  /* 0x65: ADC zeropage */
  { instruction: 'ADC', addressing: 'zeropage', cycle: 3 },
  /* 0x66: ROR zeropage */
  { instruction: 'ROR', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'null', cycle: 5 },
  /* 0x68: PLA implied */
  { instruction: 'PLA', addressing: 'implied', cycle: 4 },
  /* 0x69: ADC immediate */
  { instruction: 'ADC', addressing: 'immediate', cycle: 2 },
  /* 0x6a: ROR implied (accmulator} */
  { instruction: 'ROR', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'ARR', addressing: 'immediate', cycle: 2 },
  /* 0x6c: JMP indirect */
  { instruction: 'JMP', addressing: 'indirect', cycle: 5 },
  /* 0x6d: ADC absolute */
  { instruction: 'ADC', addressing: 'absolute', cycle: 4 },
  /* 0x6e ROR absolute*/
  { instruction: 'ROR', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'absolute', cycle: 6 }
]
