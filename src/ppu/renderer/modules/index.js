export default {
  preparePixelIndex: function() {
    this.pixelIndex = new Array()

    for(let i=0;i<this.width*this.height;i++) {
      const x = i & (this.width - 1)
      const y = (i - (i & (this.width - 1))) / this.width
      this.pixelIndex[i] = [x, y]
    }
  },

  setScreenIndex: function(isVerticalMirror) {
    if(isVerticalMirror) {
      this.screenIndex = [0, 1, 0, 1]
    } else {
      this.screenIndex = [0, 0, 1, 1]
    }
  }
}
