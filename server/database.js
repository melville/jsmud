import fs from 'node:fs'
import { clearTask, scheduleTask } from './tasks.js'

/**
 * Database objects are special because:
 *  - They need to be reliably serializable in order to survive the checkpoint/restore of the database
 *  - They need to store functions that survive serialization
 *  - Those stored functions need to reference other database objects after deserialization
 *  - They need to preserve their connection to their prototype (parent) object when serialized
 */

class DatabaseObject {
    // This will be the ultimate parent for all objects.  We could add any built-in functionality we want here,
    // and it would be available even to the root object in the DB.  Anything created via 'new DatabaseObject()`
    // (as opposed to the createObject() primitive) will have no ID and no parent, not will it actually exist
    // in the database.  We only use this as the parent of the root object.
}
const rootParent = new DatabaseObject()

// $garbage will be the parent of deleted objects
global.$garbage = new DatabaseObject()

export function createObject(parent, data) {
    if (parent.constructor.name !== 'DatabaseObject')
        throw new Error('Parent must be a database object')
    const obj = Object.create(parent)
    Object.assign(obj, data)
    obj.id = ulid() // Created objects will always get a new ID as an anti-footgun measure
    db[obj.id] = obj
    return obj
}

export function deleteObject(obj) {
    if (obj.constructor.name !== 'DatabaseObject')
        throw new Error('Object is not a database object')
    if (children(obj).length)
        throw new Error('Cannot delete object with children')
    // Obj might still be referenced by other objects.  We change its parent to $garbage so it's obvious that
    // the object is dead when it's referenced
    changeParent(obj, $garbage)
    delete db[obj.id]
}

export function changeParent(obj, parent) {
    if (parent.constructor.name !== 'DatabaseObject')
        throw new TypeError('Invalid parent object')
    // Make sure the new parent isn't a descendant of obj
    if (descendants(obj).includes(parent))
        throw new Error('New parent is a descendant of the object')
    Object.setPrototypeOf(obj, parent)
}

export function children(parent) {
    const kids = []
    for (const obj of Object.values(db)) {
        if (Object.getPrototypeOf(obj) === parent)
            kids.push(obj)
    }
    return kids
}

export function ancestors(obj) {
    const ancs = []
    let next = parent(obj)
    while (next) {
        ancs.push(next)
        next = parent(next)
    }
    return ancs
}

export function descendants(obj) {
    const descs = []
    for (const kid of children(obj)) {
        descs.push(kid, ...descendants(kid))
    }
    return descs
}

export function leaves(obj) {
    const lvs = []
    for (const kid of children(obj)) {
        const d = descendants(kid)
        if (d.length)
            lvs.push(...leaves(kid))
        else
            lvs.push(kid)
    }
    return lvs
}

export function parent(obj) {
    if (obj.constructor.name !== 'DatabaseObject')
        throw new TypeError('Not a database object')
    const parent = Object.getPrototypeOf(obj)
    // We don't want to expose anything above the root object, so we check for an id to confirm we're still in the DB
    return parent.id ? parent : null
}

const dbDataFile = process.argv[2]

export function loadDatabase() {
    console.log(`Loading database...`)

    // Kill any scheduled tasks in the current DB if we are reloading in a running instance
    const scheduled = global.db?.tasks
    if (scheduled)
        Object.keys(scheduled).forEach( id => clearTask(id) )

    const db = JSON.parse(fs.readFileSync(dbDataFile))
    restoreDbObjects(db)
    // Setup shortcut refs for important objects
    for (const [name, id] of Object.entries(db.refs ?? {})) {
        global[`$${name}`] = db[id]
    }
    global.db = db

    console.log(`Database loaded.  Created ${Object.keys(db).length - 1} objects.  Added ${Object.keys(db.refs).length} refs.`)
}

export function dumpDatabase() {
    console.log(`Dumping database...`)
    const serializedDB = JSON.stringify(db, transformDbObjects, 2)
    fs.writeFileSync(dbDataFile, serializedDB)
    console.log(`Finished dumping database.`)
}

function transformDbObjects(key, value) {
    switch (typeof value) {
        case 'function':
            if (value.toString().includes('[native code]'))
                throw new Error(`Can't serialize native function code for key ${key} in ${this}: ${value.toString()}`)
            else
                return { dbSerializerTransform: 'function', code: value.toString() }
        case 'object':
            if (value.constructor.name === 'Timeout')
                return undefined // Ignore task timeouts, they will be recreated if the DB is restored
            if (value.constructor.name === 'DatabaseObject')
                if (this === db) { // top-level DB object, should be fully serialized
                    const parentObj = Object.getPrototypeOf(value)
                    let parent
                    if (parentObj?.constructor.name === 'DatabaseObject')
                        parent = parentObj.id
                    return { dbSerializerTransform: 'dbObject', ...value, parent }
                } else {
                    return { dbSerializerTransform: 'ref', id: value.id } // DB object referenced somewhere else, store as a ref
                }
            else
                return value
        default:
            return value
    }
}

function restoreDbObjects(db) {
    for (const [id, obj] of Object.entries(db)) {
        // Everything but the 'refs' and 'tasks' fields should be a dbObject
        if (obj.dbSerializerTransform === 'dbObject') {
            // Transform function code back to functions
            for (const [field, value] of Object.entries(obj)) {
                if (value.dbSerializerTransform === 'function')
                    obj[field] = new Function(`return ${value.code}`)()
            }
            // Set the parent object
            if (obj.parent) {
                Object.setPrototypeOf(db[id], db[obj.parent])
                delete db[id].parent
            } else {
                Object.setPrototypeOf(db[id], rootParent) // This is the root object
            }
            delete obj.dbSerializerTransform
            db[id] = obj // obj will have constructor.name === 'DatabaseObject'
        }
    }
    restoreRefs(db, db)
    restoreTasks(db)
}

function restoreRefs(node, db) {
    if (typeof node !== 'object') return
    if (Array.isArray(node)) {
        for (const entry of node) {
            restoreRefs(entry, db)
        }
        return
    }
    for (const [key, value] of Object.entries(node)) {
        if (value.dbSerializerTransform === 'ref') {
            node[key] = db[value.id]
            return
        } else {
            restoreRefs(value, db)
        }
    }
}

function restoreTasks(db) {
    if (!db.tasks) db.tasks = {}
    for (const [id, taskDef] of Object.entries(db.tasks)) {
        // We expect the tasks to be in insertion order, which is chronological
        const { func: { code }, runAt, args } = taskDef
        const func = new Function(`return ${code}`)()
        db.tasks[id].timeoutInfo = setTimeout(() => {
            func(...args)
            clearTask(id)
        }, runAt - Date.now())
    }
}
