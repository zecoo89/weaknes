const path = require('path')
const express = require('express') //eslint-disable-line
const app = express()
const port = process.argv[2]

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname+'/sample.html'))
})

app.use(express.static(__dirname))

app.listen(port, (err) => {
  if(err) {
    console.log('something wrong', err) //eslint-disable-line
  }

  console.log(`server is listen on ${port}`) //eslint-disable-line
})

const opn = require('opn') //eslint-disable-line
const fs = require('fs')
const romPath = process.argv[3]

if(!romPath) {
  throw new Error('ROM\'s path is not set.')
}

if(!fs.existsSync(romPath)) {
  throw new Error(`${romPath} doesn't exist.`)
}

opn('http://localhost:' + port + '?path=' + romPath)
