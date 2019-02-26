/* 0x60 - 0x6F */
export default [
  /* 0x60: RTS implied */
  { instruction: 'RTS', addressing: 'implied', cycles: 6 },
  /* 0x61: ADC indexIndirect */
  { instruction: 'ADC', addressing: 'indexIndirect', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0x63: RRA indexIndirect */
  { instruction: 'RRA', addressing: 'indexIndirect', cycles: 8 },
  /* 0x64: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycles: 3 },
  /* 0x65: ADC zeropage */
  { instruction: 'ADC', addressing: 'zeropage', cycles: 3 },
  /* 0x66: ROR zeropage */
  { instruction: 'ROR', addressing: 'zeropage', cycles: 5 },
  /* 0x67: RRA zeropage */
  { instruction: 'RRA', addressing: 'zeropage', cycles: 5 },
  /* 0x68: PLA implied */
  { instruction: 'PLA', addressing: 'implied', cycles: 4 },
  /* 0x69: ADC immediate */
  { instruction: 'ADC', addressing: 'immediate', cycles: 2 },
  /* 0x6a: ROR implied (accmulator} */
  { instruction: 'ROR', addressing: 'implied', cycles: 2 },
  /* 0x6b: ARR immediate */
  { instruction: 'ARR', addressing: 'immediate', cycles: 2 },
  /* 0x6c: JMP indirect */
  { instruction: 'JMP', addressing: 'indirect', cycles: 5 },
  /* 0x6d: ADC absolute */
  { instruction: 'ADC', addressing: 'absolute', cycles: 4 },
  /* 0x6e: ROR absolute */
  { instruction: 'ROR', addressing: 'absolute', cycles: 6 },
  /* 0x6f: RRA absolute */
  { instruction: 'RRA', addressing: 'absolute', cycles: 6 }
]
