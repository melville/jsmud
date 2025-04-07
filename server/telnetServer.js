import blessed from 'ultra-blessed'
import telnet from 'telnet'
import { Connection } from './connection.js'
import { handleInput } from './parser.js'

class TelnetConnection extends Connection {
    client = null
    screen = null
    outputBox = null
    inputBox = null

    constructor(client) {
        super()
        this.screen = this.#setupScreen(client)
        this.client = this.#configureClient(client, this.screen)
        this.#setupTerminal()
    }

    get sourceAddress() { return this.client.remoteAddress }

    announce(text) {
        this.outputBox.add(text)
    }

    #setupScreen(client) {
        const screen = blessed.screen({
            smartCSR: true,
            input: client,
            output: client,
            terminal: 'xterm-256color',
            fullUnicode: true,
            dockBorders: true
        })
        screen.on('destroy', function () {
            if (client.writable) client.destroy()
        })
        return screen
    }

    #setupTerminal() {
        // const form = blessed.form({
        //     parent: this.screen,
        //     width: '100%',
        //     height: '100%',
        //     keys: true,
        //     vi: false
        // })

        const outputBox = blessed.log({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: '100%-3',
            border: {
                type: 'line'
            },
            content: '\n\nWelcome to JSMUD\n\nType "connect <user> <password>" to connect.',
            tags: true,
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                inverse: true,
                track: {
                    ch: ' ',
                    inverse: false,
                    bg: 'cyan'
                }
            },
            keys: true,
            keyable: true,
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: 'blue',
                    bg: 'black'
                },
                focus: {
                    border: {
                        fg: 'black',
                        bg: 'lightblue'
                    }
                }
            }
        })

        const inputBox = blessed.textarea({
            parent: this.screen,
            bottom: 0,
            width: '100%',
            height: 4,
            keys: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: 'blue',
                    bg: 'black'
                },
                focus: {
                    border: {
                        fg: 'black',
                        bg: 'blue'
                    }
                }
            }
        })
        const connection = this
        const screen = this.screen
        inputBox.key('enter', () => {
            handleInput(connection, inputBox.value)
            inputBox.value = ''
            screen.render()
        })
        inputBox.key('tab', () => {
            outputBox.focus()
            return true
        })
        outputBox.key('tab', () => {
            inputBox.focus()
            return true
        })
        inputBox.on('focus', () => {
            inputBox.readInput()
        })

        this.outputBox = outputBox
        this.inputBox = inputBox
        // It seems to take a few ticks for the initial config to settle.  There is a bug that keeps the cursor from
        // showing up initially if we set focus here immediately, hence to delay.
        setTimeout(() => inputBox.focus(), 100)
    }

    #configureClient(client, screen) {
        client.do.transmit_binary()
        client.do.terminal_type()
        client.do.window_size()
        client.do.environment_variables()

        // Uncomment for detailed telnet debug logs
        // client.on('debug', function(msg) {
        //     console.error(msg)
        // })

        client.on('environment variables', function(data) {
            if (data.command === 'sb') {
                if (data.name === 'TERM') {
                    screen.terminal = data.value
                } else {
                    // Clear the screen since they may have used `env send [var]`.
                    screen.realloc()
                }
                screen.render()
            }
        })

        client.on('terminal type', function(data) {
            if (data.command === 'sb' && data.name) {
                screen.terminal = data.name
                screen.render()
            }
        })

        client.on('window size', function(data) {
            if (data.command === 'sb') {
                client.columns = data.columns
                client.rows = data.rows
                client.emit('resize')
            }
        })

        // Make the client look like a tty:
        client.setRawMode = function(mode) {
            client.isRaw = mode
            if (!client.writable) return
            if (mode) {
                client.do.suppress_go_ahead()
                client.will.suppress_go_ahead()
                client.will.echo()
            } else {
                client.dont.suppress_go_ahead()
                client.wont.suppress_go_ahead()
                client.wont.echo()
            }
        }
        client.isTTY = true
        client.isRaw = false
        client.columns = 80
        client.rows = 24

        const connection = this
        client.on('close', function() {
            if (!screen.destroyed) screen.destroy()
            connectionManager.removeConnection(connection)
            console.log(`Telnet client disconnected: ${connection.id}`)
        })


        return client
    }
}

export class TelnetListener {
    // Make supporting libs available in the global scope via telnetListener.libs
    static libs = {
        blessed
    }

    constructor(port) {
        this.port = port
        this.listener = telnet.createServer(function(client) {
            connectionManager.addConnection(new TelnetConnection(client))
        }).listen(port)

        console.log(`Telnet listener started on port ${port}`)
    }
}
