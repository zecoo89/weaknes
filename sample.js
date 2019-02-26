class Main {
  static startElectron() {
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

      let url = require('url').format({
        protocol: 'file',
        slashes: true,
        pathname: require('path').join(__dirname, 'sample.html')
      })

      win.loadURL(url)
      win.webContents.openDevTools()
      win.on('closed', () => {
        win = null
      })
    }

    app.on('ready', createWindow)
  }

  static async startNes(env) {
    let NesPack
    let path
    if (env === 'electron:renderer') {
      NesPack =require('./dist/bundle')
      path = require('electron').remote.process.argv[2] //eslint-disable-line
    } else if (env === 'nodejs') {
      NesPack = require('./dist/bundle')
      path = process.argv[2]
    } else if (env === 'browser') {
      NesPack = window.NesPack
      path = urlParams().path
    }

    if(!path) throw new Error('ROM\'s path is not set.')

    const AllInOne = NesPack.AllInOne

    let screenId = null
    let isDebug = true

    if(env !== 'nodejs') {
      screenId = 'canvas'
      isDebug = false
    }

    const allInOne = new AllInOne(screenId, isDebug)

    let pcAddr = null
    if(env === 'nodejs')  pcAddr = 0xc000

    await allInOne.run(path, pcAddr)

    if(env === 'nodejs') return
    /* CHR-ROMを可視化する *////*
    const palette = [0x31, 0x3d, 0x2d, 0x1f]
    const Tool = NesPack.Tool
    const tool = new Tool(allInOne.nes)

    tool.dumpChrRom('chr-dump', palette)
    const interval = 300
    setInterval(tool.dumpPalette.bind(tool, 'palette-dump'), interval)
    const isShadowEnabled = true
    setInterval(tool.dumpBackground.bind(tool, 'background', isShadowEnabled), interval)
    /**/
  }
}

const _env = _envType()

/* start program */
if(_env === 'electron:main') {
  Main.startElectron()
} else {
  Main.startNes(_env)
}



/* process
 *  :true  -> nodejs or electron
 *    process.type
 *      :browser   -> electron main process
 *      :renderer  -> electron renderer process
 *      :undefined -> nodejs
 *  :false -> browser
 * */
function _envType() {
  if(typeof process !== 'undefined') {
    if(process.type === 'browser') {
      return 'electron:main'
    } else if(process.type === 'renderer') {
      return 'electron:renderer'
    } else if(!process.type) {
      return 'nodejs'
    } else {
      throw new Error('Unknown enviroment')
    }
  } else {
    return 'browser'
  }
}

function urlParams() {
  const href = window.location.href

  if(href.indexOf('?') === -1)
    throw new Error('ROM\'s path is not set in URL params.')

  const splittedHref = href.split('?')

  if(!splittedHref[1])
    throw new Error('ROM\'s path is not set in URL params.')

  const params = {}
  href.split('?')[1].split('&').forEach(str => {
    const param = str.split('=')
    const key = param[0]
    const value = param[1]

    params[key] = value
  })

  return params
}
