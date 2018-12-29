/* 0xc0 - 0xcF */
export default [
  /* 0xc0: CPY immediate */
  { instruction: 'CPY', addressing: 'immediate', cycle: 2 },
  /* 0xc1: CMP indexIndirect */
  { instruction: 'CMP', addressing: 'indexIndirect', cycle: 6 },
  /* 0xc2: NOP*/
  { instruction: 'NOP', addressing: 'immediate', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'indexIndirect', cycle: 8 },
  /* 0xc4: CPY zeropage*/
  { instruction: 'CPY', addressing: 'zeropage', cycle: 3 },
  /* 0xc5: CMP zeropage */
  { instruction: 'CMP', addressing: 'zeropage', cycle: 3 },
  /* 0xc6: DEC zeropage*/
  { instruction: 'DEC', addressing: 'zeropage', cycle: 5 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'zeropage', cycle: 5 },
  /* 0xc8: INY implied */
  { instruction: 'INY', addressing: 'implied', cycle: 2 },
  /* 0xc9: CMP immediate */
  { instruction: 'CMP', addressing: 'immediate', cycle: 2 },
  /* 0xca: DEX implied */
  { instruction: 'DEX', addressing: 'implied', cycle: 2 },
  /* TODO This is not implemented */
  { instruction: 'AXS', addressing: 'immediate', cycle: 2 },
  /* 0xcc: CPY absolute */
  { instruction: 'CPY', addressing: 'absolute', cycle: 4 },
  /* 0xcd: CMP absolute*/
  { instruction: 'CMP', addressing: 'absolute', cycle: 4 },
  /* 0xce: DEC absolute */
  { instruction: 'DEC', addressing: 'absolute', cycle: 6 },
  /* TODO This is not implemented */
  { instruction: 'DCP', addressing: 'absolute', cycle: 6 }
]
