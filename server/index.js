import { Server } from './websocketServer.js'
import { createPrimitives } from './primitives.js'

createPrimitives()
loadDatabase()

global.server = new Server(6969)
