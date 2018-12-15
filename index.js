const isNode = typeof process !== "undefined" && typeof require !== "undefined"

async function main() {
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

    nes = new Nes()
    const rom = new Rom(data)
    nes.rom = rom
  } else {
    const Nes = NesPack.Nes
    const Renderer = NesPack.Renderer
    const Rom = NesPack.Rom

    nes = new Nes()
    const renderer = new Renderer('canvas')
    nes.connect(renderer)

    const data = await fetch(path)
    .then(response => response.arrayBuffer())
    .then(buffer => new Uint8Array(buffer))

    const rom = new Rom(data)
    nes.rom = rom

  }

  const isDebug = true
  nes.run(isDebug)
}

main()
