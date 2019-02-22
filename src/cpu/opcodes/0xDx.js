/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE relative */
  { instruction: 'BNE', addressing: 'relative', cycles: 2 },
  /* 0xd1: CMP indirectIndex */
  { instruction: 'CMP', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'indirectIndex', cycles: 8 },
  /* 0xd4: 2byte NOP */
  { instruction: 'NOP', addressing: 'zeropageX', cycles: 4 },
  /* 0xd5: CMP zeropageX */
  { instruction: 'CMP', addressing: 'zeropageX', cycles: 4 },
  /* 0xd6: DEC zeropageX */
  { instruction: 'DEC', addressing: 'zeropageX', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'zeropageX', cycles: 6 },
  /* 0xd8: CLD implied */
  { instruction: 'CLD', addressing: 'implied', cycles: 2 },
  /* 0xd9: CMP absoluteY */
  { instruction: 'CMP', addressing: 'absoluteY', cycles: 4 },
  /* 0xda: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'absoluteY', cycles: 7 },
  /* 0xdc: 3byte NOP */
  { instruction: 'NOP', addressing: 'absoluteX', cycles: 4 },
  /* 0xdd: CMP absoluteX */
  { instruction: 'CMP', addressing: 'absoluteX', cycles: 4 },
  /* 0xde: DEC absoluteX */
  { instruction: 'DEC', addressing: 'absoluteX', cycles: 7 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'absoluteX', cycles: 7 }
]
