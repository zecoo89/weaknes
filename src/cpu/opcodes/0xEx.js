/* 0xe0 - 0xeF */
export default [
  /* 0xe0: CPX immediate */
  { instruction: 'CPX', addressing: 'immediate', cycle: 2 },
  /* 0xe1: SBC indexIndirect */
  { instruction: 'SBC', addressing: 'indexIndirect', cycle: 6 },
  /* 0xe0: 2byte NOP */
  { instruction: 'NOP', addressing: 'immediate', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'indexIndirect', cycle: 8 },
  /* 0xe4: CPX zeropage */
  { instruction: 'CPX', addressing: 'zeropage', cycle: 3 },
  /* 0xe5: SBC zeropage*/
  { instruction: 'SBC', addressing: 'zeropage', cycle: 3 },
  /* 0xe6: INC zeropage*/
  { instruction: 'INC', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'zeropage', cycle: 5 },
  /* 0xe8: INX implied */
  { instruction: 'INX', addressing: 'implied', cycle: 2 },
  /* 0xe9: SBC immediate */
  { instruction: 'SBC', addressing: 'immediate', cycle: 2 },
  /* 0xea: NOP implied */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'SBC', addressing: 'immediate', cycle: 2 },
  /* 0xec: CPX absolute */
  { instruction: 'CPX', addressing: 'absolute', cycle: 4 },
  /* 0xed: SBC absolute */
  { instruction: 'SBC', addressing: 'absolute', cycle: 4 },
  /* 0xee: INC absolute*/
  { instruction: 'INC', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'absolute', cycle: 6 }
]
