import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'file-meta-settings'

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSaved()

  // Editor
  const autoSaveDelay = ref(saved.autoSaveDelay ?? 3000) // ms; 0 = disabled

  // Image processing
  const imageQuality = ref(saved.imageQuality ?? 50)     // AVIF quality 0-100
  const imageMaxDim  = ref(saved.imageMaxDim  ?? 1920)   // px; 0 = no resize

  // UI
  const showSettings = ref(false)

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      autoSaveDelay: autoSaveDelay.value,
      imageQuality:  imageQuality.value,
      imageMaxDim:   imageMaxDim.value,
    }))
  }

  watch([autoSaveDelay, imageQuality, imageMaxDim], persist)

  return { autoSaveDelay, imageQuality, imageMaxDim, showSettings }
})
