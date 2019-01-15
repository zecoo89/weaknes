import Util from '../util'

export default class Controller {
  constructor() {
    this.initFlag = 0
    this.buttonId = 0
    // 0: A, 1: B, 2: SELECT, 3: START, 4: UP, 5: DOWN, 6: LEFT, 7: RIGHT
    this.button = new Array(8).fill(0)

    this.run()
  }

  run() {
    // Node.jsじゃなければキー入力を受け付ける
    !Util.isNodejs() ? this.runKeyListener() : null
  }

  write(value) {
    if ((this.initFlag === 1) & (value === 0)) {
      this.buttonId = 0
    }

    this.initFlag = value
  }

  read() {
    const value = this.button[this.buttonId++]

    if (this.buttonId > 7) this.buttonId = 0

    return value
  }

  runKeyListener() {
    document.addEventListener('keydown', this.handler.bind(this))
    document.addEventListener('keyup', this.handler.bind(this))
  }

  handler(e) {
    const value = e.type === 'keydown' ? 1 : 0

    switch (e.keyCode) {
      case 37: // ← key
        this.button[6] = value
        break
      case 38: // ↑ key
        this.button[4] = value
        break
      case 39: // → key
        this.button[7] = value
        break
      case 40: // ↓ key
        this.button[5] = value
        break
      case 65: // a
        this.button[0] = value
        break
      case 83: // s
        this.button[1] = value
        break
      case 75: // k
        this.button[2] = value
        break
      case 76: // l
        this.button[3] = value
        break
      default:
        break
    }
  }
}
