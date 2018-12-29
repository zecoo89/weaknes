/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ relative */

  { instruction: 'BEQ', addressing: 'relative' },
  /* 0xf1: SBC indirectIndex */

  { instruction: 'SBC', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xf4: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0xf5: SBC zeropageX */

  { instruction: 'SBC', addressing: 'zeropageX' },
  /* 0xf6: INC zeropageX */

  { instruction: 'INC', addressing: 'zeropageX' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xf8: SED implied */

  { instruction: 'SED', addressing: 'implied' },
  /* 0xf9 SBC absoluteY */

  { instruction: 'SBC', addressing: 'absoluteY' },
  /* 0xfa: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'ISC', addressing: 'null' },
  /* 0xfc: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0xfd: SBC absoluteX */

  { instruction: 'SBC', addressing: 'absoluteX' },
  /* 0xfe: INC absoluteX */

  { instruction: 'INC', addressing: 'absoluteX' },
  { instruction: 'ISC', addressing: 'null' }
]
