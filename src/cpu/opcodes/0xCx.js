/* 0xc0 - 0xcF */
export default [
  /* 0xc0: CPY immediate */

  { instruction: 'CPY', addressing: 'immediate' },
  /* 0xc1: CMP indexIndirect */

  { instruction: 'CMP', addressing: 'indexIndirect' },
  /* 0xc2: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xc4: CPY zeropage*/

  { instruction: 'CPY', addressing: 'zeropage' },
  /* 0xc5: CMP zeropage */

  { instruction: 'CMP', addressing: 'zeropage' },
  /* 0xc6: DEC zeropage*/

  { instruction: 'DEC', addressing: 'zeropage' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xc8: INY implied */

  { instruction: 'INY', addressing: 'implied' },
  /* 0xc9: CMP immediate */

  { instruction: 'CMP', addressing: 'immediate' },
  /* 0xca: DEX implied */

  { instruction: 'DEX', addressing: 'implied' },
  { instruction: 'SBC', addressing: 'null' },
  /* 0xcc: CPY absolute */

  { instruction: 'CPY', addressing: 'absolute' },
  /* 0xcd: CMP absolute*/

  { instruction: 'CMP', addressing: 'absolute' },
  /* 0xce: DEC absolute */

  { instruction: 'DEC', addressing: 'absolute' },
  { instruction: 'DCP', addressing: 'null' }
]
