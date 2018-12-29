/* 0xd0 - 0xdF */
export default [
  /* 0xd0: BNE relative */
  { instruction: 'BNE', addressing: 'relative', cycle: 2 },
  /* 0xd1: CMP indirectIndex */
  { instruction: 'CMP', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'null', cycle: null },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'indirectIndex', cycle: 8 },
  /* 0xd4: 2byte NOP */
  { instruction: 'NOP', addressing: 'zeropageX', cycle: 4 },
  /* 0xd5: CMP zeropageX */
  { instruction: 'CMP', addressing: 'zeropageX', cycle: 4 },
  /* 0xd6: DEC zeropageX */
  { instruction: 'DEC', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'zeropageX', cycle: 6 },
  /* 0xd8: CLD implied */
  { instruction: 'CLD', addressing: 'implied', cycle: 2 },
  /* 0xd9: CMP absoluteY */
  { instruction: 'CMP', addressing: 'absoluteY', cycle: 4 },
  /* 0xda: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'absoluteY', cycle: 7 },
  /* 0xdc: 3byte NOP */
  { instruction: 'NOP', addressing: 'absoluteX', cycle: 4 },
  /* 0xdd: CMP absoluteX */
  { instruction: 'CMP', addressing: 'absoluteX', cycle: 4 },
  /* 0xde: DEC absoluteX */
  { instruction: 'DEC', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'absoluteX', cycle: 7 }
]
