/* 0xf0 - 0xff */
export default [
  /* 0xf0: BEQ relative */
  { instruction: 'BEQ', addressing: 'relative', cycle: 2 },
  /* 0xf1: SBC indirectIndex */
  { instruction: 'SBC', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycle: 3 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'indirectIndex', cycle: 8 },
  /* 0xf4: 2byte NOP */
  { instruction: 'NOP', addressing: 'zeropageX', cycle: 4 },
  /* 0xf5: SBC zeropageX */
  { instruction: 'SBC', addressing: 'zeropageX', cycle: 4 },
  /* 0xf6: INC zeropageX */
  { instruction: 'INC', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'zeropageX', cycle: 6 },
  /* 0xf8: SED implied */
  { instruction: 'SED', addressing: 'implied', cycle: 2 },
  /* 0xf9 SBC absoluteY */
  { instruction: 'SBC', addressing: 'absoluteY', cycle: 4 },
  /* 0xfa: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'absoluteY', cycle: 7 },
  /* 0xfc: 3byte NOP */
  { instruction: 'NOP', addressing: 'absoluteX', cycle: 4 },
  /* 0xfd: SBC absoluteX */
  { instruction: 'SBC', addressing: 'absoluteX', cycle: 4 },
  /* 0xfe: INC absoluteX */
  { instruction: 'INC', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'ISC', addressing: 'absoluteX', cycle: 7 }
]
