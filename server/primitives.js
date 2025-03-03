import { createObject, deleteObject, dumpDatabase, loadDatabase} from './database.js'
import { ulid } from 'ulid'

export function createPrimitives() {
    global.createObject = createObject
    global.deleteObject = deleteObject
    global.dumpDatabase = dumpDatabase
    global.loadDatabase = loadDatabase
    global.ulid = ulid
}
