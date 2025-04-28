import { WebSocketListener } from './websocketServer.js'
import { createPrimitives } from './primitives.js'
import { setupConnections } from './connection.js'
import { TelnetListener } from './telnetServer.js'

createPrimitives()
loadDatabase()
setupConnections()

global.webSocketListener = new WebSocketListener(6969)
global.telnetListener = new TelnetListener(6970)

// Prevent server death for unhandled sync or async errors
process.on('uncaughtException', (err) => console.error('Unhandled exception:', err))
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection at:', promise, 'reason:', reason))

// Convenience hacks
Set.prototype.toString = function () { return `Set ${Array.from(this)}`}
