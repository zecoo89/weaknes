/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */
  { instruction: 'BPL', addressing: 'relative', cycle: 2 },
  /* 0x11 ORA indirectIndex */
  { instruction: 'ORA', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycle: 3 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'indirectIndex', cycle: 8 },
  /* 0x14: 2byte NOP zeropageX */
  { instruction: 'NOP', addressing: 'zeropageX', cycle: 4 },
  /* 0x15: ORA zeropageX*/
  { instruction: 'ORA', addressing: 'zeropageX', cycle: 4 },
  /* 0x16: ASL zeropageX */
  { instruction: 'ASL', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'zeropageX', cycle: 6 },
  /* 0x18: CLC implied */
  { instruction: 'CLC', addressing: 'implied', cycle: 2 },
  /* 0x19: ORA abosluteY*/
  { instruction: 'ORA', addressing: 'absoluteY', cycle: 4 },
  /* 0x1a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'absoluteY', cycle: 8 },
  /* 0x1c: 3byte NOP absoluteX */
  { instruction: 'NOP', addressing: 'absoluteX', cycle: 4 },
  /* 0x1d ORA absoluteX */
  { instruction: 'ORA', addressing: 'absoluteX', cycle: 4 },
  /* 0x1e ASL absoluteX*/
  { instruction: 'ASL', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'absoluteX', cycle: 7 }
]
