/* 0xA0 - 0xAF */
export default [
  /* 0xa0: LDY immediate*/
  { instruction: 'LDY', addressing: 'immediate', cycle: 2 },
  /* 0xa1: LDA indexIndirect */
  { instruction: 'LDA', addressing: 'indexIndirect', cycle: 6 },
  /* 0xA2: LDX immediate */
  { instruction: 'LDX', addressing: 'immediate', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'LAX', addressing: 'indexIndirect', cycle: 6 },
  /* 0xa4: LDY zeropage */
  { instruction: 'LDY', addressing: 'zeropage', cycle: 3 },
  /* 0xa5: LDA zeropage */
  { instruction: 'LDA', addressing: 'zeropage', cycle: 3 },
  /* 0xa6 LDX zeropage */
  { instruction: 'LDX', addressing: 'zeropage', cycle: 3 },
  /* TODO This is not implemented */
  { instruction: 'LAX', addressing: 'zeropage', cycle: 3 },
  /* 0xa8: TAY implied */
  { instruction: 'TAY', addressing: 'implied', cycle: 2 },
  /* 0xa9: LDA immediate */
  { instruction: 'LDA', addressing: 'immediate', cycle: 2 },
  /* 0xaa: TAX implied */
  { instruction: 'TAX', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'LAX', addressing: 'immediate', cycle: 2 },
  /* 0xac: LDY absolute */
  { instruction: 'LDY', addressing: 'absolute', cycle: 4 },
  /* 0xad: LDA absolute */
  { instruction: 'LDA', addressing: 'absolute', cycle: 4 },
  /* 0xae: LDX absolute */
  { instruction: 'LDX', addressing: 'absolute', cycle: 4 },
  /* TODO This is not implemented */
  { instruction: 'LAX', addressing: 'absolute', cycle: 4 }
]
