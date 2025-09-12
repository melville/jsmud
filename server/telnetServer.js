import telnet from 'telnet'
import { Connection } from './connection.js'
import { handleInput } from './parser.js'

class TelnetConnection extends Connection {
    client = null

    constructor(client) {
        super()
        this.client = this.#configureClient(client)
    }

    get sourceAddress() { return this.client.remoteAddress }

    send(data) {
        switch (data.type) {
            case 'announce':
                this.client.write(`${data.text}\n`)
        }
    }

    receive(data) {
        handleInput(this, data)
    }

    #configureClient(client) {
        // Uncomment for detailed telnet debug logs
        // client.on('debug', function(msg) {
        //     console.error(msg)
        // })

        const connection = this
        client.on('data', function (message) {
            connection.receive(message)
        })
        client.on('close', function() {
            connectionManager.removeConnection(connection)
            console.log(`Telnet client disconnected: ${connection.id}`)
        })
        return client
    }
}

export class TelnetListener {
    constructor(port) {
        this.port = port
        this.listener = telnet.createServer(function(client) {
            connectionManager.addConnection(new TelnetConnection(client))
        }).listen(port)

        console.log(`Telnet listener started on port ${port}`)
    }
}
