/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */

  { instruction: 'BPL', addressing: 'relative' },
  /* 0x11 ORA indirectIndex */

  { instruction: 'ORA', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'SLO', addressing: 'null' },
  /* 0x14: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x15: ORA zeropageX*/

  { instruction: 'ORA', addressing: 'zeropageX' },
  /* 0x16: ASL zeropageX */

  { instruction: 'ASL', addressing: 'zeropageX' },
  { instruction: 'SLO', addressing: 'null' },
  /* 0x18: CLC implied */

  { instruction: 'CLC', addressing: 'implied' },
  /* 0x19: ORA abosluteY*/

  { instruction: 'ORA', addressing: 'absoluteY' },
  /* 0x1a: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'SLO', addressing: 'null' },
  /* 0x1c: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0x1d ORA absoluteX */

  { instruction: 'ORA', addressing: 'absoluteX' },
  /* 0x1e ASL absoluteX*/

  { instruction: 'ASL', addressing: 'absoluteX' },
  { instruction: 'SLO', addressing: 'null' }
]
