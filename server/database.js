import fs from 'node:fs'

/**
 * Database objects are special because:
 *  - They need to be reliably serializable in order to survive the checkpoint/restore of the database
 *  - They need to store functions that survive serialization
 *  - Those stored functions need to reference other database objects after deserialization
 */

class DatabaseObject {
    // Right now this class is just a convenient way to keep track of which objects are DB objects, but we'll probably
    // want to add quality-of-life stuff that makes it easy to work with them later.
    constructor(data) {
        this.id = ulid()
        Object.assign(this, data)
    }
}

export function createObject(data) {
    const obj = new DatabaseObject(data)
    db[obj.id] = obj
    return obj
}

export function deleteObject(id) {
    delete db[id]
}

const dbDataFile = process.argv[2]

export function loadDatabase() {
    console.log(`Loading database...`)
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
}

function transformDbObjects(key, value) {
    switch (typeof value) {
        case 'function':
            if (value.toString().includes('[native code]'))
                throw new Error(`Can't serialize native function code for key ${key} in ${this}: ${value.toString()}`)
            else
                return { dbSerializerTransform: 'function', code: value.toString() }
        case 'object':
            if (value.constructor.name === 'DatabaseObject')
                if (this === db)
                    return { dbSerializerTransform: 'dbObject', ...value } // top-level DB object, should be fully serialized
                else
                    return { dbSerializerTransform: 'ref', id: value.id } // DB object referenced somewhere else, store as a ref
            else
                return value
        default:
            return value
    }
}

function restoreDbObjects(db) {
    for (const [id, data] of Object.entries(db)) {
        // Everything but the 'refs' field should be a dbObject
        if (data.dbSerializerTransform === 'dbObject') {
            // Transform function code back to functions
            for (const [field, value] of Object.entries(data)) {
                if (value.dbSerializerTransform === 'function')
                    data[field] = new Function(`return ${value.code}`)()
            }
            delete data.dbSerializerTransform
            db[id] = new DatabaseObject(data)
        }
    }
    restoreRefs(db, db)
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
