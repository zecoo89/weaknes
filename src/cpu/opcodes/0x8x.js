/* 0x80 - 0x8F */
export default [
  /* 0x80: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 2 },
  /* 0x81: STA indexIndirect */
  { instruction: 'STA', addressing: 'indexIndirect', cycle: 6 },
  /* 0x82: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 2 },
  /* 0x83 SAX indexIndirect */
  { instruction: 'SAX', addressing: 'indexIndirect', cycle: 6 },
  /* 0x84: STY zeropage */
  { instruction: 'STY', addressing: 'zeropage', cycle: 3 },
  /* 0x85: STA zeropage */
  { instruction: 'STA', addressing: 'zeropage', cycle: 3 },
  /* 0x86: STX Zeropage */
  { instruction: 'STX', addressing: 'zeropage', cycle: 3 },
  /* 0x87 SAX zeropage */
  { instruction: 'SAX', addressing: 'zeropage', cycle: 3 },
  /* 0x88: DEY implied */
  { instruction: 'DEY', addressing: 'implied', cycle: 2 },
  /* 0x89: 2byte NOP (Use zeropage for 2byte}*/
  { instruction: 'NOP', addressing: 'zeropage', cycle: 2 },
  /* 0x8a: TXA implied */
  { instruction: 'TXA', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'XAA', addressing: 'immediate', cycle: 2 },
  /* 0x8c STY absolute */
  { instruction: 'STY', addressing: 'absolute', cycle: 4 },
  /* 0x8d: STA absolute */
  { instruction: 'STA', addressing: 'absolute', cycle: 4 },
  /* 0x8e: STX absolute*/
  { instruction: 'STX', addressing: 'absolute', cycle: 4 },
  /* 0x8f SAX absolute */
  { instruction: 'SAX', addressing: 'absolute', cycle: 4 }
]
