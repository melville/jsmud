
export function handleInput(connection, message) {
    const text = message.toString()
    if (text.startsWith(';')) {
        try {
            connection.announce(`${ eval?.(text.substring(1)) }`)
        } catch (error) {
            connection.announce(error.stack)
        }
    } else {
        global.server.announceAll(`[${connection.id}] ${message}`)
    }
}
