/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR absolute*/
  { instruction: 'JSR', addressing: 'absolute', cycles: 6 },
  /* 0x21: AND indexIndirect */
  { instruction: 'AND', addressing: 'indexIndirect', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'indexIndirect', cycles: 8 },
  /* 0x24: BIT zeropage */
  { instruction: 'BIT', addressing: 'zeropage', cycles: 3 },
  /* 0x25: AND zeropage */
  { instruction: 'AND', addressing: 'zeropage', cycles: 3 },
  /* 0x26: ROL zeropage */
  { instruction: 'ROL', addressing: 'zeropage', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'zeropage', cycles: 5 },
  /* 0x28: PLP implied */
  { instruction: 'PLP', addressing: 'implied', cycles: 4 },
  /* 0x29: AND Immediate */
  { instruction: 'AND', addressing: 'immediate', cycles: 2 },
  /* 0x2a: ROL implied (accmulator}*/
  { instruction: 'ROL', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'ANC', addressing: 'immediate', cycles: 2 },
  /* 0x2c: BIT absolute */
  { instruction: 'BIT', addressing: 'absolute', cycles: 4 },
  /* 0x2d: AND absolute */
  { instruction: 'AND', addressing: 'absolute', cycles: 4 },
  /* 0x2e: ROL absolute*/
  { instruction: 'ROL', addressing: 'absolute', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'RLA', addressing: 'absolute', cycles: 6 }
]
