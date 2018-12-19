export default {
  isNodejs: () => {
    return typeof process !== 'undefined' && typeof require !== 'undefined'
  }
}
