<script setup>
import { watch, onBeforeUnmount, ref, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace.js'
import { useSettingsStore } from '@/stores/settings.js'
import { compressImage, createImageUrl } from '@/services/image.js'

import MilkdownEditorInner from './MilkdownEditorInner.vue'

const store = useWorkspaceStore()
const settings = useSettingsStore()

// Use key to force re-create editor when file changes or content is externally updated
const editorRevision = ref(0)
const editorKey = computed(() => `${store.selectedFile || '__none__'}__${editorRevision.value}`)
const isProcessingImage = ref(false)

// Debounce save
let saveTimer = null
function debounceSave() {
  if (settings.autoSaveDelay === 0) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (store.isDirty && store.hasFolder) {
      store.save().catch(console.error)
    }
  }, settings.autoSaveDelay)
}

function onMarkdownUpdate(markdown) {
  if (store.selectedFile) {
    store.updateMarkdown(store.selectedFile, markdown)
    debounceSave()
  }
}

// Handle paste for images
function handlePaste(event) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      processImage(item.getAsFile())
      return
    }
  }
}

// Handle drag-and-drop images
function handleDrop(event) {
  const files = event.dataTransfer?.files
  if (!files) return

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      event.preventDefault()
      processImage(file)
      return
    }
  }
}

async function processImage(file) {
  if (!file || !store.selectedFile) return
  isProcessingImage.value = true
  try {
    const { imageId, data } = await compressImage(file, {
      quality: settings.imageQuality,
      maxDim: settings.imageMaxDim,
    })
    store.addImage(imageId, data)

    const imageMarkdown = `![image](local-avif://${imageId})`
    const currentContent = store.currentMarkdown || ''
    store.updateMarkdown(store.selectedFile, currentContent + '\n' + imageMarkdown + '\n')
    editorRevision.value++
    debounceSave()
  } catch (err) {
    console.error('Image processing failed:', err)
  } finally {
    isProcessingImage.value = false
  }
}

// Resolve local-avif:// URLs in the editor DOM
function resolveImageUrls(element) {
  if (!element) return
  const imgs = element.querySelectorAll('img')
  for (const img of imgs) {
    const src = img.getAttribute('src') || ''
    const match = src.match(/^local-avif:\/\/(.+)$/)
    if (match) {
      const imageId = match[1]
      const data = store.images[imageId]
      if (data) {
        img.src = createImageUrl(imageId, data)
      }
    }
  }
}

// MutationObserver on the editor wrapper
const wrapperRef = ref(null)
let observer = null

function setupObserver() {
  if (observer) observer.disconnect()
  const el = wrapperRef.value
  if (el) {
    observer = new MutationObserver(() => resolveImageUrls(el))
    observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  }
}

watch(wrapperRef, setupObserver)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  clearTimeout(saveTimer)
})
</script>

<template>
  <div class="editor-panel">
    <div
      v-if="store.selectedFile"
      ref="wrapperRef"
      class="milkdown-editor-wrapper"
      @paste="handlePaste"
      @drop.prevent="handleDrop"
      @dragover.prevent
    >
      <MilkdownEditorInner
        :key="editorKey"
        :default-value="store.currentMarkdown"
        @update="onMarkdownUpdate"
      />

      <Transition name="fade">
        <div v-if="isProcessingImage" class="image-processing-overlay">
          <div class="processing-card">
            <div class="processing-spinner"></div>
            <span class="processing-text">{{ $t('editor.imageUploading') }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <div v-else class="empty-editor">
      <div class="empty-content">
        <div class="empty-icon-wrapper">
          <i class="pi pi-file-edit empty-icon"></i>
        </div>
        <h3>{{ store.hasFolder ? $t('editor.selectFile') : $t('editor.noFolder') }}</h3>
        <p v-if="!store.hasFolder">{{ $t('editor.noFolderDesc') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.milkdown-editor-wrapper {
  flex: 1;
  overflow-y: auto;
  background: var(--editor-bg);
  position: relative;
}

/* Image processing overlay */
.image-processing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dark .image-processing-overlay {
  background: rgba(25, 25, 25, 0.7);
}

.processing-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: var(--header-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.processing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sidebar-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.processing-text {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-secondary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.empty-editor {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  text-align: center;
  max-width: 320px;
  padding: 2rem;
}

.empty-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(55, 53, 47, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.dark .empty-icon-wrapper {
  background: rgba(255, 255, 255, 0.04);
}

.empty-icon {
  font-size: 1.4rem;
  color: var(--text-muted);
}

.empty-content h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 0.4rem;
}

.empty-content p {
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
  margin: 0;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
