const outputPane = new Terminal({ convertEol: true })
outputPane.fitAddon = new FitAddon()
outputPane.loadAddon(outputPane.fitAddon)
outputPane.open(document.getElementById('outputPane'))
outputPane.fitAddon.fit()
const inputPane = new Terminal()
inputPane.fitAddon = new FitAddon()
inputPane.loadAddon(inputPane.fitAddon)
inputPane.open(document.getElementById('inputPane'))
inputPane.fitAddon.fit()
const localEcho = new LocalEchoController(inputPane)

function debounce(func, delay = 100) {
    let timer
    return function(...args) {
        clearTimeout(timer)
        timer = setTimeout(() => {
            func.apply(this, args)
        }, delay)
    }
}

const handleResize = () => {
    outputPane.fitAddon.fit()
    inputPane.fitAddon.fit()
}

window.addEventListener('resize', debounce(handleResize, 250));

let connected = false

async function connect() {
    if (window.websocket) websocket.close()
    outputPane.write('Connecting... ')
    window.websocket = new WebSocket("ws://localhost:6969/")
    websocket.onopen = function() {
        outputPane.writeln('Connected.')
        connected = true
        readInput()
    }

    websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data)
            switch (data.type) {
                case 'announce':
                    outputPane.writeln(data.text)
                    break
                case 'edit':
                    setupEditor(data)
                    break
                default:
                    console.error(`Unknown message type: ${event.data}`)
            }
        } catch (error) {
            console.error('Error processing message', error)
        }
    }

    websocket.onclose = function(event) {
        outputPane.writeln("*** Disconnected ***")
        connected = false
    }
}

async function readInput() {
    while (connected) {
        const text = await localEcho.read("")
        outputPane.writeln(`> ${text}`)
        websocket.send(JSON.stringify({ type: 'input', text }))
    }
}

connect()
inputPane.focus()
