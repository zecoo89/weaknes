/* 0x20 - 0x2F */
export default [
  /* 0x20: JSR absolute*/

  { instruction: 'JSR', addressing: 'absolute' },
  /* 0x21: AND indexIndirect */

  { instruction: 'AND', addressing: 'indexIndirect' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'RLA', addressing: 'null' },
  /* 0x24: BIT zeropage */

  { instruction: 'BIT', addressing: 'zeropage' },
  /* 0x25: AND zeropage */

  { instruction: 'AND', addressing: 'zeropage' },
  /* 0x26: ROL zeropage */

  { instruction: 'ROL', addressing: 'zeropage' },
  { instruction: 'RLA', addressing: 'null' },
  /* 0x28: PLP implied */

  { instruction: 'PLP', addressing: 'implied' },
  /* 0x29: AND Immediate */

  { instruction: 'AND', addressing: 'immediate' },
  /* 0x2a: ROL implied (accmulator}*/

  { instruction: 'ROL', addressing: 'implied' },
  { instruction: 'ANC', addressing: 'null' },
  /* 0x2c: BIT absolute */

  { instruction: 'BIT', addressing: 'absolute' },
  /* 0x2d: AND absolute */

  { instruction: 'AND', addressing: 'absolute' },
  /* 0x2e: ROL absolute*/

  { instruction: 'ROL', addressing: 'absolute' },
  'f:RLA'
]
