/* 0x30 - 0x3F */
export default [
  /* 0x30: BMI relative */
  { instruction: 'BMI', addressing: 'relative', cycles: 2 },
  /* 0x31: AND indirectIndex */
  { instruction: 'AND', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0x33: RLA indirectIndex */
  { instruction: 'RLA', addressing: 'indirectIndex', cycles: 8 },
  /* 0x34: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycles: 4 },
  /* 0x35: AND zeropageX */
  { instruction: 'AND', addressing: 'zeropageX', cycles: 4 },
  /* 0x36: ROL zeropageX */
  { instruction: 'ROL', addressing: 'zeropageX', cycles: 6 },
  /* 0x37: RLA zeropageX */
  { instruction: 'RLA', addressing: 'zeropageX', cycles: 6 },
  /* 0x38: SEC implied */
  { instruction: 'SEC', addressing: 'implied', cycles: 2 },
  /* 0x39: AND absoluteY */
  { instruction: 'AND', addressing: 'absoluteY', cycles: 4 },
  /* 0x3a: NOP */
  { instruction: 'NOP', addressing: 'implied', cycles: 2 },
  /* 0x3b: RLA absoluteY */
  { instruction: 'RLA', addressing: 'absoluteY', cycles: 7 },
  /* 0x3c: 3byte NOP (Use absolute for 3byte} */
  { instruction: 'NOP', addressing: 'absolute', cycles: 4 },
  /* 0x3d: AND absoluteX */
  { instruction: 'AND', addressing: 'absoluteX', cycles: 4 },
  /* 0x3e: ROL absoluteX */
  { instruction: 'ROL', addressing: 'absoluteX', cycles: 7 },
  /* 0x3f: RLA absoluteX */
  { instruction: 'RLA', addressing: 'absoluteX', cycles: 7 }
]
