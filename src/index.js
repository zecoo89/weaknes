if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  require('source-map-support').install()
}

import Nes_ from './nes'
import Controller_ from './controller'
import Rom_ from './rom'
import Screen_ from './screen'
import Audio_ from './audio'
import Tools_ from './tools'
import AllInOne_ from './allInOne'

export const Nes = Nes_
export const Controller = Controller_
export const Rom = Rom_
export const Screen = Screen_
export const Audio = Audio_
export const Tools = Tools_
export const AllInOne = AllInOne_
