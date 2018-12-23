export default class Util {
  static isNodejs() {
    return typeof process !== 'undefined' && typeof require !== 'undefined'
  }
}
