/* 0xc0 - 0xcF */
export default [
  /* 0xc0: CPY immediate */
  { instruction: 'CPY', addressing: 'immediate', cycles: 2 },
  /* 0xc1: CMP indexIndirect */
  { instruction: 'CMP', addressing: 'indexIndirect', cycles: 6 },
  /* 0xc2: NOP*/
  { instruction: 'NOP', addressing: 'immediate', cycles: 2 },
  /* 0xc3: DCP indexIndirect */
  { instruction: 'DCP', addressing: 'indexIndirect', cycles: 8 },
  /* 0xc4: CPY zeropage*/
  { instruction: 'CPY', addressing: 'zeropage', cycles: 3 },
  /* 0xc5: CMP zeropage */
  { instruction: 'CMP', addressing: 'zeropage', cycles: 3 },
  /* 0xc6: DEC zeropage*/
  { instruction: 'DEC', addressing: 'zeropage', cycles: 5 },
  /* 0xc7: DCP zeropage */
  { instruction: 'DCP', addressing: 'zeropage', cycles: 5 },
  /* 0xc8: INY implied */
  { instruction: 'INY', addressing: 'implied', cycles: 2 },
  /* 0xc9: CMP immediate */
  { instruction: 'CMP', addressing: 'immediate', cycles: 2 },
  /* 0xca: DEX implied */
  { instruction: 'DEX', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'AXS', addressing: 'immediate', cycles: 2 },
  /* 0xcc: CPY absolute */
  { instruction: 'CPY', addressing: 'absolute', cycles: 4 },
  /* 0xcd: CMP absolute*/
  { instruction: 'CMP', addressing: 'absolute', cycles: 4 },
  /* 0xce: DEC absolute */
  { instruction: 'DEC', addressing: 'absolute', cycles: 6 },
  /* 0xcf: DCP absolute */
  { instruction: 'DCP', addressing: 'absolute', cycles: 6 }
]
