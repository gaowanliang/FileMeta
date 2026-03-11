export const DEFAULT_DB_FILENAME = '.annotations.pb.gz'
const IDB_NAME = 'file-meta-history'
const IDB_STORE = 'folders'
const MAX_HISTORY = 20

/** @type {FileSystemDirectoryHandle | null} */
let rootHandle = null

export function getRootHandle() {
  return rootHandle
}

export async function openDirectory() {
  rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  return rootHandle
}

// ---- IndexedDB history for FileSystemDirectoryHandle ----

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveToHistory(handle, dbFilename = undefined) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  const store = tx.objectStore(IDB_STORE)

  // Upsert: store handle + timestamp + optional dbFilename
  const entry = { name: handle.name, handle, openedAt: Date.now() }
  if (dbFilename !== undefined) entry.dbFilename = dbFilename
  store.put(entry)

  return new Promise((resolve, reject) => {
    tx.oncomplete = async () => {
      // Prune old entries beyond MAX_HISTORY
      try {
        const all = await getHistory()
        if (all.length > MAX_HISTORY) {
          const tx2 = db.transaction(IDB_STORE, 'readwrite')
          const store2 = tx2.objectStore(IDB_STORE)
          for (const e of all.slice(MAX_HISTORY)) {
            store2.delete(e.name)
          }
        }
      } catch { /* ignore prune errors */ }
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function getHistoryEntry(folderName) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readonly')
  const store = tx.objectStore(IDB_STORE)
  return new Promise((resolve, reject) => {
    const req = store.get(folderName)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function updateDbFilenameInHistory(folderName, newFilename) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const getReq = store.get(folderName)
    getReq.onsuccess = () => {
      const entry = getReq.result
      if (entry) {
        entry.dbFilename = newFilename
        store.put(entry)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getHistory() {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readonly')
  const store = tx.objectStore(IDB_STORE)
  const req = store.getAll()
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const entries = req.result || []
      entries.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
      resolve(entries)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function removeFromHistory(name) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).delete(name)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function reopenFromHistory(entry) {
  const handle = entry.handle
  // Request permission again — browser requires user gesture
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') {
    throw new Error('Permission denied')
  }
  rootHandle = handle
  return handle
}

export async function readFileTree(dirHandle, basePath = '', excludeAtRoot = new Set()) {
  const entries = []

  for await (const [name, handle] of dirHandle) {
    if (name.startsWith('.')) continue
    if (basePath === '' && excludeAtRoot.has(name)) continue

    const path = basePath ? `${basePath}/${name}` : name

    if (handle.kind === 'directory') {
      const children = await readFileTree(handle, path)
      entries.push({
        key: path,
        label: name,
        icon: 'pi pi-folder',
        type: 'directory',
        children,
      })
    } else {
      entries.push({
        key: path,
        label: name,
        icon: getFileIcon(name),
        type: 'file',
      })
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  return entries
}

export async function readDbFile(dirHandle, filename = DEFAULT_DB_FILENAME) {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

export async function writeDbFile(dirHandle, data, filename = DEFAULT_DB_FILENAME) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function deleteDbFile(dirHandle, filename) {
  try {
    await dirHandle.removeEntry(filename)
  } catch {
    // Ignore — file may not exist yet
  }
}

/** Scan root of dirHandle for the first *.pb.gz file; returns its name or null. */
export async function findPbGzFile(dirHandle) {
  for await (const [name, handle] of dirHandle) {
    if (handle.kind === 'file' && name.endsWith('.pb.gz')) {
      return name
    }
  }
  return null
}

function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  const iconMap = {
    pdf: 'pi pi-file-pdf',
    doc: 'pi pi-file-word',
    docx: 'pi pi-file-word',
    xls: 'pi pi-file-excel',
    xlsx: 'pi pi-file-excel',
    ppt: 'pi pi-file',
    pptx: 'pi pi-file',
    jpg: 'pi pi-image',
    jpeg: 'pi pi-image',
    png: 'pi pi-image',
    gif: 'pi pi-image',
    svg: 'pi pi-image',
    webp: 'pi pi-image',
    mp4: 'pi pi-video',
    mp3: 'pi pi-volume-up',
    zip: 'pi pi-box',
    rar: 'pi pi-box',
    js: 'pi pi-code',
    ts: 'pi pi-code',
    vue: 'pi pi-code',
    html: 'pi pi-code',
    css: 'pi pi-palette',
    json: 'pi pi-cog',
    md: 'pi pi-book',
    txt: 'pi pi-file-edit',
  }
  return iconMap[ext] || 'pi pi-file'
}
