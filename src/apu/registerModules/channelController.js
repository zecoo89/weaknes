/* 音声チャネル制御レジスタ */
export default {
  0x4015: function(bits) {
    const isSquare1 = bits & 0x01
    const isSquare2 = (bits >> 1) & 0x01

    if (this.audio) {
      //TODO audioのオンオフ
    }
  }
}
