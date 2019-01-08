/* 0x30 - 0x3F */
export default [
  /* 0x30: BMI relative */
  { instruction: 'BMI', addressing: 'relative', cycle: 2 },
  /* 0x31: AND indirectIndex */
  { instruction: 'AND', addressing: 'indirectIndex', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycle: 3 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'indirectIndex', cycle: 8 },
  /* 0x34: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 4 },
  /* 0x35: AND zeropageX */
  { instruction: 'AND', addressing: 'zeropageX', cycle: 4 },
  /* 0x36 ROL zeropageX */
  { instruction: 'ROL', addressing: 'zeropageX', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'zeropageX', cycle: 6 },
  /* 0x38: SEC implied */
  { instruction: 'SEC', addressing: 'implied', cycle: 2 },
  /* 0x39: AND absoluteY*/
  { instruction: 'AND', addressing: 'absoluteY', cycle: 4 },
  /* 0x3a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'absoluteY', cycle: 7 },
  /* 0x3c: 3byte NOP (Use absolute for 3byte}*/
  { instruction: 'NOP', addressing: 'absolute', cycle: 4 },
  /* 0x3d: AND absoluteX */
  { instruction: 'AND', addressing: 'absoluteX', cycle: 4 },
  /* 0x3e: ROL absoluteX */
  { instruction: 'ROL', addressing: 'absoluteX', cycle: 7 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'absoluteX', cycle: 7 }
]
