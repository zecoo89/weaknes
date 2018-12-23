export default {
  isNegative: value => value >> 7,
  isZero: value => (value === 0x00) & 1,
  msb: value => value >> 7,
  lsb: value => value & 0x01,
  add: (a, b) => (a + b) & 0xff,
  sub: (a, b) => (a - b) & 0xff
}
