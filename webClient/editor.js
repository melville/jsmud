require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' }});
window.MonacoEnvironment = {
    getWorkerUrl: () => URL.createObjectURL(
        new Blob([
            'self.MonacoEnvironment = { baseUrl: "https://unpkg.com/monaco-editor@latest/min/" }; importScripts("https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js")'
            ],
            { type: 'text/javascript' })
    )
}

let editor
require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: 'javascript',
        theme: 'vs-dark'
    })
})

const container = document.getElementById('editorWindow')
const header = document.getElementById('editorHeader')
const offset = { x: 0, y: 0 }
const closeButton = document.getElementById('editorCloseButton')
const saveButton = document.getElementById('editorSaveButton')

header.addEventListener("mousedown", function (event) {
    console.log("mousedown event", event)
    offset.x = event.clientX - container.offsetLeft
    offset.y = event.clientY - container.offsetTop
    document.addEventListener('mousemove', moveEditor)
})

header.addEventListener("mouseup", function () {
    console.log("mouseup event", event)
    document.removeEventListener('mousemove', moveEditor)
})

function moveEditor(event) {
    console.log(`${event.clientX - offset.x}, ${event.clientY - offset.y}`)
    container.style.left = `${event.clientX - offset.x}px`
    container.style.top = `${event.clientY - offset.y}px`
}

closeButton.addEventListener("click", function (event) {
    editor.getModel().setValue('')
    container.style.zIndex = -1000
})

saveButton.addEventListener("click", function (event) {
    websocket.send(JSON.stringify({
        ...editor.jsmudData,
        type: 'save',
        value: editor.getModel().getValue(),
    }))
})

window.setupEditor = function (data) {
    console.log("setup editor", data)
    editor.jsmudData = data
    editor.getModel().setValue(data.value)
    container.style.zIndex = 1000
}
