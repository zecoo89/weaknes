import Util from '../util'

export default {
  0x400c: function(bits) {
    this.triangleWaveCh.linearCounter.isEnabled = !!(bits >> 7)
  },

  0x400e: function(bits) {
    const timerHigh = this.triangleWaveCh.timer & 0b11100000000
    this.triangleWaveCh.timer = timerHigh & bits
  },

  0x400f: function(bits) {
    const timerHigh = bits & 0b00000111
    const timerLow = this.triangleWaveCh.timer & 0b00011111111
    this.triangleWaveCh.timer = (timerHigh << 8) & timerLow

    const clock = Util.CPU_CLOCK.NTSC
    const timer = this.triangleWaveCh.timer
    this.triangleWaveCh.frequency = clock / (16 * (timer + 1))
  },

  makeTriangleWaveCh: function() {
    return {
      linearCounter: {
        isEnabled: false,
        length: 0b000000
      },
      duration: {
        isEnabled: 0b0,
        value: 0b0
      },
      timer: 0b00000000000, // 11bit
      frequency: 0b0
    }
  }
}
