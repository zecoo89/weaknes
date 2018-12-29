/* 0x90 - 0x9F */
export default [
  /* 0x90: BCC relative*/

  { instruction: 'BCC', addressing: 'relative' },
  /* 0x91: STA indirectIndex */

  { instruction: 'STA', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'AHX', addressing: 'null' },
  /* 0x94: STY zeropageX */

  { instruction: 'STY', addressing: 'zeropageX' },
  /* 0x95: STA zeropageX */

  { instruction: 'STA', addressing: 'zeropageX' },
  /* 0x96: STX zeropageY */

  { instruction: 'STX', addressing: 'zeropageY' },
  { instruction: 'SAX', addressing: 'null' },
  /* 0x98: TYA implied */

  { instruction: 'TYA', addressing: 'implied' },
  /* 0x99: STA absoluteY */

  { instruction: 'STA', addressing: 'absoluteY' },
  /* 0x9a: TXS implied */

  { instruction: 'TXS', addressing: 'implied' },
  { instruction: 'TAS', addressing: 'null' },
  { instruction: 'SHY', addressing: 'null' },
  /* 0x9d: STA absoluteX */

  { instruction: 'STA', addressing: 'absoluteX' },
  { instruction: 'SHX', addressing: 'null' },
  { instruction: 'AHX', addressing: 'null' }
]
