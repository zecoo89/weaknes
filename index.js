const isNode = typeof process !== "undefined" && typeof require !== "undefined"

async function main() {
  //const path = './assets/nestest/nestest.nes'
  //const path = './assets/giko/giko005/giko005.nes'
  //const path = './assets/giko/giko008/giko008.nes'
  //const path = './assets/giko/giko009/giko009.nes'
  //const path = './assets/giko/giko010/giko010.nes'
  //const path = './assets/giko/giko011/giko011.nes'
  const path = './assets/helloworld/helloworld.nes'
  let nes
  /* node.jsかブラウザか判定し、環境に合わせてライブラリやROMの読み込み方法を替える */
  if(isNode) {
    require('source-map-support').install()

    const NesPack = require('./dist/bundle')
    const fs = require('fs')

    const data = fs.readFileSync(path)

    const Nes = NesPack.Nes
    const Rom = NesPack.Rom

    const isDebug = true
    nes = new Nes(isDebug)
    const rom = new Rom(data)
    nes.rom = rom

  } else {
    const Nes = NesPack.Nes
    const Renderer = NesPack.Renderer
    const Rom = NesPack.Rom

    const isDebug = false
    nes = new Nes(isDebug)
    const renderer = new Renderer('canvas')
    nes.connect(renderer)
    renderer.connect(nes)
    renderer.run()

    const data = await fetch(path)
    .then(response => response.arrayBuffer())
    .then(buffer => new Uint8Array(buffer))

    const rom = new Rom(data)
    nes.rom = rom

    /* CHR-ROMを可視化する */
    const Tool = NesPack.Tool

    const palette = [0x31, 0x3d, 0x2d, 0x1f]
    Tool.dumpChrRom(rom, 'chr-dump', palette)
  }

  nes.run()
}

main()
