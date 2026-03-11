import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  openDirectory, readFileTree, readDbFile, deleteDbFile,
  saveToHistory, getHistory, getHistoryEntry, removeFromHistory, reopenFromHistory,
  findDbFile, updateDbFilenameInHistory, DEFAULT_DB_FILENAME,
} from '@/services/filesystem.js'
import { decompressAndDecodeLegacy } from '@/services/protobuf.js'
import { detectFormat, readFmdbFile, writeFmdbFile } from '@/services/container.js'
import { revokeAllImageUrls, revokeImageUrl, getCachedImageUrl, createImageUrlFromBlob } from '@/services/image.js'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const dirHandle = ref(null)
  const folderName = ref('')
  const fileTree = ref([])
  const selectedFile = ref(null)
  const files = ref({})              // Map<string, { markdownContent, updatedAt }>
  const imageIndex = ref({})         // Map<string, { offset, size }> — on-disk images
  const pendingImages = ref({})      // Map<string, Uint8Array> — newly added, not yet saved
  const isDirty = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const recentFolders = ref([])      // { name, handle, openedAt }[]
  const dbFilename = ref(DEFAULT_DB_FILENAME)
  const darkMode = ref(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )
  // UI modal state
  const showOrphanManager = ref(false)
  const showDbSettings = ref(false)

  // Private — not reactive, not exposed
  let _fileRef = null                // File object for lazy image reads
  let _fileHandle = null             // FileSystemFileHandle for writes
  let _legacyFilename = null         // original .pb.gz name during migration

  // Getters
  const currentAnnotation = computed(() => {
    if (!selectedFile.value) return null
    return files.value[selectedFile.value] || null
  })

  const currentMarkdown = computed(() => {
    return currentAnnotation.value?.markdownContent || ''
  })

  const hasFolder = computed(() => !!dirHandle.value)

  const annotatedFiles = computed(() => {
    return new Set(Object.keys(files.value).filter(k => files.value[k]?.markdownContent))
  })

  // Flat set of all file paths currently in the tree
  const flatFileTree = computed(() => {
    const result = new Set()
    function flatten(nodes) {
      for (const node of nodes) {
        if (node.type === 'file') result.add(node.key)
        if (node.children) flatten(node.children)
      }
    }
    flatten(fileTree.value)
    return result
  })

  // Annotations whose file paths no longer exist in the file tree
  const orphanedFiles = computed(() => {
    if (!dirHandle.value) return []
    const treeSet = flatFileTree.value
    return Object.keys(files.value).filter(
      path => !treeSet.has(path) && files.value[path]?.markdownContent?.trim()
    )
  })

  // ── Image lazy loading ──────────────────────────────────────

  /**
   * Get a blob URL for the given image. Checks cache → pendingImages → on-disk.
   * Returns null if the image doesn't exist.
   */
  async function getImageUrl(imageId) {
    // 1. Cached blob URL
    const cached = getCachedImageUrl(imageId)
    if (cached) return cached

    // 2. Pending image (newly pasted, not yet saved)
    const pending = pendingImages.value[imageId]
    if (pending) {
      const blob = new Blob([pending], { type: 'image/avif' })
      return createImageUrlFromBlob(imageId, blob)
    }

    // 3. On-disk image — read bytes into memory so the blob URL
    //    survives file rewrites (file.slice() Blobs break after save)
    const entry = imageIndex.value[imageId]
    if (entry && _fileRef) {
      const buf = await _fileRef.slice(entry.offset, entry.offset + entry.size).arrayBuffer()
      const blob = new Blob([buf], { type: 'image/avif' })
      return createImageUrlFromBlob(imageId, blob)
    }

    return null
  }

  // ── Load a directory handle (shared by open + reopenRecent) ─

  async function loadHandle(handle) {
    dirHandle.value = handle
    folderName.value = handle.name
    selectedFile.value = null
    files.value = {}
    imageIndex.value = {}
    pendingImages.value = {}
    _fileRef = null
    _fileHandle = null
    _legacyFilename = null
    dbFilename.value = DEFAULT_DB_FILENAME

    // Determine the db filename: prefer stored history entry, else auto-detect
    const histEntry = await getHistoryEntry(handle.name)
    if (histEntry?.dbFilename) {
      dbFilename.value = histEntry.dbFilename
    } else {
      const detected = await findDbFile(handle)
      if (detected) dbFilename.value = detected
    }

    // Exclude the db file from the visible tree if it doesn't start with '.'
    const excludeSet = dbFilename.value.startsWith('.')
      ? new Set()
      : new Set([dbFilename.value])
    const tree = await readFileTree(handle, '', excludeSet)
    fileTree.value = tree

    // Read db file
    const result = await readDbFile(handle, dbFilename.value)
    if (result) {
      const { fileHandle: fh, file } = result
      // Detect format from first 4 bytes
      const headerBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
      const format = detectFormat(headerBytes)

      if (format === 'fmdb') {
        const data = await readFmdbFile(file)
        files.value = data.files
        imageIndex.value = data.imageIndex
        _fileRef = file
        _fileHandle = fh
      } else if (format === 'legacy-pbgz') {
        // Legacy: decompress everything, put images into pendingImages for migration
        const buffer = new Uint8Array(await file.arrayBuffer())
        const decoded = await decompressAndDecodeLegacy(buffer)
        files.value = decoded.files || {}
        pendingImages.value = decoded.images || {}
        // Schedule migration: next save writes FMDB under a new filename
        _legacyFilename = dbFilename.value
        dbFilename.value = dbFilename.value.replace(/\.pb\.gz$/, '.fmdb')
      }
    }

    isDirty.value = false

    // Persist to history (always include current dbFilename)
    await saveToHistory(handle, dbFilename.value)
    await loadRecentFolders()
  }

  // ── Actions ─────────────────────────────────────────────────

  async function open() {
    isLoading.value = true
    try {
      revokeAllImageUrls()
      const handle = await openDirectory()
      await loadHandle(handle)
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to open directory:', e)
        throw e
      }
    } finally {
      isLoading.value = false
    }
  }

  async function reopenRecent(entry) {
    isLoading.value = true
    try {
      revokeAllImageUrls()
      const handle = await reopenFromHistory(entry)
      await loadHandle(handle)
    } catch (e) {
      if (e.message === 'Permission denied') {
        // User denied permission — remove stale entry
        await removeRecent(entry.name)
      }
      console.error('Failed to reopen folder:', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadRecentFolders() {
    try {
      recentFolders.value = await getHistory()
    } catch {
      recentFolders.value = []
    }
  }

  async function removeRecent(name) {
    await removeFromHistory(name)
    await loadRecentFolders()
  }

  function selectFile(path) {
    selectedFile.value = path
  }

  function updateMarkdown(path, content) {
    if (!files.value[path]) {
      files.value[path] = { markdownContent: '', updatedAt: 0 }
    }
    files.value[path].markdownContent = content
    files.value[path].updatedAt = Date.now()
    isDirty.value = true
  }

  function addImage(imageId, data) {
    pendingImages.value[imageId] = data
    isDirty.value = true
  }

  // ── Collect referenced image IDs from markdown ──────────────

  function collectUsedImageIds(filesObj) {
    const usedImages = new Set()
    const imgRegex = /local-avif:\/\/([a-f0-9-]+)/g
    for (const val of Object.values(filesObj)) {
      let match
      while ((match = imgRegex.exec(val.markdownContent)) !== null) {
        usedImages.add(match[1])
      }
    }
    return usedImages
  }

  // ── Save ────────────────────────────────────────────────────

  async function save() {
    if (!dirHandle.value || isSaving.value) return
    isSaving.value = true
    try {
      // 1. Clean up empty annotations
      const cleanFiles = {}
      for (const [key, val] of Object.entries(files.value)) {
        if (val?.markdownContent?.trim()) {
          cleanFiles[key] = val
        }
      }

      // 2. Collect referenced image IDs
      const usedImages = collectUsedImageIds(cleanFiles)

      // 3. Separate into existing (on-disk) vs new (pending), keeping only referenced
      const existingImages = {}
      for (const [id, entry] of Object.entries(imageIndex.value)) {
        if (usedImages.has(id)) {
          existingImages[id] = entry
        } else {
          revokeImageUrl(id)
        }
      }

      const newImages = {}
      for (const [id, data] of Object.entries(pendingImages.value)) {
        if (usedImages.has(id)) {
          newImages[id] = data
        } else {
          revokeImageUrl(id)
        }
      }

      // 4. Get or create file handle
      const fh = _fileHandle
        || await dirHandle.value.getFileHandle(dbFilename.value, { create: true })

      // 5. Write FMDB container
      const { imageIndex: newIndex } = await writeFmdbFile(fh, {
        files: cleanFiles,
        existingImages,
        newImages,
        oldFile: _fileRef,
      })

      // 6. Refresh state
      const newFile = await fh.getFile()
      _fileRef = newFile
      _fileHandle = fh
      files.value = cleanFiles
      imageIndex.value = newIndex
      pendingImages.value = {}
      isDirty.value = false

      // 7. Delete legacy .pb.gz if this was a migration save
      if (_legacyFilename) {
        await deleteDbFile(dirHandle.value, _legacyFilename)
        await updateDbFilenameInHistory(folderName.value, dbFilename.value)
        _legacyFilename = null
      }
    } catch (e) {
      console.error('Failed to save:', e)
      throw e
    } finally {
      isSaving.value = false
    }
  }

  // ── Rename DB file ──────────────────────────────────────────

  /** Rename the database file on disk and update IDB history. */
  async function renameDbFile(newName) {
    if (!dirHandle.value) return
    const trimmed = newName.trim()
    if (!trimmed || !trimmed.endsWith('.fmdb')) {
      throw new Error('invalidName')
    }
    if (trimmed === dbFilename.value) return

    isSaving.value = true
    try {
      // Clean files + collect used images (same as save)
      const cleanFiles = {}
      for (const [key, val] of Object.entries(files.value)) {
        if (val?.markdownContent?.trim()) cleanFiles[key] = val
      }
      const usedImages = collectUsedImageIds(cleanFiles)

      const existingImages = {}
      for (const [id, entry] of Object.entries(imageIndex.value)) {
        if (usedImages.has(id)) existingImages[id] = entry
      }
      const newImages = {}
      for (const [id, data] of Object.entries(pendingImages.value)) {
        if (usedImages.has(id)) newImages[id] = data
      }

      // Write to new filename
      const newFh = await dirHandle.value.getFileHandle(trimmed, { create: true })
      const { imageIndex: newIndex } = await writeFmdbFile(newFh, {
        files: cleanFiles,
        existingImages,
        newImages,
        oldFile: _fileRef,
      })

      // Delete old file
      await deleteDbFile(dirHandle.value, dbFilename.value)
      if (_legacyFilename) {
        await deleteDbFile(dirHandle.value, _legacyFilename)
        _legacyFilename = null
      }

      // Refresh state
      const newFile = await newFh.getFile()
      _fileRef = newFile
      _fileHandle = newFh
      dbFilename.value = trimmed
      files.value = cleanFiles
      imageIndex.value = newIndex
      pendingImages.value = {}
      isDirty.value = false

      await updateDbFilenameInHistory(folderName.value, trimmed)
    } finally {
      isSaving.value = false
    }
  }

  // ── Orphan management ───────────────────────────────────────

  /** Move an orphaned annotation to a new file path. */
  function reassignOrphan(oldPath, newPath) {
    if (!files.value[oldPath]) return
    files.value[newPath] = { ...files.value[oldPath] }
    delete files.value[oldPath]
    isDirty.value = true
  }

  /** Remove an orphaned annotation entirely. */
  function deleteOrphan(path) {
    delete files.value[path]
    isDirty.value = true
  }

  // ── Dark mode ───────────────────────────────────────────────

  function toggleDarkMode() {
    darkMode.value = !darkMode.value
    document.documentElement.classList.toggle('dark', darkMode.value)
  }

  // Initialize
  document.documentElement.classList.toggle('dark', darkMode.value)
  loadRecentFolders()

  return {
    dirHandle,
    folderName,
    fileTree,
    selectedFile,
    files,
    imageIndex,
    pendingImages,
    isDirty,
    isLoading,
    isSaving,
    recentFolders,
    dbFilename,
    showOrphanManager,
    showDbSettings,
    darkMode,
    currentAnnotation,
    currentMarkdown,
    hasFolder,
    annotatedFiles,
    flatFileTree,
    orphanedFiles,
    open,
    reopenRecent,
    loadRecentFolders,
    removeRecent,
    selectFile,
    updateMarkdown,
    addImage,
    getImageUrl,
    save,
    renameDbFile,
    reassignOrphan,
    deleteOrphan,
    toggleDarkMode,
  }
})
