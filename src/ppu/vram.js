export default class Vram {
  constructor() {
    this.memory = new Uint8Array(0x4000)
  }

  connect(parts) {
    parts.renderer && (this.renderer = parts.renderer)
  }

  write(addr, value) {
    this.memory[addr] = value
    if(addr >= 0x2000 && addr <= 0x2fff) {
      this.bypass(addr, value)
    } else if(addr >= 0x3f00 && addr <= 0x3f0f) {
      this.bypass2(addr)
    }
  }

  read(addr) {
    const filteredAddr = this.filterForRead(addr)
    return this.memory[filteredAddr]
  }

  readFastly(addr) {
    return this.memory[addr]
  }

  filterForRead(addr) {
    switch(addr) {
      case 0x3f04:
      case 0x3f08:
      case 0x3f0c:
        return 0x3f00
      default:
        return addr
    }
  }

  bypass(addr, value) {
    const offset = (addr % 0x400)
    const startAddr = addr - offset
    const offsetX = this.renderer.layerOffsetOfNametable[startAddr].x
    const offsetY = this.renderer.layerOffsetOfNametable[startAddr].y

    if(addr >= 0x2000 && addr <= 0x23bf) {
      this.renderer.loadTile(offset, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x2400 && addr <= 0x27bf) {
      this.renderer.loadTile(offset, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x2800 && addr <= 0x2bbf) {
      //this.renderer.loadTile(offset, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x2c00 && addr <= 0x2fbf) {
      //this.renderer.loadTile(offset, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x23c0 && addr <= 0x23ff) {
      this.renderer.loadTileWithAttr(addr, startAddr, offsetX, offsetY)
    } else if(addr >= 0x27c0 && addr <= 0x27ff) {
      this.renderer.loadTileWithAttr(addr, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x2bc0 && addr <= 0x2bff) {
      //this.renderer.loadTileWithAttr(addr, value, startAddr, offsetX, offsetY)
    } else if(addr >= 0x2fc0 && addr <= 0x2fff) {
      //this.renderer.loadTileWithAttr(addr, value, startAddr, offsetX, offsetY)
    }
  }

  bypass2(addr) {
    if(addr >= 0x3f00 && addr <= 0x3f0f) {
      this.renderer.loadTileWithColor(addr)
    }
  }
}
