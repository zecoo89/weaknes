/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE relative */

  { instruction: 'BNE', addressing: 'relative' },
  /* 0xd1: CMP indirectIndex */

  { instruction: 'CMP', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'DCP', addressing: 'null' },
  /* 0xd4: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0xd5: CMP zeropageX */

  { instruction: 'CMP', addressing: 'zeropageX' },
  /* 0xd6: DEC zeropageX */

  { instruction: 'DEC', addressing: 'zeropageX' },
  { instruction: 'DCP', addressing: 'null' },
  /* 0xd8: CLD implied */

  { instruction: 'CLD', addressing: 'implied' },
  /* 0xd9: CMP absoluteY */

  { instruction: 'CMP', addressing: 'absoluteY' },
  /* 0xda: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'DCP', addressing: 'null' },
  /* 0xdc: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0xdd: CMP absoluteX */

  { instruction: 'CMP', addressing: 'absoluteX' },
  /* 0xde: DEC absoluteX */

  { instruction: 'DEC', addressing: 'absoluteX' },
  { instruction: 'DCP', addressing: 'null' }
]
