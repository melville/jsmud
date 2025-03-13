
export function handleInput(connection, message) {
    let text = message.toString().trimStart()
    let command
    let argStr
    if (text.startsWith(';')) {
        command = 'eval'
        argStr = text.substring(1).trimStart()
    } else if (text.startsWith('"')) {
        command = 'say'
        argStr = text.substring(1).trimStart()
    } else {
        const spaceIndex = text.search(/\s/)
        if (spaceIndex > -1) {
            command = text.substring(0, spaceIndex)
            argStr = text.substring(spaceIndex + 1)
        } else {
            command = text
            argStr = ''
        }
    }

    if (!command) return

    if (connection.connectedUser) {
        const user = connection.connectedUser
        const commandFunc = `command_${command}`
        if (typeof user[commandFunc] === 'function') {
            user[`command_${command}`](argStr)
        } else {
            connection.announce(`No such command ('${command}')`)
        }
    } else {
        handleUnconnectedCommand(connection, command, argStr)
    }
}

function handleUnconnectedCommand(connection, command, argStr) {
    if (command.toLowerCase() === 'connect') {
        const args = argStr.split(/\s+/).filter( word => word ) // filter empty strings
        if (args.length === 2) {
            const user = leaves($user).find( user => user.name === args[0] )
            if (user && user.password === args[1]) {
                connection.connectedUser = user
                connection.announce('*** Connected ***')
                return
            }
        }
        connection.announce('Unrecognized user or password')
    } else {
        connection.announce('Try: connect <user> <password>')
    }
}
