/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS relative */
  { instruction: 'BVS', addressing: 'relative', cycles: 2 },
  /* 0x71: ADC indirectIndex */
  { instruction: 'ADC', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'indirectIndex', cycles: 8 },
  /* 0x74: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycles: 4 },
  /* 0x75: ADC zeropageX */
  { instruction: 'ADC', addressing: 'zeropageX', cycles: 4 },
  /* 0x76: ROR zeropageX */
  { instruction: 'ROR', addressing: 'zeropageX', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'zeropageX', cycles: 6 },
  /* 0x78: SEI implied */
  { instruction: 'SEI', addressing: 'implied', cycles: 2 },
  /* 0x79: ADC absoluteY */
  { instruction: 'ADC', addressing: 'absoluteY', cycles: 4 },
  /* 0x7a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'absoluteY', cycles: 7 },
  /* 0x7c: 3byte NOP (Use absolute for 3byte}*/
  { instruction: 'NOP', addressing: 'absolute', cycles: 4 },
  /* 0x7d: ADC absoluteX */
  { instruction: 'ADC', addressing: 'absoluteX', cycles: 4 },
  /* 0x7e: ROR absoluteX */
  { instruction: 'ROR', addressing: 'absoluteX', cycles: 7 },
  /* TODO This is not implemented */
  { instruction: 'RRA', addressing: 'absoluteX', cycles: 7 }
]
