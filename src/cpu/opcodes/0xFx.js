/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ relative */
  { instruction: 'BEQ', addressing: 'relative', cycles: 2 },
  /* 0xf1: SBC indirectIndex */
  { instruction: 'SBC', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0xf3: ISC indirectIndex */
  { instruction: 'ISC', addressing: 'indirectIndex', cycles: 8 },
  /* 0xf4: 2byte NOP */
  { instruction: 'NOP', addressing: 'zeropageX', cycles: 4 },
  /* 0xf5: SBC zeropageX */
  { instruction: 'SBC', addressing: 'zeropageX', cycles: 4 },
  /* 0xf6: INC zeropageX */
  { instruction: 'INC', addressing: 'zeropageX', cycles: 6 },
  /* 0xf7: ISC zeropageX */
  { instruction: 'ISC', addressing: 'zeropageX', cycles: 6 },
  /* 0xf8: SED implied */
  { instruction: 'SED', addressing: 'implied', cycles: 2 },
  /* 0xf9 SBC absoluteY */
  { instruction: 'SBC', addressing: 'absoluteY', cycles: 4 },
  /* 0xfa: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* 0xfb: ISC absoluteY */
  { instruction: 'ISC', addressing: 'absoluteY', cycles: 7 },
  /* 0xfc: 3byte NOP */
  { instruction: 'NOP', addressing: 'absoluteX', cycles: 4 },
  /* 0xfd: SBC absoluteX */
  { instruction: 'SBC', addressing: 'absoluteX', cycles: 4 },
  /* 0xfe: INC absoluteX */
  { instruction: 'INC', addressing: 'absoluteX', cycles: 7 },
  /* 0xff: ISC absoluteX */
  { instruction: 'ISC', addressing: 'absoluteX', cycles: 7 }
]
