class Main {
  static startElectron() {
    const path = require('path')
    const { app, BrowserWindow } = require('electron') //eslint-disable-line

    const createWindow = () => {
      let win = new BrowserWindow({
        width: 512,
        height: 720,
        useContentSize: true,
        resizable: false,
        webPreferences: {
          webSecurity: false
        }
      })

      const pathname = path.join(__dirname, 'index.html')
      let url = require('url').format({
        protocol: 'file',
        slashes: true,
        pathname
      })

      win.loadURL(url)
      win.webContents.openDevTools()
      win.on('closed', () => {
        win = null
      })
    }

    app.on('ready', createWindow)
  }

  static async startNes() {
    let path = require('electron').remote.process.argv[2] //eslint-disable-line

    if (!path) throw new Error("ROM's path is not set.")

    const AllInOne = NesPack.AllInOne

    const screenId = 'canvas'
    const isDebug = false

    const allInOne = new AllInOne(screenId, isDebug)

    await allInOne.run(path)

    const palette = [0x31, 0x3d, 0x2d, 0x1f]
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
  }
}

/* process
 *  :true  -> nodejs or electron
 *    process.type
 *      :browser   -> electron main process
 *      :renderer  -> electron renderer process
 *      :undefined -> nodejs
 *  :false -> browser
 * */
function envType() {
  if (typeof process !== 'undefined') {
    if (process.type === 'browser') {
      return 'electron:main'
    } else if (process.type === 'renderer') {
      return 'electron:renderer'
    } else if (!process.type) {
      return 'nodejs'
    } else {
      throw new Error('Unknown enviroment')
    }
  } else {
    return 'browser'
  }
}

const env = envType()

/* start program */
if (env === 'electron:main') {
  Main.startElectron()
} else {
  Main.startNes()
}
