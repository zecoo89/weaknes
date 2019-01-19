export default class Audio {
  constructor() {
    this.context = new AudioContext()
    this.wakeUpAudio()
  }

  wakeUpAudio() {
    const eventName =
      typeof document.ontouchend !== 'undefined' ? 'touchend' : 'mouseup'
    document.addEventListener(eventName, initAudioContext.bind(this))

    function initAudioContext() {
      document.removeEventListener(eventName, initAudioContext)
      this.context.resume()
    }
  }

  sound(settings) {
    const type = settings.type
    const oscillator = this.context.createOscillator()
    oscillator.connect(this.context.destination)
    switch (type) {
      case 'square':
        this.soundSquareWave(oscillator, settings)
        break
      case 'triangle':
        this.soundTriangleWave(oscillator, settings)
        break
      case 'noise':
        this.soundNoise(oscillator, settings)
        break
      default:
        break
    }
  }

  soundSquareWave(oscillator, settings) {
    oscillator.type = 'square'
    oscillator.frequency.value = settings.frequency

    //oscillator.frequency.linearRampToValueAtTime(freq1, currTime);
    //oscillator.frequency.linearRampToValueAtTime(freq2, currTime + duration*1);

    const startTime = this.context.currentTime
    const endTime = startTime + settings.duration.value / 100
    oscillator.start(startTime)
    oscillator.stop(endTime)
  }

  soundTriangleWave(oscillator, settings) {
    oscillator.type = 'triangle'
    oscillator.frequency.value = settings.frequency

    const startTime = this.context.currentTime
    const endTime = startTime + settings.duration.value / 100
    oscillator.start(startTime)
    oscillator.stop(endTime)
  }

  soundNoise() {}
}
