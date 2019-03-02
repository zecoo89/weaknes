const CPU_CLOCK = {
  NTSC: 1.789773 * 1000000,
  PAL: 1.662607 * 1000000
}

export default {
  /* 短形波ch1の設定を生成する */
  extractSettingsOfSquareWaveCh1: function() {
    const timerLow = this.registers[0x4002].timerLow()
    const timerHigh = this.registers[0x4003].timerHigh()
    const timer = timerLow | (timerHigh << 8)
    const frequency = CPU_CLOCK.NTSC / (16 * (timer + 1))

    return {
      type: 'square',
      dutyCycle: this.registers[0x4000].dutyCycle(),
      duration: {
        isDisabled: this.registers[0x4000].isDurationDisabled(),
        value: this.registers[0x4003].duration()
      },
      decay: {
        isDisabled: this.registers[0x4000].isDecayDisabled(),
        rate: this.registers[0x4000].decayRate()
      },
      sweep: {
        isEnabled: this.registers[0x4001].isSweepEnabled(),
        rate: this.registers[0x4001].sweepRate(),
        isUpper: this.registers[0x4001].isSweepUpper(),
        quantity: this.registers[0x4001].sweepQuantity()
      },
      timer,
      frequency
    }
  },

  /* 短形波ch2の設定を生成する */
  extractSettingsOfSquareWaveCh2: function() {
    const timerLow = this.registers[0x4006].timerLow()
    const timerHigh = this.registers[0x4007].timerHigh()
    const timer = timerLow | (timerHigh << 8)
    const frequency = CPU_CLOCK.NTSC / (16 * (timer + 1))

    return {
      type: 'square',
      dutyCycle: this.registers[0x4004].dutyCycle(),
      duration: {
        isDisabled: this.registers[0x4004].isDurationDisabled(),
        value: this.registers[0x4007].duration()
      },
      decay: {
        isDisabled: this.registers[0x4004].isDecayDisabled(),
        rate: this.registers[0x4004].decayRate()
      },
      sweep: {
        isEnabled: this.registers[0x4005].isSweepEnabled(),
        rate: this.registers[0x4005].sweepRate(),
        isUpper: this.registers[0x4005].isSweepUpper(),
        quantity: this.registers[0x4005].sweepQuantity()
      },
      timer,
      frequency
    }
  },

  //TODO 三角波の設定を生成する
  extractSettingsOfTriangleWave: function() {
    return {
      type: 'triangle'
    }
  },

  //TODO ノイズの設定を生成する
  extractSettingsOfNoise: function() {
    return {
      type: 'noise'
    }
  }
}
