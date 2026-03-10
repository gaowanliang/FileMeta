<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspace.js'

const { t, locale } = useI18n()
const store = useWorkspaceStore()

const languages = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

// Recent folders panel
const showRecent = ref(false)
const recentPanelRef = ref(null)
const openGroupRef = ref(null)

// Language dropdown
const langOpen = ref(false)
const langRef = ref(null)

function toggleRecent() {
  showRecent.value = !showRecent.value
}

function toggleLang() {
  langOpen.value = !langOpen.value
}

function switchLanguage(value) {
  locale.value = value
  langOpen.value = false
}

async function handleOpen() {
  try {
    await store.open()
  } catch (e) {
    console.error(e)
  }
}

async function handleSave() {
  try {
    await store.save()
  } catch (e) {
    console.error(e)
  }
}

async function handleReopenRecent(entry) {
  showRecent.value = false
  try {
    await store.reopenRecent(entry)
  } catch (e) {
    console.error(e)
  }
}

async function handleRemoveRecent(event, name) {
  event.stopPropagation()
  await store.removeRecent(name)
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Click-outside handler
function onClickOutside(event) {
  if (recentPanelRef.value && openGroupRef.value &&
      !recentPanelRef.value.contains(event.target) &&
      !openGroupRef.value.contains(event.target)) {
    showRecent.value = false
  }
  if (langRef.value && !langRef.value.contains(event.target)) {
    langOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside, true))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside, true))
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <i class="pi pi-tags logo-icon"></i>
        <span class="logo-text">{{ t('app.title') }}</span>
      </div>

      <div class="open-group" ref="openGroupRef">
        <button
          class="btn btn-ghost"
          @click="handleOpen"
          :disabled="store.isLoading"
        >
          <i v-if="store.isLoading" class="pi pi-spin pi-spinner"></i>
          <i v-else class="pi pi-folder-open"></i>
          <span>{{ t('app.openFolder') }}</span>
        </button>
        <button
          v-if="store.recentFolders.length > 0"
          class="btn btn-ghost btn-icon-only"
          @click.stop="toggleRecent"
          :title="t('app.recentFolders')"
        >
          <i class="pi pi-chevron-down" :class="{ 'chevron-open': showRecent }"></i>
        </button>

        <Transition name="slide-fade">
          <div v-if="showRecent" ref="recentPanelRef" class="recent-panel">
            <div class="recent-header">
              <i class="pi pi-history"></i>
              <span>{{ t('app.recentFolders') }}</span>
            </div>
            <div class="recent-list" v-if="store.recentFolders.length > 0">
              <div
                v-for="entry in store.recentFolders"
                :key="entry.name"
                class="recent-item"
                :class="{ active: store.folderName === entry.name }"
                @click="handleReopenRecent(entry)"
              >
                <i class="pi pi-folder recent-item-icon"></i>
                <div class="recent-item-info">
                  <span class="recent-item-name">{{ entry.name }}</span>
                  <span class="recent-item-time">{{ formatTime(entry.openedAt) }}</span>
                </div>
                <button
                  class="recent-item-remove"
                  @click="handleRemoveRecent($event, entry.name)"
                  :title="t('app.removeRecent')"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>
            <div v-else class="recent-empty">
              <span>{{ t('app.noRecent') }}</span>
            </div>
          </div>
        </Transition>
      </div>

      <div v-if="store.folderName" class="folder-badge">
        <i class="pi pi-folder"></i>
        <span>{{ store.folderName }}</span>
      </div>
    </div>

    <div class="header-right">
      <!-- Status -->
      <div v-if="store.hasFolder" class="status-badge" :class="{ saving: store.isSaving, dirty: store.isDirty }">
        <i class="pi" :class="store.isSaving ? 'pi-spin pi-spinner' : store.isDirty ? 'pi-circle-fill' : 'pi-check-circle'"></i>
        <span>{{ store.isSaving ? t('app.saving') : store.isDirty ? t('status.modified') : t('app.saved') }}</span>
      </div>

      <!-- Save -->
      <button
        v-if="store.hasFolder"
        class="btn btn-secondary"
        :disabled="!store.isDirty || store.isSaving"
        @click="handleSave"
      >
        <i v-if="store.isSaving" class="pi pi-spin pi-spinner"></i>
        <i v-else class="pi pi-save"></i>
        <span>{{ t('app.save') }}</span>
      </button>

      <!-- Language -->
      <div class="custom-select" ref="langRef">
        <button class="select-trigger" @click.stop="toggleLang">
          <span>{{ languages.find(l => l.value === locale)?.label }}</span>
          <i class="pi pi-chevron-down select-chevron" :class="{ open: langOpen }"></i>
        </button>
        <Transition name="slide-fade">
          <div v-if="langOpen" class="select-dropdown">
            <div
              v-for="lang in languages"
              :key="lang.value"
              class="select-option"
              :class="{ active: locale === lang.value }"
              @click="switchLanguage(lang.value)"
            >
              {{ lang.label }}
            </div>
          </div>
        </Transition>
      </div>

      <!-- Dark mode -->
      <button
        class="btn btn-ghost btn-icon-only"
        @click="store.toggleDarkMode"
        :title="store.darkMode ? t('app.lightMode') : t('app.darkMode')"
      >
        <i class="pi" :class="store.darkMode ? 'pi-sun' : 'pi-moon'"></i>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 45px;
  padding: 0 14px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--sidebar-border);
  gap: 12px;
  flex-shrink: 0;
  z-index: 100;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
}

.logo-icon {
  font-size: 1rem;
  color: var(--text-primary);
}

.logo-text {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.open-group {
  display: flex;
  align-items: center;
  gap: 2px;
  position: relative;
}

.chevron-open {
  transform: rotate(180deg);
}

.folder-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.folder-badge i {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Recent panel */
.recent-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--header-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  overflow: hidden;
  min-width: 260px;
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 1px solid var(--sidebar-border);
}

.recent-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background var(--transition-fast);
  border-radius: var(--radius-sm);
}

.recent-item:hover {
  background: rgba(55, 53, 47, 0.04);
}

.dark .recent-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.recent-item.active {
  background: rgba(55, 53, 47, 0.06);
}

.dark .recent-item.active {
  background: rgba(255, 255, 255, 0.06);
}

.recent-item-icon {
  color: var(--text-muted);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.recent-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.recent-item-name {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-item-time {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.recent-item-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  opacity: 0;
  transition: opacity var(--transition-fast);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.recent-item-remove i {
  font-size: 0.6rem;
}

.recent-item:hover .recent-item-remove {
  opacity: 1;
}

.recent-item-remove:hover {
  color: #eb5757;
  background: rgba(235, 87, 87, 0.08);
}

.recent-empty {
  padding: 16px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.78rem;
  min-width: 200px;
}

/* Status */
.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: #2ea043;
  padding: 2px 8px;
  transition: color var(--transition-fast);
}

.status-badge.dirty {
  color: #d29922;
}

.status-badge.saving {
  color: var(--accent);
}

.status-badge i {
  font-size: 0.45rem;
}
</style>
