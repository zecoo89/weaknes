export default class Util {
  static dutyCycle(bits_) {
    const bits = bits_ >> 6

    switch (bits) {
      case 0:
        return 0.875
      case 1:
        return 0.75
      case 2:
        return 0.5
      case 3:
        return 0.25
      default:
        throw new Error('Unexpected value.')
    }
  }

  static isDurationEnabled(bits_) {
    const bits = (bits_ >> 5) & 0b1

    return !!bits
  }

  static isDecayEnabled(bits_) {
    const bits = (bits_ >> 4) & 0b1

    return !!bits
  }

  static decayRate(bits) {
    return bits & 0b1111
  }

  static isSweepEnabled(bits_) {
    const bits = bits_ >> 7

    return !!bits
  }

  static sweepRate(bits) {
    return (bits >> 4) & 0b111
  }

  static isSweepUpper(bits_) {
    const bits = (bits_ >> 3) & 0b1

    return !!bits
  }

  static sweepQuantity(bits) {
    return bits & 0b111
  }
}
