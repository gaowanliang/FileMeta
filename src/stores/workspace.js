import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  openDirectory, readFileTree, readDbFile, writeDbFile, deleteDbFile,
  saveToHistory, getHistory, getHistoryEntry, removeFromHistory, reopenFromHistory,
  findPbGzFile, updateDbFilenameInHistory, DEFAULT_DB_FILENAME,
} from '@/services/filesystem.js'
import { encodeAndCompress, decompressAndDecode } from '@/services/protobuf.js'
import { revokeAllImageUrls } from '@/services/image.js'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const dirHandle = ref(null)
  const folderName = ref('')
  const fileTree = ref([])
  const selectedFile = ref(null)
  const files = ref({})       // Map<string, { markdownContent, updatedAt }>
  const images = ref({})      // Map<string, Uint8Array>
  const isDirty = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const recentFolders = ref([])  // { name, handle, openedAt }[]
  const dbFilename = ref(DEFAULT_DB_FILENAME)
  const darkMode = ref(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )
  // UI modal state
  const showOrphanManager = ref(false)
  const showDbSettings = ref(false)

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

  // Load a directory handle (shared by open + reopenRecent)
  async function loadHandle(handle) {
    dirHandle.value = handle
    folderName.value = handle.name
    selectedFile.value = null
    files.value = {}
    images.value = {}
    dbFilename.value = DEFAULT_DB_FILENAME

    // Determine the db filename: prefer stored history entry, else auto-detect
    const histEntry = await getHistoryEntry(handle.name)
    if (histEntry?.dbFilename) {
      dbFilename.value = histEntry.dbFilename
    } else {
      const detected = await findPbGzFile(handle)
      if (detected) dbFilename.value = detected
    }

    // Exclude the db file from the visible tree if it doesn't start with '.'
    const excludeSet = dbFilename.value.startsWith('.')
      ? new Set()
      : new Set([dbFilename.value])
    const tree = await readFileTree(handle, '', excludeSet)
    fileTree.value = tree

    const dbData = await readDbFile(handle, dbFilename.value)
    if (dbData) {
      const decoded = await decompressAndDecode(dbData)
      files.value = decoded.files || {}
      images.value = decoded.images || {}
    }

    isDirty.value = false

    // Persist to history (always include current dbFilename)
    await saveToHistory(handle, dbFilename.value)
    await loadRecentFolders()
  }

  // Actions
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
    images.value[imageId] = data
    isDirty.value = true
  }

  async function save() {
    if (!dirHandle.value || isSaving.value) return
    isSaving.value = true
    try {
      // Clean up empty annotations
      const cleanFiles = {}
      for (const [key, val] of Object.entries(files.value)) {
        if (val?.markdownContent?.trim()) {
          cleanFiles[key] = val
        }
      }

      // Collect used image IDs from all markdown content
      const usedImages = new Set()
      const imgRegex = /local-avif:\/\/([a-f0-9-]+)/g
      for (const val of Object.values(cleanFiles)) {
        let match
        while ((match = imgRegex.exec(val.markdownContent)) !== null) {
          usedImages.add(match[1])
        }
      }

      // Only keep referenced images
      const cleanImages = {}
      for (const [id, data] of Object.entries(images.value)) {
        if (usedImages.has(id)) {
          cleanImages[id] = data
        }
      }

      const dbData = { files: cleanFiles, images: cleanImages }
      const compressed = await encodeAndCompress(dbData)
      await writeDbFile(dirHandle.value, compressed, dbFilename.value)

      files.value = cleanFiles
      images.value = cleanImages
      isDirty.value = false
    } catch (e) {
      console.error('Failed to save:', e)
      throw e
    } finally {
      isSaving.value = false
    }
  }

  /** Rename the database file on disk and update IDB history. */
  async function renameDbFile(newName) {
    if (!dirHandle.value) return
    const trimmed = newName.trim()
    if (!trimmed || !trimmed.endsWith('.pb.gz')) {
      throw new Error('invalidName')
    }
    if (trimmed === dbFilename.value) return

    // Save current contents under the new filename
    isSaving.value = true
    try {
      const cleanFiles = {}
      for (const [key, val] of Object.entries(files.value)) {
        if (val?.markdownContent?.trim()) cleanFiles[key] = val
      }
      const usedImages = new Set()
      const imgRegex = /local-avif:\/\/([a-f0-9-]+)/g
      for (const val of Object.values(cleanFiles)) {
        let match
        while ((match = imgRegex.exec(val.markdownContent)) !== null) usedImages.add(match[1])
      }
      const cleanImages = {}
      for (const [id, data] of Object.entries(images.value)) {
        if (usedImages.has(id)) cleanImages[id] = data
      }

      const compressed = await encodeAndCompress({ files: cleanFiles, images: cleanImages })
      await writeDbFile(dirHandle.value, compressed, trimmed)
      await deleteDbFile(dirHandle.value, dbFilename.value)

      dbFilename.value = trimmed
      files.value = cleanFiles
      images.value = cleanImages
      isDirty.value = false

      await updateDbFilenameInHistory(folderName.value, trimmed)
    } finally {
      isSaving.value = false
    }
  }

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
    images,
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
    save,
    renameDbFile,
    reassignOrphan,
    deleteOrphan,
    toggleDarkMode,
  }
})
