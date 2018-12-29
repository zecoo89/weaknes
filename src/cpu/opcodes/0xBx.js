/* 0xb0 - 0xbF */
export default [
  /* 0xb0: BCS implied */

  { instruction: 'BCS', addressing: 'relative' },
  /* 0xb1: LDA indirectIndex */

  { instruction: 'LDA', addressing: 'indirectIndex' },
  { instruction: 'STP', addressing: 'null' },
  { instruction: 'LAX', addressing: 'null' },
  /* 0xb4: LDY zeropageX */

  { instruction: 'LDY', addressing: 'zeropageX' },
  /* 0xb5: LDA zeropageX */

  { instruction: 'LDA', addressing: 'zeropageX' },
  /* 0xb6: LDX zeropageY */

  { instruction: 'LDX', addressing: 'zeropageY' },
  { instruction: 'LAX', addressing: 'null' },
  /* 0xb8: CLV implied */

  { instruction: 'CLV', addressing: 'implied' },
  /* 0xb9: LDA absoluteY */

  { instruction: 'LDA', addressing: 'absoluteY' },
  /* 0xba: TSX implied */

  { instruction: 'TSX', addressing: 'implied' },
  { instruction: 'LAS', addressing: 'null' },
  /* 0xbc: LDY absoluteX*/

  { instruction: 'LDY', addressing: 'absoluteX' },
  /* 0xbd: LDA bsoluteX */

  { instruction: 'LDA', addressing: 'absoluteX' },
  /* 0xbe: LDX absoluteY*/

  { instruction: 'LDX', addressing: 'absoluteY' },
  { instruction: 'LAX', addressing: 'null' }
]
