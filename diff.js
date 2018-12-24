const extractMyLogElements = (myLogLine) => {
  const elementsArray = myLogLine.split(' ')
  return {
    addr: elementsArray[0].toUpperCase(),
    instruction: elementsArray[1],
    A: elementsArray[4].toUpperCase().split(':')[1],
    X: elementsArray[5].toUpperCase().split(':')[1],
    Y: elementsArray[6].toUpperCase().split(':')[1],
    P: elementsArray[7].toUpperCase().split(':')[1],
    SP: elementsArray[8].toUpperCase().split(':')[1]
  }
}

const extractNestestElements = (nestestLine) => {
  const elementsArray = nestestLine.split(' ')
  return {
    addr: elementsArray[0],
    instruction: elementsArray[6],
    A: nestestLine.match(/A:([0-9A-F]+) X:/)[1],
    X: nestestLine.match(/X:([0-9A-F]+) Y:/)[1],
    Y: nestestLine.match(/Y:([0-9A-F]+) P:/)[1],
    P: nestestLine.match(/P:([0-9A-F]+) SP/)[1],
    SP: nestestLine.match(/SP:([0-9A-F]+) CYC:/)[1],
  }
}

const diff = (i, myLogLines, nestestLines) => {
  const myLogElements = extractMyLogElements(myLogLines[i])
  const nestestElements = extractNestestElements(nestestLines[i])
  if(parseInt(myLogElements.addr, 16) !== parseInt(nestestElements.addr, 16)) return {isError: true, info: 'addr'}
  if(parseInt(myLogElements.A, 16) !== parseInt(nestestElements.A, 16)) return {isError: true, info: 'A'}
  if(parseInt(myLogElements.X, 16) !== parseInt(nestestElements.X, 16)) return {isError: true, info: 'X'}
  if(parseInt(myLogElements.Y, 16) !== parseInt(nestestElements.Y, 16)) return {isError: true, info: 'Y'}
  if(parseInt(myLogElements.P, 16) !== parseInt(nestestElements.P, 16)) return {isError: true, info: 'P'}
  if(parseInt(myLogElements.SP, 16) !== parseInt(nestestElements.SP, 16)) return {isError: true, info: 'SP'}

  return {isError: false}
}

const error = (i, myLogLines, nestestLines, info) => {
  const myLogOutput = '--- my log ---\n' + myLogLines[i-1] + '\n' + myLogLines[i] + '\n' + myLogLines[i+1] + '\n\n'
  const nestestOutput = '--- nestest.log ---\n' + nestestLines[i-1].split(' ').filter(e => e !== '').join(' ') + '\n' + nestestLines[i].split(' ').filter(e => e !== '').join(' ') + '\n' + nestestLines[i+1].split(' ').filter(e => e !== '').join(' ')
  /* eslint-disable-next-line no-console */
  console.log(info + ' was not matched.\n' + myLogOutput + nestestOutput + '\n\n\n')
}

const fs = require('fs')

const nestest = fs.readFileSync('./nestest.log', 'utf8')
const myLog = fs.readFileSync('./log.txt', 'utf8')

const nestestLines = nestest.split('\n')
const myLogLines = myLog.split('\n')

for(let i=0;i<myLogLines.length-1;i++) {
  const result = diff(i, myLogLines, nestestLines)

  if(result.isError) {
    error(i, myLogLines, nestestLines, result.info)
  }
}


