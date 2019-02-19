export default {
  prepareTileIndex: function() {
    this.tileIndex = new Array()

    for(let i=0;i<=0x3bf;i++) {
      let x = (i & (this.tileWidth-1)) * 8
      let y = ((i - (i & (this.tileWidth-1))) / this.tileWidth) * 8
      this.tileIndex[i] = [x, y]
    }
  },

  prepareTileIdOffsetIndex: function() {
    this.tileIdOffsetIndex = [0, 256]
  },

  preparePixelIndex: function() {
    this.pixelIndex = new Array()

    for(let i=0;i<this.width*this.height;i++) {
      const x = i & (this.width - 1)
      const y = (i - (i & (this.width - 1))) / this.width
      this.pixelIndex[i] = [x, y]
    }
  },

  prepareByteOffsetIndex: function() {
    this.byteOffsetIndex = new Array(0x3c0)

    for(let i=0;i< this.byteOffsetIndex.length;i++) {
      this.byteOffsetIndex[i] = this.byteOffset(i)
    }
  },

  prepareBlockOffsetIndex: function() {
    this.blockOffsetIndex = new Array(0x3c0)

    for(let i=0;i< this.blockOffsetIndex.length;i++) {
      this.blockOffsetIndex[i] = this.blockOffset(i)
    }
  },

  preparePaletteIdOfPaletteAddrIndex: function() {
    this.paletteIdOfPaletteAddrIndex = {
      0x3f00: 0,
      0x3f01: 0,
      0x3f02: 0,
      0x3f03: 0,

      0x3f04: 1,
      0x3f05: 1,
      0x3f06: 1,
      0x3f07: 1,

      0x3f08: 2,
      0x3f09: 2,
      0x3f0a: 2,
      0x3f0b: 2,

      0x3f0c: 3,
      0x3f0d: 3,
      0x3f0e: 3,
      0x3f0f: 3,
    }
  }
}
