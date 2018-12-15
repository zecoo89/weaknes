export default class Ram {
  constructor() {
    this.memory = new Uint8Array(0x10000);
  }

  /* Memory mapped I/Oであるため，バス(Bus)を接続しておく
   * PPU等へはBusを通してデータのやり取りを行う
   * */
  connect(parts) {
    parts.bus && (this.bus = parts.bus);
  }

  /*TODO 各ポート(addr)にアクセスがあった場合にはバスに書き込む */
  write(addr, value) {
    if (addr >= 0x2000 && addr <= 0x2007) {
      this.bus.write(addr, value);
      return;
    }

    // 通常のメモリアクセス
    this.memory[addr] = value;
  }

  /*TODO コントローラ用のポート */
  read(addr) {
    return this.memory[addr];
  }
}
