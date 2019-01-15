import SquareUtil from './util'
import Util from '../util'

export default {
  /* 0x4000~0x4003: 短形波チャネル1
   * 0x4004~0x4007: 短形波チャネル2
   * */

  0x4000: function(bits) {
    setSquareWaveControl1(this.squareWaveCh1, bits)
  },

  0x4001: function(bits) {
    setSquareWaveControl2(this.squareWaveCh1, bits)
  },

  0x4002: function(bits) {
    setSquareWaveTimeruency1(this.squareWaveCh1, bits)
  },

  0x4003: function(bits) {
    setSquareWaveTimeruency2(this.squareWaveCh1, bits)
    this.audio.sound('square', this.squareWaveCh1)
  },

  0x4004: function(bits) {
    setSquareWaveControl1(this.squareWaveCh2, bits)
  },

  0x4005: function(bits) {
    setSquareWaveControl2(this.squareWaveCh2, bits)
  },

  0x4006: function(bits) {
    setSquareWaveTimeruency1(this.squareWaveCh2, bits)
  },

  0x4007: function(bits) {
    setSquareWaveTimeruency2(this.squareWaveCh2, bits)
    this.audio.sound('square', this.squareWaveCh2)
  },

  makeSquareWaveCh: function() {
    return {
      dutyCycle: 0.875,
      duration: {
        isEnabled: 0b0,
        value: 0b0
      },
      decay: {
        isEnabled: 0b0,
        rate: 0b0
      },
      sweep: {
        isEnabled: 0b0,
        rate: 0b0,
        isUpper: 0b0,
        quantity: 0b0
      },
      timer: 0b00000000000, // 11bit
      frequency: 0b0
    }
  }
}

function setSquareWaveControl1(ch, bits) {
  ch.dutyCycle = SquareUtil.dutyCycle(bits)
  ch.duration.isEnabled = SquareUtil.isDurationEnabled(bits)
  ch.decay.isEnabled = SquareUtil.isDecayEnabled(bits)
  ch.decay.rate = SquareUtil.decayRate(bits)
}

function setSquareWaveControl2(ch, bits) {
  ch.sweep.isEnabled = SquareUtil.isSweepEnabled(bits)
  ch.sweep.rate = SquareUtil.sweepRate(bits)
  ch.sweep.isUpper = SquareUtil.isSweepUpper(bits)
  ch.sweep.quantity = SquareUtil.sweepQuantity(bits)
}

/* 周波数11bitの下位8bit */
function setSquareWaveTimeruency1(ch, bits) {
  const timer = ch.timer & 0b11100000000
  ch.timer = timer | bits
}

/* 上位5bit: 再生時間
 * 下位3bit: 周波数の11bitの上位3bit
 *  */
function setSquareWaveTimeruency2(ch, bits) {
  const highTimer = (bits & 0b00000111) << 8
  const lowTimer = ch.timer & 0b00011111111
  ch.timer = highTimer | lowTimer
  const clock = Util.CPU_CLOCK.NTSC
  ch.frequency = clock / (16 * (ch.timer + 1))

  ch.duration.value = (bits & 0b11111000) >> 3
}
