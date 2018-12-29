/* 0x80 - 0x8F */
export default [
  /* 0x80: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x81: STA indexIndirect */

  { instruction: 'STA', addressing: 'indexIndirect' },
  /* 0x82: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  { instruction: 'SAX', addressing: 'null' },
  /* 0x84: STY zeropage */

  { instruction: 'STY', addressing: 'zeropage' },
  /* 0x85: STA zeropage */

  { instruction: 'STA', addressing: 'zeropage' },
  /* 0x86: STX Zeropage */

  { instruction: 'STX', addressing: 'zeropage' },
  { instruction: 'SAX', addressing: 'null' },
  /* 0x88: DEY implied */

  { instruction: 'DEY', addressing: 'implied' },
  /* 0x89: 2byte NOP (Use zeropage for 2byte}*/

  { instruction: 'NOP', addressing: 'zeropage' },
  /* 0x8a: TXA implied */

  { instruction: 'TXA', addressing: 'implied' },
  { instruction: 'XAA', addressing: 'null' },
  /* 0x8c STY absolute */

  { instruction: 'STY', addressing: 'absolute' },
  /* 0x8d: STA absolute */

  { instruction: 'STA', addressing: 'absolute' },
  /* 0x8e: STX absolute*/

  { instruction: 'STX', addressing: 'absolute' },
  { instruction: 'SAX', addressing: 'null' }
]
