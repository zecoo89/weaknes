/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR absolute*/
  { instruction: 'JSR', addressing: 'absolute', cycle: 6 },
  /* 0x21: AND indexIndirect */
  { instruction: 'AND', addressing: 'indexIndirect', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycle: 3 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'indexIndirect', cycle: 8 },
  /* 0x24: BIT zeropage */
  { instruction: 'BIT', addressing: 'zeropage', cycle: 3 },
  /* 0x25: AND zeropage */
  { instruction: 'AND', addressing: 'zeropage', cycle: 3 },
  /* 0x26: ROL zeropage */
  { instruction: 'ROL', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'zeropage', cycle: 5 },
  /* 0x28: PLP implied */
  { instruction: 'PLP', addressing: 'implied', cycle: 4 },
  /* 0x29: AND Immediate */
  { instruction: 'AND', addressing: 'immediate', cycle: 2 },
  /* 0x2a: ROL implied (accmulator}*/
  { instruction: 'ROL', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'ANC', addressing: 'immediate', cycle: 2 },
  /* 0x2c: BIT absolute */
  { instruction: 'BIT', addressing: 'absolute', cycle: 4 },
  /* 0x2d: AND absolute */
  { instruction: 'AND', addressing: 'absolute', cycle: 4 },
  /* 0x2e: ROL absolute*/
  { instruction: 'ROL', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'absolute', cycle: 6 }
]
