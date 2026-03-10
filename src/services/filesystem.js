const DB_FILENAME = '.annotations.pb.gz'
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

export async function saveToHistory(handle) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  const store = tx.objectStore(IDB_STORE)

  // Upsert: store handle + timestamp
  store.put({ name: handle.name, handle, openedAt: Date.now() })

  return new Promise((resolve, reject) => {
    tx.oncomplete = async () => {
      // Prune old entries beyond MAX_HISTORY
      try {
        const all = await getHistory()
        if (all.length > MAX_HISTORY) {
          const tx2 = db.transaction(IDB_STORE, 'readwrite')
          const store2 = tx2.objectStore(IDB_STORE)
          for (const entry of all.slice(MAX_HISTORY)) {
            store2.delete(entry.name)
          }
        }
      } catch { /* ignore prune errors */ }
      resolve()
    }
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
  // Update timestamp
  await saveToHistory(handle)
  return handle
}

export async function readFileTree(dirHandle, basePath = '') {
  const entries = []

  for await (const [name, handle] of dirHandle) {
    if (name.startsWith('.')) continue

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

export async function readDbFile(dirHandle) {
  try {
    const fileHandle = await dirHandle.getFileHandle(DB_FILENAME)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

export async function writeDbFile(dirHandle, data) {
  const fileHandle = await dirHandle.getFileHandle(DB_FILENAME, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
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
