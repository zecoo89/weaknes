export default class Util {
  static isNegative(value) {
    return value >> 7
  }

  static isZero(value) {
    return (value === 0x00) & 1
  }

  static msb(value) {
    return value >> 7
  }

  static lsb(value) {
    return value & 0x01
  }
}
