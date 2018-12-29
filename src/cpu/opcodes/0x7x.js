/* 0x70 - 0x7F */
export default [
  /* 0x70: BVS relative */

  { instruction: 'BVS', addressing: 'relative' },
  /* 0x71: ADC indirectIndex */

  { instruction: 'ADC', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'RRA', addressing: 'null' },
  /* 0x74: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x75: ADC zeropageX */

  { instruction: 'ADC', addressing: 'zeropageX' },
  /* 0x76: ROR zeropageX */

  { instruction: 'ROR', addressing: 'zeropageX' },
  { instruction: 'RRA', addressing: 'null' },
  /* 0x78: SEI implied */

  { instruction: 'SEI', addressing: 'implied' },
  /* 0x79: ADC absoluteY */

  { instruction: 'ADC', addressing: 'absoluteY' },
  /* 0x7a: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'RRA', addressing: 'null' },
  /* 0x7c: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0x7d: ADC absoluteX */

  { instruction: 'ADC', addressing: 'absoluteX' },
  /* 0x7e: ROR absoluteX */

  { instruction: 'ROR', addressing: 'absoluteX' },
  { instruction: 'RRA', addressing: 'null' }
]
