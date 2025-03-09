import { changeParent, children, createObject, deleteObject, descendants, dumpDatabase, loadDatabase, parent } from './database.js'
import { ulid } from 'ulid'

export function createPrimitives() {
    global.changeParent = changeParent
    global.children = children
    global.createObject = createObject
    global.deleteObject = deleteObject
    global.descendants = descendants
    global.dumpDatabase = dumpDatabase
    global.loadDatabase = loadDatabase
    global.parent = parent
    global.ulid = ulid
}
