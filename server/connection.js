import { ulid } from 'ulid'

export class Connection {
    user = null

    constructor() {
        this.id = ulid()
        this.connectedAt = Date.now()
    }

    get sourceAddress() { /* Should be implemented in child class */ throw Error('not implemented') }
    announce(text) { /* Should be implemented in child classes */ throw Error('not implemented') }
}

export class ConnectionManager {
    _connections = new Set()

    addConnection(connection) {
        this._connections.add(connection)
    }

    announce(user, text) {
        for (const conn of this.connections.filter( conn => conn.user === user ))
            conn.announce(text)
    }

    /**
     * Announce to all authenticated connections.
     * @param text
     */
    announceAll(text, except) {
        for (const conn of this.connections.filter( conn => conn.user && !(except?.includes(conn.user) )))
            conn.announce(text)
    }

    get connections() {
        return Array.from(this._connections)
    }

    connectionsFor(user) {
        this.connections.filter( connection => connection.user === user )
    }

    removeConnection(connection) {
        this._connections.delete(connection)
    }
}

export function setupConnections() {
    global.connectionManager = new ConnectionManager()
}
