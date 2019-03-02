/* 0x50 - 0x5F */
export default [
  /* 0x50: BVC relative */
  { instruction: 'BVC', addressing: 'relative', cycles: 2 },
  /* 0x51: EOR indirectIndex */
  { instruction: 'EOR', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0x53: SRE indirectIndex */
  { instruction: 'SRE', addressing: 'indirectIndex', cycles: 8 },
  /* 0x54: 2byte NOP zeropageX */
  { instruction: 'NOP', addressing: 'zeropageX', cycles: 4 },
  /* 0x55: EOR zeropageX */
  { instruction: 'EOR', addressing: 'zeropageX', cycles: 4 },
  /* 0x56: LSR zeropageX */
  { instruction: 'LSR', addressing: 'zeropageX', cycles: 6 },
  /* 0x57: SRE zeropageX */
  { instruction: 'SRE', addressing: 'zeropageX', cycles: 6 },
  /* 0x58: CLI */
  { instruction: 'CLI', addressing: 'implied', cycles: 2 },
  /* 0x59: EOR absoluteY */
  { instruction: 'EOR', addressing: 'absoluteY', cycles: 4 },
  /* 0x5a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* 0x5b: SRE absoluteY */
  { instruction: 'SRE', addressing: 'absoluteY', cycles: 7 },
  /* 0x5c: 3byte NOP (Use absolute for 3byte}*/
  { instruction: 'NOP', addressing: 'absolute', cycles: 4 },
  /* 0x5d EOR absoluteX */
  { instruction: 'EOR', addressing: 'absoluteX', cycles: 4 },
  /* 0x5e LSR absoluteX */
  { instruction: 'LSR', addressing: 'absoluteX', cycles: 7 },
  /* 0x5f SRE absoluteX */
  { instruction: 'SRE', addressing: 'absoluteX', cycles: 7 }
]
