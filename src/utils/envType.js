const env = _envType()

export default env

function _envType() {
  if (typeof process !== 'undefined') {
    if (process.type === 'browser') {
      return 'electron:main'
    } else if (process.type === 'renderer') {
      return 'electron:renderer'
    } else if (!process.type) {
      return 'nodejs'
    } else {
      throw new Error('Unknown enviroment')
    }
  } else {
    return 'browser'
  }
}
