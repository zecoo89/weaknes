export default {
  isVblankStart: function () {
    return this.position === this.width * 240
  },
  isVblankEnd: function () {
    return this.position === this.width * 262
  },

  prepareTileIndex: function() {
    this.tileIndex = new Array()

    for(let i=0;i<=0x3bf;i++) {
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8
      this.tileIndex[i] = [x, y]
    }
  },

  preparePixelIndex: function() {
    this.pixelIndex = new Array()

    for(let i=0;i<this.width*this.height;i++) {
      const x = i & (this.width - 1)
      const y = (i - (i & (this.width - 1))) / this.width
      this.pixelIndex[i] = [x, y]
    }
  }
}
