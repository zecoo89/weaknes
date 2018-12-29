/* 0x50 - 0x5F */
export default [
  /* 0x50: BVC relative */
  { instruction: 'BVC', addressing: 'relative', cycle: 2 },
  /* 0x51: EOR indirectIndex */
  { instruction: 'EOR', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'null', cycle: null },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'indirectIndex', cycle: 8 },
  /* 0x54: 2byte NOP zeropageX */
  { instruction: 'NOP', addressing: 'zeropageX', cycle: 4 },
  /* 0x55: EOR zeropageX */
  { instruction: 'EOR', addressing: 'zeropageX', cycle: 4 },
  /* 0x56: LSR zeropageX */
  { instruction: 'LSR', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'zeropageX', cycle: 6 },
  /* 0x58: CLI */
  { instruction: 'CLI', addressing: 'implied', cycle: 2 },
  /* 0x59: EOR absoluteY */
  { instruction: 'EOR', addressing: 'absoluteY', cycle: 4 },
  /* 0x5a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'absoluteY', cycle: 7 },
  /* 0x5c: 3byte NOP (Use absolute for 3byte}*/
  { instruction: 'NOP', addressing: 'absolute', cycle: 4 },
  /* 0x5d EOR absoluteX */
  { instruction: 'EOR', addressing: 'absoluteX', cycle: 4 },
  /* 0x5e LSR absoluteX */
  { instruction: 'LSR', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'absoluteX', cycle: 7 }
]
