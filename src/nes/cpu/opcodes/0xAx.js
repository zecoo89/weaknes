/* 0xA0 - 0xAF */
export default [
  /* 0xa0: LDY immediate*/
  { instruction: 'LDY', addressing: 'immediate', cycles: 2 },
  /* 0xa1: LDA indexIndirect */
  { instruction: 'LDA', addressing: 'indexIndirect', cycles: 6 },
  /* 0xA2: LDX immediate */
  { instruction: 'LDX', addressing: 'immediate', cycles: 2 },
  /* 0xA3: LAX indexIndirect */
  { instruction: 'LAX', addressing: 'indexIndirect', cycles: 6 },
  /* 0xa4: LDY zeropage */
  { instruction: 'LDY', addressing: 'zeropage', cycles: 3 },
  /* 0xa5: LDA zeropage */
  { instruction: 'LDA', addressing: 'zeropage', cycles: 3 },
  /* 0xa6 LDX zeropage */
  { instruction: 'LDX', addressing: 'zeropage', cycles: 3 },
  /* 0xa7: LAX zeropage */
  { instruction: 'LAX', addressing: 'zeropage', cycles: 3 },
  /* 0xa8: TAY implied */
  { instruction: 'TAY', addressing: 'implied', cycles: 2 },
  /* 0xa9: LDA immediate */
  { instruction: 'LDA', addressing: 'immediate', cycles: 2 },
  /* 0xaa: TAX implied */
  { instruction: 'TAX', addressing: 'implied', cycles: 2 },
  /* 0xab: LAX immediate */
  { instruction: 'LAX', addressing: 'immediate', cycles: 2 },
  /* 0xac: LDY absolute */
  { instruction: 'LDY', addressing: 'absolute', cycles: 4 },
  /* 0xad: LDA absolute */
  { instruction: 'LDA', addressing: 'absolute', cycles: 4 },
  /* 0xae: LDX absolute */
  { instruction: 'LDX', addressing: 'absolute', cycles: 4 },
  /* 0xaf: LAX absolute */
  { instruction: 'LAX', addressing: 'absolute', cycles: 4 }
]
