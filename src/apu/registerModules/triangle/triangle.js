import Util from '../util'

export default {
  0x4008: function(bits) {
    this.triangleWaveCh.linearCounter.isEnabled = !!(bits >> 7)
  },

  0x400a: function(bits) {
    const timerHigh = this.triangleWaveCh.timer & 0b11100000000
    this.triangleWaveCh.timer = timerHigh | bits
  },

  0x400b: function(bits) {
    const timerHigh = bits & 0b00000111
    const timerLow = this.triangleWaveCh.timer & 0b00011111111
    this.triangleWaveCh.timer = (timerHigh << 8) | timerLow

    const clock = Util.CPU_CLOCK.NTSC
    const timer = this.triangleWaveCh.timer
    this.triangleWaveCh.frequency = clock / (32 * (timer + 1))

    this.triangleWaveCh.duration.value = bits >> 3

    this.audio ? this.audio.sound('triangle', this.triangleWaveCh) : null
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
