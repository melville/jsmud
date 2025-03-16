
export function scheduleTask(func, timeout, ...args) {
    if (typeof func !== 'function')
        throw new Error('Task to schedule must be a function')
    if (func.toString().includes('[native code]'))
        throw new Error('Task function contains native code.  Scheduled tasks must be serializable')
    const id = ulid()
    const timeoutInfo = setTimeout(() => {
        func(...args)
        clearTask(id)
    }, timeout)
    db.tasks[id] = { id, func, timeoutInfo, runAt: Date.now() + timeout, args }
    return id
}

export function clearTask(taskId) {
    const { timeoutInfo } = db.tasks[taskId]
    if (timeoutInfo) {
        clearTimeout(timeoutInfo)
        delete db.tasks[taskId]
        return true
    } else {
        return false
    }
}

export function tasks(user) {
    return Object.values(db.tasks)
}
