export default class Vram {
  constructor() {
    this.memory = new Uint8Array(0x4000);
    this.vp = null;
  }

  connect(ppu) {
    this.refreshDisplay = ppu.refreshDisplay.bind(ppu);
  }

  writeFromBus(value) {
    //console.log('vram[$' + this.vp.toString(16) + '] = ' + String.fromCharCode(value))
    this.memory[this.vp] = value;
    this.vp++;
    this.refreshDisplay && this.refreshDisplay();
  }

  write(addr, value) {
    this.memory[addr] = value;
  }

  read(addr) {
    return this.memory[addr];
  }
}
