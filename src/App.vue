<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace.js'
import AppHeader from '@/components/AppHeader.vue'
import FileTree from '@/components/FileTree.vue'
import AnnotationEditor from '@/components/AnnotationEditor.vue'
import OrphanManager from '@/components/OrphanManager.vue'
import SettingsPage from '@/components/SettingsPage.vue'

const store = useWorkspaceStore()

// Resizable sidebar
const sidebarWidth = ref(240)
const isResizing = ref(false)

function onResizeStart(e) {
  e.preventDefault()
  isResizing.value = true
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e) {
  const w = Math.min(Math.max(e.clientX, 160), 480)
  sidebarWidth.value = w
}

function onResizeEnd() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// Ctrl+S → save
function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (store.hasFolder && store.isDirty && !store.isSaving) {
      store.save()
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<template>
  <div class="app-layout" :class="{ 'is-resizing': isResizing }">
    <AppHeader />

    <div class="app-body">
      <aside
        v-if="store.hasFolder"
        class="sidebar"
        :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' }"
      >
        <FileTree />
      </aside>

      <div
        v-if="store.hasFolder"
        class="resize-handle"
        @mousedown="onResizeStart"
      ></div>

      <main class="main-content" :class="{ 'no-sidebar': !store.hasFolder }">
        <div v-if="store.selectedFile" class="file-tab-bar">
          <div class="file-tab active">
            <i class="pi pi-file-edit tab-icon"></i>
            <span class="tab-name">{{ store.selectedFile }}</span>
          </div>
        </div>

        <AnnotationEditor />
      </main>
    </div>

    <OrphanManager />
    <SettingsPage />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-layout.is-resizing {
  cursor: col-resize;
  user-select: none;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  margin-left: -2px;
  margin-right: -2px;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  transition: background var(--transition-fast);
}

.resize-handle:hover::after,
.is-resizing .resize-handle::after {
  background: var(--accent);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-bg);
}

.main-content.no-sidebar {
  background: var(--app-bg);
}

.file-tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-size: 0.78rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  max-width: 300px;
}

.file-tab.active {
  color: var(--text-primary);
  font-weight: 500;
}

.tab-icon {
  font-size: 0.7rem;
  flex-shrink: 0;
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
