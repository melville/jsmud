import { Server } from './websocketServer.js'
import { createPrimitives } from './primitives.js'

createPrimitives()
loadDatabase()

global.server = new Server(6969)

// Prevent server death for unhandled sync or async errors
process.on('uncaughtException', (err) => console.error('Unhandled exception:', err))
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason))
