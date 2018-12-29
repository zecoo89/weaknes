/* 0x50 - 0x5F */
export default [
  /* 0x50: BVC relative */

  { instruction: 'BVC', addressing: 'relative' },
  /* 0x51: EOR indirectIndex */

  { instruction: 'EOR', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'SRE', addressing: 'null' },
  /* 0x54: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x55: EOR zeropageX */

  { instruction: 'EOR', addressing: 'zeropageX' },
  /* 0x56: LSR zeropageX */

  { instruction: 'LSR', addressing: 'zeropageX' },
  { instruction: 'SRE', addressing: 'null' },
  /* 0x58: CLI */

  { instruction: 'CLI', addressing: 'implied' },
  /* 0x59: EOR absoluteY */

  { instruction: 'EOR', addressing: 'absoluteY' },
  /* 0x5a: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'SRE', addressing: 'null' },
  /* 0x5c: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0x5d EOR absoluteX */

  { instruction: 'EOR', addressing: 'absoluteX' },
  /* 0x5e LSR absoluteX */

  { instruction: 'LSR', addressing: 'absoluteX' },
  { instruction: 'SRE', addressing: 'null' }
]
