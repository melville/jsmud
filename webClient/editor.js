require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' }});
window.MonacoEnvironment = {
    getWorkerUrl: () => URL.createObjectURL(
        new Blob([
            'self.MonacoEnvironment = { baseUrl: "https://unpkg.com/monaco-editor@latest/min/" }; importScripts("https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js")'
            ],
            { type: 'text/javascript' })
    )
}

function moveEditor(event, window) {
    window.style.left = `${event.clientX - window.dragOffset.x}px`
    window.style.top = `${event.clientY - window.dragOffset.y}px`
}

let maxEditorZ = 1000
window.setupEditor = function (data) {
    console.log("setup editor", data)

    const editorTitle = document.createElement('div')
    editorTitle.setAttribute('class', 'editorTitle')
    editorTitle.innerHTML = data.title

    const editorCloseButton = document.createElement('button')
    editorCloseButton.innerHTML = 'Close'
    editorCloseButton.addEventListener('click', function () {
        document.getElementById('pageContainer').removeChild(editorWindow)
    })

    const editorSaveButton = document.createElement('button')
    editorSaveButton.innerHTML = 'Save'

    const editorControls = document.createElement('div')
    editorControls.setAttribute('class', 'editorControls')
    editorControls.append(editorSaveButton, editorCloseButton)

    const editorHeader = document.createElement('div')
    editorHeader.setAttribute('class', 'editorHeader')
    const mouseMoveHandler = (event) => moveEditor(event, editorWindow)
    editorHeader.addEventListener("mouseup", function (event) {
        event.preventDefault()
        document.removeEventListener('mousemove', mouseMoveHandler)
    })
    editorHeader.addEventListener("mousedown", function (event) {
        editorWindow.dragOffset.x = event.clientX - editorWindow.offsetLeft
        editorWindow.dragOffset.y = event.clientY - editorWindow.offsetTop
        document.addEventListener('mousemove', mouseMoveHandler)
    })
    editorHeader.append(editorTitle, editorControls)

    const editorId = `editor-${data.dest}-${data.propName}`
    const editorDiv = document.createElement('div')
    editorDiv.setAttribute('class', 'editor')
    editorDiv.setAttribute('id', editorId)

    const editorWindow = document.createElement('div')
    editorWindow.addEventListener('mousedown', function (event) {
        event.preventDefault()
        editorWindow.style.zIndex = maxEditorZ++
    })
    editorWindow.setAttribute('class', 'editorWindow')
    editorWindow.style.zIndex = maxEditorZ++
    editorWindow.dragOffset = { x: 0, Y: 0 }
    editorWindow.append(editorHeader, editorDiv)

    document.getElementById('pageContainer').appendChild(editorWindow)

    require(["vs/editor/editor.main"], function () {
        const editor = monaco.editor.create(editorDiv, {
            value: data.value,
            language: 'javascript',
            theme: 'vs-dark'
        })
        editor.jsmudData = data
        editorSaveButton.addEventListener('click', function () {
            websocket.send(JSON.stringify({
                ...editor.jsmudData,
                type: 'save',
                value: editor.getModel().getValue(),
            }))
        })
    })
}
