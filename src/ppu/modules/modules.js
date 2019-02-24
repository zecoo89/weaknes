export default {
  isHblankStart: function() {
    const x = this.cycles % this.cyclesPerLine
    return x === 256
  },

  isHblankEnd: function() {
    const x = this.cycles % this.cyclesPerLine
    return x === 340
  },

  isVblankStart: function () {
    return this.cycles === this.cyclesPerLine * this.renderer.height
  },

  isVblankEnd: function () {
    return this.cycles === 0
  },

  isZeroSpriteOverlapped: function() {
    const isSpriteEnabled = this.registers[0x2001].isSpriteEnabled()
    if(!isSpriteEnabled) {
      return false
    }
    const isBackgroundEnabled = this.registers[0x2001].isBackgroundEnabled()
    if(!isBackgroundEnabled) {
      return false
    }

    const zsPosition = this.oam.zeroSpritePosition()
    const position = this.renderer.position
    const width = this.renderer.width
    const x = position & (width-1)
    const y = (position - (position & (width-1))) / width

    //const isXOverlapped = x >= zsPosition.x && x < zsPosition.x + 8
    //const isYOverlapped = y-7 >= zsPosition.y && y-7 < zsPosition.y + 8
    const isXOverlapped = x === zsPosition.x
    const isYOverlapped = y === zsPosition.y

    return isXOverlapped && isYOverlapped
  }

}
