import { changeParent, createObject, deleteObject, dumpDatabase, loadDatabase } from './database.js'
import { clearTask, scheduleTask, scheduleTaskInterval, tasks } from './tasks.js'
import { ulid } from 'ulid'

export function createPrimitives() {
    global.changeParent = changeParent
    global.clearTask = clearTask
    global.createObject = createObject
    global.deleteObject = deleteObject
    global.dumpDatabase = dumpDatabase
    global.loadDatabase = loadDatabase
    global.scheduleTask = scheduleTask
    global.scheduleTaskInterval = scheduleTaskInterval
    global.tasks = tasks
    global.ulid = ulid
}
