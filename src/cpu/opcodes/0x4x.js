/* 0x40 - 0x4F */
export default [
  /* 0x40: RTI implied */

  { instruction: 'RTI', addressing: 'implied' },
  /* 0x41: EOR indexIndirect */

  { instruction: 'EOR', addressing: 'indexIndirect' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'SRE', addressing: 'null' },
  /* 0x44: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x45: EOR zeropage */

  { instruction: 'EOR', addressing: 'zeropage' },
  /* 0x46: LSR zeropage*/

  { instruction: 'LSR', addressing: 'zeropage' },
  { instruction: 'SRE', addressing: 'null' },
  /* 0x48: PHA implied */

  { instruction: 'PHA', addressing: 'implied' },
  /* 0x49: EOR immediate */

  { instruction: 'EOR', addressing: 'immediate' },
  /* 0x4a: LSR implied(accumulator} */

  { instruction: 'LSR', addressing: 'implied' },
  { instruction: 'ALR', addressing: 'null' },
  /* 0x4c: JMP absolute */

  { instruction: 'JMP', addressing: 'absolute' },
  /* 0x4d: EOR absolute*/

  { instruction: 'EOR', addressing: 'absolute' },
  /* 0x4e: LSR absolute*/

  { instruction: 'LSR', addressing: 'absolute' },
  { instruction: 'SRE', addressing: 'null' }
]
