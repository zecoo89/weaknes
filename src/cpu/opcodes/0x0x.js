/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK implied */
  { instruction: 'BRK', addressing: 'implied', cycle: 7 },
  /* 0x01: ORA indexIndirect */
  { instruction: 'ORA', addressing: 'indexIndirect', cycle: 6 },
  /* TODO This is not implemented*/
  { instruction: 'STP', addressing: 'implied', cycle: 3 },
  /* 0x03: SLO zeropage */
  { instruction: 'SLO', addressing: 'indexIndirect', cycle: 8 },
  /* 0x04: 2byte NOP zeropage */
  { instruction: 'NOP', addressing: 'zeropage', cycle: 3 },
  /* 0x05: ORA zeropage */
  { instruction: 'ORA', addressing: 'zeropage', cycle: 3 },
  /* 0x06 ASL zeropage */
  { instruction: 'ASL', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented*/
  { instruction: 'SLO', addressing: 'zeropage', cycle: 5 },
  /* 0x08: PHP*/
  { instruction: 'PHP', addressing: 'implied', cycle: 3 },
  /* 0x09: ORA immediate */
  { instruction: 'ORA', addressing: 'immediate', cycle: 2 },
  /* 0x0a: ASL implied(accmulator}*/
  { instruction: 'ASL', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented*/
  { instruction: 'ANC', addressing: 'immediate', cycle: 2 },
  /* 0x0c: 3byte NOP absolute */
  { instruction: 'NOP', addressing: 'absolute', cycle: 4 },
  /* 0x0d: ORA absolute */
  { instruction: 'ORA', addressing: 'absolute', cycle: 4 },
  /* 0x0e: ASL absolute */
  { instruction: 'ASL', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented*/
  { instruction: 'SLO', addressing: 'absolute', cycle: 6 }
]
