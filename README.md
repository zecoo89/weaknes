# Weaknes

Weaknes is a NES emulator written by JavaScript and no practical now.

## Usage

### Build
```
npm install
npm run build
```
### Sample index.js
```
async function main() {
  const path = './assets/nestest/nestest.nes'
  const Nes = NesPack.Nes
  const Renderer = NesPack.Renderer
  const Rom = NesPack.Rom

  nes = new Nes()

  /* A Renderer's argument is Canvas tag's id*/
  const renderer = new Renderer('canvas')
  nes.connect(renderer)

  const data = await fetch(path)
  .then(response => response.arrayBuffer())
  .then(buffer => new Uint8Array(buffer))

  const rom = new Rom(data)
  nes.rom = rom

  nes.run()
}

main()
```
### Sample index.html
```
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Renderer of NES emulator</title>
  </head>
  <body>
    <canvas id="canvas" width="256" height="240"></canvas>
    <script src="dist/bundle.js"></script>
    <script src="index.js"></script>
  </body>
</html>
```

### Run server
```
npm run serve
```

After run server, open http://localhost:1234
