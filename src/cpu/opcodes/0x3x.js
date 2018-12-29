/* 0x30 - 0x3F */
export default [
  /* 0x30: BMI relative */

  { instruction: 'BMI', addressing: 'relative' },
  /* 0x31: AND indirectIndex */

  { instruction: 'AND', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'RLA', addressing: 'null' },
  /* 0x34: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x35: AND zeropageX */

  { instruction: 'AND', addressing: 'zeropageX' },
  /* 0x36 ROL zeropageX */

  { instruction: 'ROL', addressing: 'zeropageX' },
  { instruction: 'RLA', addressing: 'null' },
  /* 0x38: SEC implied */

  { instruction: 'SEC', addressing: 'implied' },
  /* 0x39: AND absoluteY*/

  { instruction: 'AND', addressing: 'absoluteY' },
  /* 0x3a: NOP */

  { instruction: 'NOP', addressing: 'implied' },
  { instruction: 'RLA', addressing: 'null' },
  /* 0x3c: 3byte NOP (Use absolute for 3byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0x3d: AND absoluteX */

  { instruction: 'AND', addressing: 'absoluteX' },
  /* 0x32: ROL absoluteX */

  { instruction: 'ROL', addressing: 'absoluteX' },
  { instruction: 'RLA', addressing: 'null' }
]
