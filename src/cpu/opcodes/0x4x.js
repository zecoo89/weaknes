/* 0x40 - 0x4F */
export default [
  /* 0x40: RTI implied */
  { instruction: 'RTI', addressing: 'implied', cycle: 6 },
  /* 0x41: EOR indexIndirect */
  { instruction: 'EOR', addressing: 'indexIndirect', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'null', cycle: null },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'indexIndirect', cycle: 8 },
  /* 0x44: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 3 },
  /* 0x45: EOR zeropage */
  { instruction: 'EOR', addressing: 'zeropage', cycle: 3 },
  /* 0x46: LSR zeropage*/
  { instruction: 'LSR', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'zeropage', cycle: 5 },
  /* 0x48: PHA implied */
  { instruction: 'PHA', addressing: 'implied', cycle: 3 },
  /* 0x49: EOR immediate */
  { instruction: 'EOR', addressing: 'immediate', cycle: 2 },
  /* 0x4a: LSR implied(accumulator} */
  { instruction: 'LSR', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'ALR', addressing: 'immediate', cycle: 2 },
  /* 0x4c: JMP absolute */
  { instruction: 'JMP', addressing: 'absolute', cycle: 3 },
  /* 0x4d: EOR absolute*/
  { instruction: 'EOR', addressing: 'absolute', cycle: 4 },
  /* 0x4e: LSR absolute*/
  { instruction: 'LSR', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'SRE', addressing: 'absolute', cycle: 6 }
]
