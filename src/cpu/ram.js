export default class Ram {
  constructor() {
    this.memory = new Uint8Array(0x10000)
    this.whichButton = 0
  }

  /* Memory mapped I/Oであるため，バス(Bus)を接続しておく
   * PPU等へはBusを通してデータのやり取りを行う
   * */
  connect(parts) {
    parts.bus && (this.bus = parts.bus)
    parts.controller && (this.controller = parts.controller)
  }

  write(addr, value) {
    if (addr >= 0x2000 && addr <= 0x2007 && addr !== 0x2002) {
      this.bus.write(addr, value)
      return
    }

    // 通常のメモリアクセス
    this.memory[addr] = value
  }

  read(addr) {
    // PPU
    if (addr >= 0x2000 && addr <= 0x2007) {
      return this.bus.read(addr)
    }

    // コントローラ
    if (this.controller && addr === 0x4016) {
      const value = this.controller.button[this.whichButton++]

      if (this.whichButton > 7 || value === 1) {
        this.whichButton = 0
      }

      return value
    }

    return this.memory[addr]
  }
}
