const NesPack = require('../../dist/bundle')
const path = process.argv[2]

if (!path) throw new Error("ROM's path is not set.")

const isDebug = true
const AllInOne = NesPack.AllInOne
const allInOne = new AllInOne(null, isDebug)

allInOne.run(path)
