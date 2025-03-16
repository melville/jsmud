import { ancestors, changeParent, children, createObject, deleteObject, descendants, dumpDatabase, leaves, loadDatabase, parent } from './database.js'
import { clearTask, scheduleTask, tasks } from './tasks.js'
import { ulid } from 'ulid'

export function createPrimitives() {
    global.ancestors = ancestors
    global.changeParent = changeParent
    global.children = children
    global.clearTask = clearTask
    global.createObject = createObject
    global.deleteObject = deleteObject
    global.descendants = descendants
    global.dumpDatabase = dumpDatabase
    global.leaves = leaves
    global.loadDatabase = loadDatabase
    global.parent = parent
    global.scheduleTask = scheduleTask
    global.tasks = tasks
    global.ulid = ulid
}
