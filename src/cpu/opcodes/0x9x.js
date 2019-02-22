/* 0x90 - 0x9F */
export default [
  /* 0x90: BCC relative*/
  { instruction: 'BCC', addressing: 'relative', cycles: 2 },
  /* 0x91: STA indirectIndex */
  { instruction: 'STA', addressing: 'indirectIndex', cycles: 6 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* TODO This is not implemented */
  { instruction: 'AHX', addressing: 'indirectIndex', cycles: 6 },
  /* 0x94: STY zeropageX */
  { instruction: 'STY', addressing: 'zeropageX', cycles: 4 },
  /* 0x95: STA zeropageX */
  { instruction: 'STA', addressing: 'zeropageX', cycles: 4 },
  /* 0x96: STX zeropageY */
  { instruction: 'STX', addressing: 'zeropageY', cycles: 4 },
  /* TODO This is not implemented */
  { instruction: 'SAX', addressing: 'zeropageY', cycles: 4 },
  /* 0x98: TYA implied */
  { instruction: 'TYA', addressing: 'implied', cycles: 2 },
  /* 0x99: STA absoluteY */
  { instruction: 'STA', addressing: 'absoluteY', cycles: 5 },
  /* 0x9a: TXS implied */
  { instruction: 'TXS', addressing: 'implied', cycles: 2 },
  /* TODO This is not implemented */
  { instruction: 'TAS', addressing: 'absoluteY', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'SHY', addressing: 'absoluteX', cycles: 5 },
  /* 0x9d: STA absoluteX */
  { instruction: 'STA', addressing: 'absoluteX', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'SHX', addressing: 'absoluteY', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'AHX', addressing: 'absoluteY', cycles: 5 }
]
