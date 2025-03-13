import { WebSocketServer } from 'ws'
import { handleInput } from './parser.js'
import { ulid } from 'ulid'

class Connection {
    constructor(websocket) {
        this.id = ulid()
        this.connectedAt = Date.now()
        this.websocket = websocket
    }

    announce(text) {
        this.websocket.send(text)
    }
}

export class Server {
    connections = new Set()

    constructor(port) {
        this.port = port
        this.listener = new WebSocketServer({port})

        this.listener.on('connection', websocket => {
            const connection = new Connection(websocket)
            this.connections.add(connection)
            console.log('Websocket client connected from ', websocket._socket.remoteAddress)
            this.announceAll(`*** ${connection.id} connected from ${websocket._socket.remoteAddress}`)

            websocket.on('message', message => {
                console.log(`[${connection.id}] ${message}`)
                handleInput(connection, message)
            })

            websocket.on('close', () => {
                this.connections.delete(connection)
                console.log(`Websocket client disconnected: ${connection.id}`)
                this.announceAll(`*** ${connection.id} disconnected`)
            })

            websocket.on('error', error => {
                console.error(`WebSocket error: [${connection.id}]`, error)
            })
        })

        console.log(`Websocket listener started on port ${port}`)
    }

    announceAll(text) {
        this.connections.forEach( connection => connection.announce(text) )
    }

    connectionFor(user) {
        for (const connection of this.connections) {
            if (connection.connectedUser === user) return connection
        }
        return null
    }
}
