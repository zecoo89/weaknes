/* 0xe0 - 0xeF */
export default [
  /* 0xe0: CPX immediate */
  { instruction: 'CPX', addressing: 'immediate', cycles: 2 },
  /* 0xe1: SBC indexIndirect */
  { instruction: 'SBC', addressing: 'indexIndirect', cycles: 6 },
  /* 0xe2: 2byte NOP */
  { instruction: 'NOP', addressing: 'immediate', cycles: 2 },
  /* 0xe3: ISC indexIndirect */
  { instruction: 'ISC', addressing: 'indexIndirect', cycles: 8 },
  /* 0xe4: CPX zeropage */
  { instruction: 'CPX', addressing: 'zeropage', cycles: 3 },
  /* 0xe5: SBC zeropage */
  { instruction: 'SBC', addressing: 'zeropage', cycles: 3 },
  /* 0xe6: INC zeropage */
  { instruction: 'INC', addressing: 'zeropage', cycles: 5 },
  /* 0xe7: ISC zeropage */
  { instruction: 'ISC', addressing: 'zeropage', cycles: 5 },
  /* 0xe8: INX implied */
  { instruction: 'INX', addressing: 'implied', cycles: 2 },
  /* 0xe9: SBC immediate */
  { instruction: 'SBC', addressing: 'immediate', cycles: 2 },
  /* 0xea: NOP implied */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* 0xeb: SBC immediate */
  { instruction: 'SBC', addressing: 'immediate', cycles: 2 },
  /* 0xec: CPX absolute */
  { instruction: 'CPX', addressing: 'absolute', cycles: 4 },
  /* 0xed: SBC absolute */
  { instruction: 'SBC', addressing: 'absolute', cycles: 4 },
  /* 0xee: INC absolute */
  { instruction: 'INC', addressing: 'absolute', cycles: 6 },
  /* 0xef: ISC absolute */
  { instruction: 'ISC', addressing: 'absolute', cycles: 6 }
]
