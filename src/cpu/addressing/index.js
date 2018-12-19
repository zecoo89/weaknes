export default {
  /* 8bitの即値なのでアドレスをそのまま返す */
  immediate: function() {
    const addr = this.registers.pc++
    return addr
  },

  /* アドレスaddr(8bit)を返す */
  zeropage: function() {
    const addr_ = this.registers.pc++
    const addr = this.ram.read(addr_)
    return addr
  },

  /* (アドレスaddr + レジスタindexX)(8bit)を返す */
  zeropageX: function() {
    const addr_ = this.registers.pc++
    const addr = this.ram.read(addr_) + this.registers.indexX
    return addr & 0xff
  },

  /* 上と同じでindexYに替えるだけ*/
  zeropageY: function() {
    const addr_ = this.registers.pc++
    const addr = this.ram.read(addr_) + this.registers.indexY
    return addr & 0xff
  },

  /* zeropageのaddrが16bit版 */
  absolute: function() {
    const lowAddr_ = this.registers.pc++
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc++
    const highAddr = this.ram.read(highAddr_)

    const addr = lowAddr | (highAddr << 8)

    return addr & 0xffff
  },

  absoluteX: function() {
    const lowAddr_ = this.registers.pc++
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc++
    const highAddr = this.ram.read(highAddr_)

    const addr = (lowAddr | (highAddr << 8)) + this.registers.indexX

    return addr & 0xffff
  },

  absoluteY: function() {
    const lowAddr_ = this.registers.pc++
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc++
    const highAddr = this.ram.read(highAddr_)

    const addr = (lowAddr | (highAddr << 8)) + this.registers.indexY

    return addr & 0xffff
  },

  indirect: function() {
    const lowAddr_ = this.registers.pc++
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc++
    const highAddr = this.ram.read(highAddr_)

    const addr_ = lowAddr | (highAddr << 8)
    const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8)

    return addr & 0xffff
  },

  indexIndirect: function() {
    const addr__ = this.registers.pc++
    let addr_ = this.ram.read(addr__) + this.registers.indexX
    addr_ = addr_ & 0x00ff

    const addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8)

    return addr & 0xffff
  },

  indirectIndex: function() {
    const addr__ = this.registers.pc++
    const addr_ = this.ram.read(addr__)

    let addr = this.ram.read(addr_) | (this.ram.read(addr_ + 1) << 8)
    addr = addr + this.registers.indexY

    return addr & 0xffff
  },

  /* (プログラムカウンタ + オフセット)を返す。
   * オフセットの計算では符号付きの値が使用される。
   * 符号付きの値は
   *   -128(0x80) ~ -1 (0xff)
   *   0(0x00) ~ 127(0x7f)
   * */
  relative: function() {
    const addr_ = this.registers.pc++
    const signedNumber = this.ram.read(addr_)

    let addr =
      signedNumber >= 0x80
        ? this.registers.pc + signedNumber - 0x100
        : this.registers.pc + signedNumber

    return addr
  }
}
