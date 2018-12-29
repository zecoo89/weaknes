/* 0xe0 - 0xeF */
export default [
  /* 0xe0: CPX immediate */

  { instruction: 'CPX', addressing: 'immediate' },
  /* 0xe1: SBC indexIndirect */

  { instruction: 'SBC', addressing: 'indexIndirect' },
  /* 0xe0: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xe4: CPX zeropage */

  { instruction: 'CPX', addressing: 'zeropage' },
  /* 0xe5: SBC zeropage*/

  { instruction: 'SBC', addressing: 'zeropage' },
  /* 0xe6: INC zeropage*/

  { instruction: 'INC', addressing: 'zeropage' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xe8: INX implied */

  { instruction: 'INX', addressing: 'implied' },
  /* 0xe9: SBC immediate */

  { instruction: 'SBC', addressing: 'immediate' },
  /* 0xea: NOP implied */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'SBC', addressing: 'null' },
  /* 0xec: CPX absolute */

  { instruction: 'CPX', addressing: 'absolute' },
  /* 0xed: SBC absolute */

  { instruction: 'SBC', addressing: 'absolute' },
  /* 0xee: INC absolute*/

  { instruction: 'INC', addressing: 'absolute' },
  { instruction: 'ISC', addressing: 'null' }
]
