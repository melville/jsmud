import { WebSocketServer } from 'ws'
import { handleInput } from './parser.js'
import { Connection } from './connection.js'

class WebSocketConnection extends Connection {
    webSocket = null
    constructor(webSocket) {
        super()
        this.webSocket = webSocket
    }

    get sourceAddress() { console.log(this.webSocket); return this.webSocket._socket.remoteAddress }

    announce(text) {
        this.webSocket.send(text)
    }
}

export class WebSocketListener {
    constructor(port) {
        this.port = port
        this.listener = new WebSocketServer({port})

        this.listener.on('connection', websocket => {
            const connection = new WebSocketConnection(websocket)
            connectionManager.addConnection(connection)
            console.log(`Websocket client (${connection.id}) connected from ${websocket._socket.remoteAddress}`)

            websocket.on('message', message => {
                console.log(`[${connection.id}] ${message}`)
                handleInput(connection, message)
            })

            websocket.on('close', () => {
                connectionManager.removeConnection(connection)
                console.log(`Websocket client (${connection.id}) disconnected`)
            })

            websocket.on('error', error => {
                console.error(`WebSocket error: [${connection.id}]`, error)
            })
        })

        console.log(`Websocket listener started on port ${port}`)
    }
}
