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
        this.send({ type: 'announce', text })
    }

    send(data) {
        this.webSocket.send(JSON.stringify(data))
    }

    receive(data) {
        switch (data.type) {
            case 'input': // user input
                handleInput(this, data.text)
                break
            case 'save':
                handleSave(this, data)
                break
            default:
                console.error(`[${this.id}] Unknown data type`, data)
        }
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
                try {
                    const data = JSON.parse(message)
                    connection.receive(data)
                } catch (e) {
                    console.error(`[${connection.id}] error processing ${message}`, e)
                }
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

function handleSave(connection, data) {
    const obj = db[data.obj]
    if (!obj) {
        connection.announce(`Invalid save destination: ${data.obj}`)
        return
    }
    if (data.propType === 'function') {
        try {
            obj[data.prop] = new Function(`return ${data.value}`)()
            connection.announce(`Saved function: ${data.obj}.${data.prop}`)
        } catch (e) {
            connection.announce(`Failed to save function: ${e}`)
        }
    } else {
        connection.announce(`Unsupported property type: ${data.propType}`)
    }
}
