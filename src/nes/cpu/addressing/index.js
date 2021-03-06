/* アドレッシングにはaccumulatorもあるが、
 * accumulatorは直接命令内で参照するので、
 * 実装の都合上、関数は必要ない。*/
export default {
  implied: function() {
    return null
  },
  /* 8bitの即値なのでアドレスをそのまま返す */
  immediate: function() {
    const addr = this.registers.pc.read()
    this.registers.pc.increment()
    return addr
  },

  /* アドレスaddr(8bit)を返す */
  zeropage: function() {
    const addr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const addr = this.ram.read(addr_)
    return addr
  },

  /* (アドレスaddr + レジスタindexX)(8bit)を返す */
  zeropageX: function() {
    const addr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const addr = this.ram.read(addr_) + this.registers.indexX.read()
    return addr & 0xff
  },

  /* 上と同じでindexYに替えるだけ*/
  zeropageY: function() {
    const addr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const addr = this.ram.read(addr_) + this.registers.indexY.read()
    return addr & 0xff
  },

  /* zeropageのaddrが16bit版 */
  absolute: function() {
    const lowAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const highAddr = this.ram.read(highAddr_)

    const addr = lowAddr | (highAddr << 8)

    return addr & 0xffff
  },

  absoluteX: function() {
    const lowAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const highAddr = this.ram.read(highAddr_)

    const addr = (lowAddr | (highAddr << 8)) + this.registers.indexX.read()

    return addr & 0xffff
  },

  absoluteY: function() {
    const lowAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const highAddr = this.ram.read(highAddr_)

    const addr = (lowAddr | (highAddr << 8)) + this.registers.indexY.read()

    return addr & 0xffff
  },

  indirect: function() {
    const lowAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const lowAddr = this.ram.read(lowAddr_)

    const highAddr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const highAddr = this.ram.read(highAddr_)

    const lowAddr__ = lowAddr | (highAddr << 8)
    const highAddr__ = ((lowAddr + 1) & 0xff) | (highAddr << 8)
    const addr = this.ram.read(lowAddr__) | (this.ram.read(highAddr__) << 8)

    return addr & 0xffff
  },

  indexIndirect: function() {
    const addr__ = this.registers.pc.read()
    this.registers.pc.increment()
    const addr_ = (this.ram.read(addr__) + this.registers.indexX.read()) & 0xff

    const lowAddr = this.ram.read(addr_)
    const highAddr = this.ram.read((addr_ + 1) & 0xff) << 8

    const addr = lowAddr | highAddr

    return addr & 0xffff
  },

  indirectIndex: function() {
    const addr__ = this.registers.pc.read()
    this.registers.pc.increment()
    const addr_ = this.ram.read(addr__)

    const lowAddr = this.ram.read(addr_)
    const highAddr = this.ram.read((addr_ + 1) & 0xff) << 8

    let addr = lowAddr | highAddr

    addr = (addr + this.registers.indexY.read()) & 0xffff

    return addr & 0xffff
  },

  /* (プログラムカウンタ + オフセット)を返す。
   * オフセットの計算では符号付きの値が使用される。
   * 符号付きの値は
   *   -128(0x80) ~ -1 (0xff)
   *   0(0x00) ~ 127(0x7f)
   * */
  relative: function() {
    const addr_ = this.registers.pc.read()
    this.registers.pc.increment()
    const signedNumber = this.ram.read(addr_)

    let addr =
      signedNumber >= 0x80
        ? this.registers.pc.read() + signedNumber - 0x100
        : this.registers.pc.read() + signedNumber

    return addr
  }
}
