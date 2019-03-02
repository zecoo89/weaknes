/* 0x40 - 0x4F */
export default [
  /* 0x40: RTI implied */
  { instruction: 'RTI', addressing: 'implied', cycles: 6 },
  /* 0x41: EOR indexIndirect */
  { instruction: 'EOR', addressing: 'indexIndirect', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0x43: SRE indexIndirect */
  { instruction: 'SRE', addressing: 'indexIndirect', cycles: 8 },
  /* 0x44: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycles: 3 },
  /* 0x45: EOR zeropage */
  { instruction: 'EOR', addressing: 'zeropage', cycles: 3 },
  /* 0x46: LSR zeropage*/
  { instruction: 'LSR', addressing: 'zeropage', cycles: 5 },
  /* 0x47: SRE zeropage */
  { instruction: 'SRE', addressing: 'zeropage', cycles: 5 },
  /* 0x48: PHA implied */
  { instruction: 'PHA', addressing: 'implied', cycles: 3 },
  /* 0x49: EOR immediate */
  { instruction: 'EOR', addressing: 'immediate', cycles: 2 },
  /* 0x4a: LSR implied(accumulator} */
  { instruction: 'LSR', addressing: 'implied', cycles: 2 },
  /* 0x4b: ALR immediate */
  { instruction: 'ALR', addressing: 'immediate', cycles: 2 },
  /* 0x4c: JMP absolute */
  { instruction: 'JMP', addressing: 'absolute', cycles: 3 },
  /* 0x4d: EOR absolute*/
  { instruction: 'EOR', addressing: 'absolute', cycles: 4 },
  /* 0x4e: LSR absolute*/
  { instruction: 'LSR', addressing: 'absolute', cycles: 6 },
  /* 0x4f: SRE absolute */
  { instruction: 'SRE', addressing: 'absolute', cycles: 6 }
]
