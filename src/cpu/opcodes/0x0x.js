/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK implied */

  { instruction: 'BRK', addressing: 'implied' },
  /* 0x01: ORA indexIndirect */

  { instruction: 'ORA', addressing: 'indexIndirect' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'SLO', addressing: 'null' },
  /* 0x04: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x05: ORA zeropage */

  { instruction: 'ORA', addressing: 'zeropage' },
  /* 0x06 ASL zeropage */

  { instruction: 'ASL', addressing: 'zeropage' },
  { instruction: 'SLO', addressing: 'null' },
  /* 0x08: PHP*/

  { instruction: 'PHP', addressing: 'implied' },
  /* 0x09: ORA immediate */

  { instruction: 'ORA', addressing: 'immediate' },
  /* 0x0a: ASL implied(accmulator}*/

  { instruction: 'ASL', addressing: 'implied' },
  { instruction: 'ANC', addressing: 'null' },
  /* 0x0c: 3byte NOP (Use absolute for 2byte}*/

  { instruction: 'NOP', addressing: 'absolute' },
  /* 0x0d: ORA absolute */

  { instruction: 'ORA', addressing: 'absolute' },
  /* 0x0e: ASL absolute */

  { instruction: 'ASL', addressing: 'absolute' },
  { instruction: 'SLO', addressing: 'null' }
]
