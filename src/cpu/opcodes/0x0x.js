/* 0x00 - 0x0F */
export default [
  /* 0x00: BRK implied */
  { instruction: 'BRK', addressing: 'implied', cycles: 7 },
  /* 0x01: ORA indexIndirect */
  { instruction: 'ORA', addressing: 'indexIndirect', cycles: 6 },
  /* TODO This is not implemented*/
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0x03: SLO zeropage */
  { instruction: 'SLO', addressing: 'indexIndirect', cycles: 8 },
  /* 0x04: 2byte NOP zeropage */
  { instruction: 'NOP', addressing: 'zeropage', cycles: 3 },
  /* 0x05: ORA zeropage */
  { instruction: 'ORA', addressing: 'zeropage', cycles: 3 },
  /* 0x06 ASL zeropage */
  { instruction: 'ASL', addressing: 'zeropage', cycles: 5 },
  /* TODO This is not implemented*/
  { instruction: 'SLO', addressing: 'zeropage', cycles: 5 },
  /* 0x08: PHP*/
  { instruction: 'PHP', addressing: 'implied', cycles: 3 },
  /* 0x09: ORA immediate */
  { instruction: 'ORA', addressing: 'immediate', cycles: 2 },
  /* 0x0a: ASL implied(accmulator}*/
  { instruction: 'ASL', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented*/
  { instruction: 'ANC', addressing: 'immediate', cycles: 2 },
  /* 0x0c: 3byte NOP absolute */
  { instruction: 'NOP', addressing: 'absolute', cycles: 4 },
  /* 0x0d: ORA absolute */
  { instruction: 'ORA', addressing: 'absolute', cycles: 4 },
  /* 0x0e: ASL absolute */
  { instruction: 'ASL', addressing: 'absolute', cycles: 6 },
  /* TODO This is not implemented*/
  { instruction: 'SLO', addressing: 'absolute', cycles: 6 }
]
