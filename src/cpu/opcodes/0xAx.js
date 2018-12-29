/* 0xA0 - 0xAF */
export default [
  /* 0xa0: LDY immediate*/

  { instruction: 'LDY', addressing: 'immediate' },
  /* 0xa1: LDA indexIndirect */

  { instruction: 'LDA', addressing: 'indexIndirect' },
  /* 0xA2: LDX immediate */

  { instruction: 'LDX', addressing: 'immediate' },
  { instruction: 'LAX', addressing: 'null' },
  /* 0xa4: LDY zeropage */

  { instruction: 'LDY', addressing: 'zeropage' },
  /* 0xa5: LDA zeropage */

  { instruction: 'LDA', addressing: 'zeropage' },
  /* 0xa6 LDX zeropage */

  { instruction: 'LDX', addressing: 'zeropage' },
  { instruction: 'LAX', addressing: 'null' },
  /* 0xa8: TAY implied */

  { instruction: 'TAY', addressing: 'implied' },
  /* 0xa9: LDA immediate */

  { instruction: 'LDA', addressing: 'immediate' },
  /* 0xaa: TAX implied */

  { instruction: 'TAX', addressing: 'implied' },
  { instruction: 'LAX', addressing: 'null' },
  /* 0xac: LDY absolute */

  { instruction: 'LDY', addressing: 'absolute' },
  /* 0xad: LDA absolute */

  { instruction: 'LDA', addressing: 'absolute' },
  /* 0xae: LDX absolute */

  { instruction: 'LDX', addressing: 'absolute' },
  { instruction: 'LAX', addressing: 'null' }
]
