<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspace.js'
import { useSettingsStore } from '@/stores/settings.js'
import { compressImage, createImageUrl } from '@/services/image.js'
import MilkdownEditorInner from './MilkdownEditorInner.vue'

const { t } = useI18n()
const store = useWorkspaceStore()
const settings = useSettingsStore()

// ── Orphan list ───────────────────────────────────────────────
const selectedOrphan = ref(null)

// Auto-select first orphan when opening or list changes
watch(
  () => store.orphanedFiles,
  (paths) => {
    if (!paths.includes(selectedOrphan.value)) {
      selectedOrphan.value = paths[0] ?? null
    }
  },
  { immediate: true },
)

// ── Reassign ──────────────────────────────────────────────────
const allFiles = computed(() => {
  const result = []
  function flatten(nodes) {
    for (const node of nodes) {
      if (node.type === 'file') result.push(node.key)
      if (node.children) flatten(node.children)
    }
  }
  flatten(store.fileTree)
  return result.sort()
})

const reassignTarget = ref('')

watch(selectedOrphan, () => { reassignTarget.value = '' })

function targetHasAnnotation(path) {
  return !!path && !!store.files[path]?.markdownContent?.trim()
}

function handleReassign() {
  if (!selectedOrphan.value || !reassignTarget.value) return
  store.reassignOrphan(selectedOrphan.value, reassignTarget.value)
}

function handleDelete() {
  if (!selectedOrphan.value) return
  store.deleteOrphan(selectedOrphan.value)
}

// ── Editor key (force remount on orphan switch) ───────────────
const editorRevision = ref(0)
const editorKey = computed(
  () => `orphan__${selectedOrphan.value ?? '__none__'}__${editorRevision.value}`
)

const currentMarkdown = computed(
  () => store.files[selectedOrphan.value]?.markdownContent ?? ''
)

function onMarkdownUpdate(markdown) {
  if (selectedOrphan.value) {
    store.updateMarkdown(selectedOrphan.value, markdown)
  }
}

// ── Image paste / drop ────────────────────────────────────────
const isProcessingImage = ref(false)

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
  if (!file || !selectedOrphan.value) return
  isProcessingImage.value = true
  try {
    const { imageId, data } = await compressImage(file, {
      quality: settings.imageQuality,
      maxDim: settings.imageMaxDim,
    })
    store.addImage(imageId, data)
    const current = store.files[selectedOrphan.value]?.markdownContent ?? ''
    store.updateMarkdown(selectedOrphan.value, current + '\n' + `![image](local-avif://${imageId})` + '\n')
    editorRevision.value++
  } catch (err) {
    console.error('Image processing failed:', err)
  } finally {
    isProcessingImage.value = false
  }
}

// ── local-avif:// resolver ────────────────────────────────────
const wrapperRef = ref(null)
let observer = null

function resolveImageUrls(el) {
  if (!el) return
  for (const img of el.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    const match = src.match(/^local-avif:\/\/(.+)$/)
    if (match) {
      const data = store.images[match[1]]
      if (data) img.src = createImageUrl(match[1], data)
    }
  }
}

function setupObserver() {
  if (observer) observer.disconnect()
  if (wrapperRef.value) {
    observer = new MutationObserver(() => resolveImageUrls(wrapperRef.value))
    observer.observe(wrapperRef.value, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['src'],
    })
  }
}

watch(wrapperRef, setupObserver)
onBeforeUnmount(() => { if (observer) observer.disconnect() })

// ── Close ─────────────────────────────────────────────────────
function close() {
  store.showOrphanManager = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="orphan-page">
      <div v-if="store.showOrphanManager" class="orphan-page">

        <!-- ── Top bar ── -->
        <header class="orphan-header">
          <div class="orphan-header-left">
            <button class="btn btn-ghost back-btn" @click="close">
              <i class="pi pi-arrow-left"></i>
              <span>{{ t('orphan.back') }}</span>
            </button>
            <div class="orphan-header-title">
              <i class="pi pi-exclamation-triangle title-warn-icon"></i>
              <span>{{ t('orphan.title') }}</span>
              <span class="orphan-count-badge">{{ store.orphanedFiles.length }}</span>
            </div>
          </div>

          <!-- Reassign / Delete toolbar (shown when an orphan is selected) -->
          <div v-if="selectedOrphan" class="orphan-header-right">
            <div class="reassign-row">
              <select v-model="reassignTarget" class="file-select">
                <option value="">{{ t('orphan.selectTarget') }}</option>
                <option v-for="fp in allFiles" :key="fp" :value="fp">{{ fp }}</option>
              </select>
              <div v-if="targetHasAnnotation(reassignTarget)" class="overwrite-tip">
                <i class="pi pi-info-circle"></i>
                {{ t('orphan.targetHasAnnotation') }}
              </div>
              <button
                class="btn btn-primary"
                :disabled="!reassignTarget"
                @click="handleReassign"
              >
                <i class="pi pi-arrow-right-arrow-left"></i>
                {{ t('orphan.reassign') }}
              </button>
            </div>
            <button class="btn btn-danger" @click="handleDelete">
              <i class="pi pi-trash"></i>
              {{ t('orphan.delete') }}
            </button>
          </div>
        </header>

        <!-- ── Body ── -->
        <div class="orphan-body">

          <!-- Left: orphan list -->
          <aside class="orphan-list-panel">
            <div class="orphan-list-header">
              <span>{{ t('orphan.description') }}</span>
            </div>
            <div class="orphan-list">
              <div
                v-for="path in store.orphanedFiles"
                :key="path"
                class="orphan-list-item"
                :class="{ active: selectedOrphan === path }"
                @click="selectedOrphan = path"
              >
                <i class="pi pi-file-edit orphan-item-icon"></i>
                <span class="orphan-item-path">{{ path }}</span>
              </div>
              <div v-if="store.orphanedFiles.length === 0" class="orphan-list-empty">
                <i class="pi pi-check-circle"></i>
                <span>All clear!</span>
              </div>
            </div>
          </aside>

          <!-- Right: editor -->
          <main class="orphan-editor-panel">
            <!-- File tab bar -->
            <div v-if="selectedOrphan" class="orphan-tab-bar">
              <div class="orphan-tab">
                <i class="pi pi-file-edit tab-icon"></i>
                <span class="tab-path">{{ selectedOrphan }}</span>
                <span class="tab-badge">{{ t('orphan.tabBadge') }}</span>
              </div>
            </div>

            <!-- Editor wrapper -->
            <div
              v-if="selectedOrphan"
              ref="wrapperRef"
              class="orphan-milkdown-wrapper"
              @paste="handlePaste"
              @drop.prevent="handleDrop"
              @dragover.prevent
            >
              <MilkdownEditorInner
                :key="editorKey"
                :default-value="currentMarkdown"
                @update="onMarkdownUpdate"
              />

              <Transition name="fade">
                <div v-if="isProcessingImage" class="image-overlay">
                  <div class="processing-card">
                    <div class="processing-spinner"></div>
                    <span>{{ t('editor.imageUploading') }}</span>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Empty state -->
            <div v-else class="orphan-empty-editor">
              <i class="pi pi-check-circle empty-ok-icon"></i>
              <p>{{ t('orphan.noneSelected') }}</p>
            </div>
          </main>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────── */
.orphan-page {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.orphan-page-enter-active,
.orphan-page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.orphan-page-enter-from,
.orphan-page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ── Header ──────────────────────────────────────────────────── */
.orphan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 45px;
  padding: 0 14px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.orphan-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.back-btn {
  gap: 5px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 3px 8px;
  flex-shrink: 0;
}

.orphan-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.title-warn-icon {
  color: #f59e0b;
  font-size: 0.85rem;
}

.orphan-count-badge {
  background: #f59e0b;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.orphan-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.reassign-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-select {
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--sidebar-border);
  background: var(--editor-bg);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  max-width: 300px;
  min-width: 180px;
}

.file-select:focus {
  outline: none;
  border-color: var(--accent);
}

.overwrite-tip {
  font-size: 11px;
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

/* ── Body ────────────────────────────────────────────────────── */
.orphan-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Left panel ──────────────────────────────────────────────── */
.orphan-list-panel {
  width: 240px;
  min-width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--sidebar-border);
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.orphan-list-header {
  padding: 10px 12px 8px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.orphan-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.orphan-list-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s;
}

.orphan-list-item:hover {
  background: rgba(55, 53, 47, 0.04);
}

.dark .orphan-list-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.orphan-list-item.active {
  background: var(--accent-light);
}

.orphan-item-icon {
  font-size: 13px;
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
}

.orphan-item-path {
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
  color: var(--text-primary);
}

.orphan-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.orphan-list-empty .pi {
  font-size: 24px;
  color: #22c55e;
}

/* ── Right editor panel ──────────────────────────────────────── */
.orphan-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-bg);
}

.orphan-tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.orphan-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tab-icon {
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tab-path {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-badge {
  font-size: 10px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
}

.orphan-milkdown-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.orphan-empty-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-ok-icon {
  font-size: 36px;
  color: #22c55e;
}

/* ── Image overlay ───────────────────────────────────────────── */
.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dark .image-overlay {
  background: rgba(25, 25, 25, 0.7);
}

.processing-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: var(--header-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.processing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sidebar-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Shared button styles ────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  height: 28px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
  font-family: inherit;
}

.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover { background: rgba(128, 128, 128, 0.1); }

.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.btn-danger:hover { background: rgba(239, 68, 68, 0.2); }

/* ── Fade ────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

