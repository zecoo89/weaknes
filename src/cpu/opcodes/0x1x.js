/* 0x10 - 0x1F */
export default [
  /* 0x10 BPL relative */
  { instruction: 'BPL', addressing: 'relative', cycles: 2 },
  /* 0x11 ORA indirectIndex */
  { instruction: 'ORA', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'indirectIndex', cycles: 8 },
  /* 0x14: 2byte NOP zeropageX */
  { instruction: 'NOP', addressing: 'zeropageX', cycles: 4 },
  /* 0x15: ORA zeropageX*/
  { instruction: 'ORA', addressing: 'zeropageX', cycles: 4 },
  /* 0x16: ASL zeropageX */
  { instruction: 'ASL', addressing: 'zeropageX', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'zeropageX', cycles: 6 },
  /* 0x18: CLC implied */
  { instruction: 'CLC', addressing: 'implied', cycles: 2 },
  /* 0x19: ORA abosluteY*/
  { instruction: 'ORA', addressing: 'absoluteY', cycles: 4 },
  /* 0x1a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'absoluteY', cycles: 8 },
  /* 0x1c: 3byte NOP absoluteX */
  { instruction: 'NOP', addressing: 'absoluteX', cycles: 4 },
  /* 0x1d ORA absoluteX */
  { instruction: 'ORA', addressing: 'absoluteX', cycles: 4 },
  /* 0x1e ASL absoluteX*/
  { instruction: 'ASL', addressing: 'absoluteX', cycles: 7 },
  /* TODO This is not implemented */
  { instruction: 'SLO', addressing: 'absoluteX', cycles: 7 }
]
