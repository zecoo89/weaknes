const NesPack = window.NesPack
const path = urlParams().path

if (!path) throw new Error("ROM's path is not set.")

const AllInOne = NesPack.AllInOne
const screenId = 'canvas'
const isDebug = false

const allInOne = new AllInOne(screenId, isDebug)
allInOne.run(path)

/* CHR-ROMを可視化する */ const palette = [0x31, 0x3d, 0x2d, 0x1f]
const Tools = NesPack.Tools
const tool = new Tools(allInOne.nes)

tool.dumpChrRom('chr-dump', palette)
const interval = 300
setInterval(tool.dumpPalette.bind(tool, 'palette-dump'), interval)
const isShadowEnabled = true
setInterval(
  tool.dumpBackground.bind(tool, 'background', isShadowEnabled),
  interval
)

function urlParams() {
  const href = window.location.href

  if (href.indexOf('?') === -1)
    throw new Error("ROM's path is not set in URL params.")

  const splittedHref = href.split('?')

  if (!splittedHref[1]) throw new Error("ROM's path is not set in URL params.")

  const params = {}
  href
    .split('?')[1]
    .split('&')
    .forEach(str => {
      const param = str.split('=')
      const key = param[0]
      const value = param[1]

      params[key] = value
    })

  return params
}
