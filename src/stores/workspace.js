import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  openDirectory, readFileTree, readDbFile, writeDbFile,
  saveToHistory, getHistory, removeFromHistory, reopenFromHistory,
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
  const darkMode = ref(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )

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

  // Load a directory handle (shared by open + reopenRecent)
  async function loadHandle(handle) {
    dirHandle.value = handle
    folderName.value = handle.name
    selectedFile.value = null
    files.value = {}
    images.value = {}

    const tree = await readFileTree(handle)
    fileTree.value = tree

    const dbData = await readDbFile(handle)
    if (dbData) {
      const decoded = await decompressAndDecode(dbData)
      files.value = decoded.files || {}
      images.value = decoded.images || {}
    }

    isDirty.value = false

    // Persist to history
    await saveToHistory(handle)
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
      await writeDbFile(dirHandle.value, compressed)

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
    darkMode,
    currentAnnotation,
    currentMarkdown,
    hasFolder,
    annotatedFiles,
    open,
    reopenRecent,
    loadRecentFolders,
    removeRecent,
    selectFile,
    updateMarkdown,
    addImage,
    save,
    toggleDarkMode,
  }
})
