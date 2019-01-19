export default function isNodejs() {
  return typeof process !== 'undefined' && typeof require !== 'undefined'
}
