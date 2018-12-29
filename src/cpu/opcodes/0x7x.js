/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS relative */
  { instruction: 'BVS', addressing: 'relative', cycle: 2 },
  /* 0x71: ADC indirectIndex */
  { instruction: 'ADC', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'null', cycle: null },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'indirectIndex', cycle: 8 },
  /* 0x74: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 4 },
  /* 0x75: ADC zeropageX */
  { instruction: 'ADC', addressing: 'zeropageX', cycle: 4 },
  /* 0x76: ROR zeropageX */
  { instruction: 'ROR', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'zeropageX', cycle: 6 },
  /* 0x78: SEI implied */
  { instruction: 'SEI', addressing: 'implied', cycle: 2 },
  /* 0x79: ADC absoluteY */
  { instruction: 'ADC', addressing: 'absoluteY', cycle: 4 },
  /* 0x7a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'null', cycle: 7 },
  /* 0x7c: 3byte NOP (Use absolute for 3byte}*/
  { instruction: 'NOP', addressing: 'absolute', cycle: 4 },
  /* 0x7d: ADC absoluteX */
  { instruction: 'ADC', addressing: 'absoluteX', cycle: 4 },
  /* 0x7e: ROR absoluteX */
  { instruction: 'ROR', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'null', cycle: 7 }
]
