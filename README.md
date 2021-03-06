# Weaknes

Weaknes is a NES emulator written with JavaScript.

[![CircleCI](https://circleci.com/gh/zecoo89/weaknes.svg?style=svg)](https://circleci.com/gh/zecoo89/weaknes)

<img src="./images/nestest1.png" height="240"> <img src="./images/nestest2.png" height="240">

## Build
```console
$ npm install
$ npm run build
```
## Usage
### index.js
```javascript
async function main() {
  const path = './assets/nestest/nestest.nes'

  const AllInOne = NesPack.AllInOne
  const screenId = 'canvas'
  const isDebug = false
  const allInOne = new AllInOne(screenId, isDebug)
  await allInOne.run(path)
}

main()
```

### index.html
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <link rel="icon" href="data:;base64,iVBORwOKGO=" />
    <title>Screen of NES emulator</title>
  </head>
  <body>
    <canvas id="canvas" width="256" height="240"></canvas>
    <script src="dist/bundle.js"></script>
    <script src="index.js"></script>
  </body>
</html>
```

## Tools
https://github.com/zecoo89/weaknes/wiki
