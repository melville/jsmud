import fs from 'node:fs'
import { clearTask } from './tasks.js'

/**
 * Database objects are special because:
 *  - They need to be reliably serializable in order to survive the checkpoint/restore of the database
 *  - They need to store functions that survive serialization
 *  - Those stored functions need to reference other database objects after deserialization
 *  - They need to preserve their connection to their prototype (parent) object when serialized
 */

class DatabaseObject {
    // This will be the ultimate parent for all objects.  We can add any built-in functionality we want here,
    // and it will be available even to the root object in the DB.  Anything created via 'new DatabaseObject()`
    // (as opposed to the createObject() primitive) will have no ID and no parent, nor will it actually exist
    // in the database.  We only use this as the parent of the root object.

    ancestors() {
        const ancs = []
        let next = this.parent
        while (next) {
            ancs.push(next)
            next = next.parent
        }
        return ancs
    }

    descendants() {
        const descs = []
        for (const kid of this.children) {
            descs.push(kid, ...kid.descendants())
        }
        return descs
    }

    leaves() {
        const lvs = []
        for (const kid of this.children) {
            const d = kid.descendants()
            if (d.length)
                lvs.push(...kid.leaves())
            else
                lvs.push(kid)
        }
        return lvs
    }

    toString() { return `${this.hasOwnProperty('name') ? this.name : 'Unnamed Object'} (${this.id})` }
}
const rootParent = new DatabaseObject()

// $garbage will be the parent of deleted objects
global.$garbage = new DatabaseObject()

export function createObject(parent, data) {
    if (!(parent instanceof DatabaseObject))
        throw new Error('Parent must be a database object')
    const obj = Object.create(parent)
    Object.assign(obj, data)
    obj.id = ulid() // Created objects will always get a new ID as an anti-footgun measure
    obj.parent = parent
    obj.children = new Set()
    db[obj.id] = obj
    parent.children.add(obj)
    return obj
}

export function deleteObject(obj) {
    if (obj.constructor.name !== 'DatabaseObject')
        throw new Error('Object is not a database object')
    if (obj.children.length)
        throw new Error('Cannot delete object with children')
    // Obj might still be referenced by other objects.  We change its parent to $garbage so it's obvious that
    // the object is dead when it's referenced
    changeParent(obj, $garbage)
    delete db[obj.id]
}

export function changeParent(obj, newParent) {
    if (!(newParent instanceof DatabaseObject))
        throw new TypeError('Invalid parent object')
    // Make sure the new parent isn't a descendant of obj
    if (descendants(obj).includes(newParent))
        throw new Error('New parent is a descendant of the object')
    const oldParent = obj.parent
    if (!oldParent)
        throw new Error('Object has no parent.  Are you trying to reparent the root object?')
    oldParent.children.delete(obj)
    Object.setPrototypeOf(obj, newParent)
    obj.parent = newParent
    newParent.children.add(obj)
}

const dbDataFile = process.argv[2]

export function loadDatabase() {
    console.log(`Loading database...`)

    // Kill any scheduled tasks in the current DB if we are reloading in a running instance
    const scheduled = global.db?.tasks
    if (scheduled)
        Object.keys(scheduled).forEach( id => clearTask(id) )

    global.db = JSON.parse(fs.readFileSync(dbDataFile))
    restoreDbObjects()
    // Setup shortcut refs for important objects
    for (const [name, id] of Object.entries(db.refs ?? {})) {
        global[`$${name}`] = db[id]
    }

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
            if (value === null) return null
            if (value.constructor.name === 'Timeout')
                return undefined // Ignore task timeouts, they will be recreated if the DB is restored
            if (value instanceof DatabaseObject)
                if (this === db) { // top-level DB object, should be fully serialized
                    return { dbSerializerTransform: 'dbObject', ...value }
                } else {
                    return { dbSerializerTransform: 'ref', id: value.id } // DB object referenced somewhere else, store as a ref
                }
            if (value instanceof Set)
                return { dbSerializerTransform: 'set', values: Array.from(value) }
            else
                return value
        default:
            return value
    }
}

function restoreDbObjects() {
    for (const [id, obj] of Object.entries(db)) {
        // Everything but the 'refs' and 'tasks' fields should be a dbObject
        if (obj.dbSerializerTransform === 'dbObject') {
            // Transform function code back to functions
            for (const [field, value] of Object.entries(obj)) {
                if (value?.dbSerializerTransform === 'function')
                    obj[field] = new Function(`return ${value.code}`)()
            }
            // Set the parent object
            if (obj.parent) {
                // Parent info will be an untransformed ref at this point.  It will get resolved later, but at this
                // stage we need to dereference it manually
                Object.setPrototypeOf(db[id], db[obj.parent.id])
            } else {
                Object.setPrototypeOf(db[id], rootParent) // This is the root object
            }
            delete obj.dbSerializerTransform
            db[id] = obj // obj will have constructor.name === 'DatabaseObject'
        }
    }
    restoreSets(db, [])
    restoreRefs(db, [])
    restoreTasks(db)
}

function restoreRefs(node, visited) {
    if (typeof node !== 'object' || node === null || visited.includes(node)) return
    visited.push(node)
    if (Array.isArray(node)) {
        for (const [index, entry] of node.entries()) {
            if (entry?.dbSerializerTransform === 'ref') {
                node[index] = db[entry.id]
                // Since this was a ref to a DB object its props will be traversed elsewhere, we don't need to recurse
            } else {
                restoreRefs(entry, visited)
            }
        }
        return
    }
    if (node instanceof Set) {
        for (const member of new Set(node)) { // copy to avoid changing the set while we're iterating it
            if (member?.dbSerializerTransform === 'ref') {
                node.delete(member)
                node.add(db[member.id])
            } else {
                restoreRefs(member, visited)
            }
        }
        return
    }
    // Regular objects
    for (const [key, value] of Object.entries(node)) {
        if (value?.dbSerializerTransform === 'ref') {
            node[key] = db[value.id]
        } else {
            restoreRefs(value, visited)
        }
    }
}

function restoreSets(node, visited) {
    if (typeof node !== 'object' || node === null || visited.includes(node)) return
    visited.push(node)
    if (Array.isArray(node)) {
        for (const [index, entry] of node.entries()) {
            if (entry?.dbSerializerTransform === 'set') {
                node[index] = new Set(entry.values)
            }
            restoreSets(node[index], visited)
        }
        return
    }
    if (node instanceof Set) {
        for (const member of new Set(node)) { // copy to avoid modifying the set we're iterating over
            if (member?.dbSerializerTransform === 'set') {
                node.remove(member)
                const set = new Set(member.values)
                node.add(set)
                restoreSets(set, visited)
            } else {
                restoreSets(member, visited)
            }
        }
        return
    }
    for (const [key, value] of Object.entries(node)) {
        if (value?.dbSerializerTransform === 'set') {
            node[key] = new Set(value.values)
        }
        restoreSets(node[key], visited)
    }
}

function restoreTasks(db) {
    if (!db.tasks) db.tasks = {}
    for (const [id, taskDef] of Object.entries(db.tasks)) {
        // We expect the tasks to be in insertion order, which is chronological
        const { func: { code }, runAt, interval, args } = taskDef
        const func = new Function(`return ${code}`)()
        if (runAt) {
            db.tasks[id].timeoutInfo = setTimeout(() => {
                func(...args)
                clearTask(id)
            }, runAt - Date.now())
        } else if (interval) {
            db.tasks[id].timeoutInfo = setInterval(func, interval, ...args)
            // These will only go away when something else calls clearTask
        }
    }
}
