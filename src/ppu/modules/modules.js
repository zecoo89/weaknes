export default {
  vPosition: function() {
    const x = this.cycles % this.cyclesPerLine
    const y = (this.cycles - x) / this.cyclesPerLine
    return y
  },

  hPosition: function() {
    const x = this.cycles % this.cyclesPerLine
    return x
  },

  isVblankStart: function() {
    return this.cycles === this.cyclesPerLine * this.renderer.height
  },

  isVblankEnd: function() {
    return this.cycles === 0
  },

  isZeroSpriteHit: function(x, y) {
    if (this.isAlreadyZeroSpriteHit) return false

    const zsPosition = this.oam.zeroSpritePosition()

    const isXHit = x === zsPosition.x
    const isYHit = y === zsPosition.y

    const isHit = isXHit && isYHit

    if (isHit) this.isAlreadyZeroSpriteHit = true

    return isHit
  },

  copyHorizontalPosition: function() {
    const tBits = this.registers.t.readBits(0, 4)
    this.registers.v.writeBits(0, 4, tBits)
    const tBit = this.registers.t.readOneBit(10)
    this.registers.v.writeOneBit(10, tBit)
  },

  copyVerticalPosition: function() {
    let tBits = this.registers.t.readBits(5, 9)
    this.registers.v.writeBits(5, 9, tBits)
    tBits = this.registers.t.readBits(11, 14)
    this.registers.v.writeBits(11, 14, tBits)
  },

  incrementX: function() {
    const x = this.registers.x.read()
    if (x === 7) {
      this.registers.x.write(0)
      const coarseX = this.registers.v.readCoarseX()
      if (coarseX === 31) {
        this.registers.v.writeCoarseX(0)
        const nametable = this.registers.v.readNametable()
        this.registers.v.writeNametable(nametable ^ 0b01)
      } else {
        this.registers.v.writeCoarseX(coarseX + 1)
      }
    } else {
      this.registers.x.write(x + 1)
    }
  },

  incrementY: function() {
    const fineY = this.registers.v.readFineY()
    if (fineY === 7) {
      this.registers.v.writeFineY(0)
      const coarseY = this.registers.v.readCoarseY()
      if (coarseY === 29) {
        this.registers.v.writeCoarseY(0)
        const nametable = this.registers.v.readNametable()
        this.registers.v.writeNametable(nametable ^ 0b10)
      } else if (coarseY === 31) {
        this.registers.v.writeCoarseY(0)
      } else {
        this.registers.v.writeCoarseY(coarseY + 1)
      }
    } else {
      this.registers.v.writeFineY(fineY + 1)
    }
  }
}
