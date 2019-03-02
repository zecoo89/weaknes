/* 0xb0 - 0xbF */
export default [
  /* 0xb0: BCS implied */
  { instruction: 'BCS', addressing: 'relative', cycles: 2 },
  /* 0xb1: LDA indirectIndex */
  { instruction: 'LDA', addressing: 'indirectIndex', cycles: 5 },
  /* TODO This is not implemented */
  { instruction: 'STP', addressing: 'implied', cycles: 3 },
  /* 0xb3: LAX indirectIndex */
  { instruction: 'LAX', addressing: 'indirectIndex', cycles: 5 },
  /* 0xb4: LDY zeropageX */
  { instruction: 'LDY', addressing: 'zeropageX', cycles: 4 },
  /* 0xb5: LDA zeropageX */
  { instruction: 'LDA', addressing: 'zeropageX', cycles: 4 },
  /* 0xb6: LDX zeropageY */
  { instruction: 'LDX', addressing: 'zeropageY', cycles: 4 },
  /* 0xb7: LAX zeropageY */
  { instruction: 'LAX', addressing: 'zeropageY', cycles: 4 },
  /* 0xb8: CLV implied */
  { instruction: 'CLV', addressing: 'implied', cycles: 2 },
  /* 0xb9: LDA absoluteY */
  { instruction: 'LDA', addressing: 'absoluteY', cycles: 4 },
  /* 0xba: TSX implied */
  { instruction: 'TSX', addressing: 'implied', cycles: 4 },
  /* 0xbb: LAS absoluteY */
  { instruction: 'LAS', addressing: 'absoluteY', cycles: 4 },
  /* 0xbc: LDY absoluteX*/
  { instruction: 'LDY', addressing: 'absoluteX', cycles: 4 },
  /* 0xbd: LDA bsoluteX */
  { instruction: 'LDA', addressing: 'absoluteX', cycles: 4 },
  /* 0xbe: LDX absoluteY*/
  { instruction: 'LDX', addressing: 'absoluteY', cycles: 4 },
  /* 0xbf: LAX absoluteY */
  { instruction: 'LAX', addressing: 'absoluteY', cycles: 4 }
]
