<script setup>
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspace.js'
import { useSettingsStore } from '@/stores/settings.js'

const { t, locale } = useI18n()
const workspace = useWorkspaceStore()
const settings  = useSettingsStore()

const languages = [
  { label: 'English', value: 'en' },
  { label: '中文',    value: 'zh' },
]

const autoSaveOptions = [
  { label: () => t('settings.autoSaveOff'), value: 0 },
  { label: () => '1s',  value: 1000  },
  { label: () => '3s',  value: 3000  },
  { label: () => '5s',  value: 5000  },
  { label: () => '10s', value: 10000 },
]

const imageQualityOptions = [
  { label: () => t('settings.imageQualityLow'),    value: 30 },
  { label: () => t('settings.imageQualityMedium'), value: 50 },
  { label: () => t('settings.imageQualityHigh'),   value: 70 },
  { label: () => t('settings.imageQualityBest'),   value: 90 },
]

const imageMaxDimOptions = [
  { label: () => '720px',                            value: 720  },
  { label: () => '1080px',                           value: 1080 },
  { label: () => '1440px',                           value: 1440 },
  { label: () => '1920px',                           value: 1920 },
  { label: () => t('settings.imageMaxDimOriginal'), value: 0    },
]

function close() {
  settings.showSettings = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-page">
      <div v-if="settings.showSettings" class="settings-page">

        <!-- ── Header ── -->
        <header class="settings-header">
          <button class="btn btn-ghost back-btn" @click="close">
            <i class="pi pi-arrow-left"></i>
            <span>{{ t('settings.back') }}</span>
          </button>
          <div class="settings-title">
            <i class="pi pi-cog"></i>
            <span>{{ t('settings.title') }}</span>
          </div>
        </header>

        <!-- ── Scrollable body ── -->
        <div class="settings-body">
          <div class="settings-content">

            <!-- ── Appearance ── -->
            <section class="settings-section">
              <h2 class="section-heading">{{ t('settings.appearance') }}</h2>

              <!-- Dark mode -->
              <div class="settings-row">
                <div class="row-label">
                  <span class="row-title">{{ t('settings.darkMode') }}</span>
                  <span class="row-desc">{{ t('settings.darkModeDesc') }}</span>
                </div>
                <button
                  class="toggle-switch"
                  :class="{ active: workspace.darkMode }"
                  @click="workspace.toggleDarkMode()"
                  role="switch"
                  :aria-checked="workspace.darkMode"
                >
                  <span class="toggle-thumb"></span>
                </button>
              </div>

              <!-- Language -->
              <div class="settings-row">
                <div class="row-label">
                  <span class="row-title">{{ t('settings.language') }}</span>
                  <span class="row-desc">{{ t('settings.languageDesc') }}</span>
                </div>
                <div class="radio-group">
                  <label
                    v-for="lang in languages"
                    :key="lang.value"
                    class="radio-chip"
                    :class="{ active: locale === lang.value }"
                  >
                    <input type="radio" :value="lang.value" v-model="locale" />
                    {{ lang.label }}
                  </label>
                </div>
              </div>
            </section>

            <!-- ── Editor ── -->
            <section class="settings-section">
              <h2 class="section-heading">{{ t('settings.editor') }}</h2>

              <!-- Auto-save delay -->
              <div class="settings-row settings-row--column">
                <div class="row-label">
                  <span class="row-title">{{ t('settings.autoSave') }}</span>
                  <span class="row-desc">{{ t('settings.autoSaveDesc') }}</span>
                </div>
                <div class="radio-group">
                  <label
                    v-for="opt in autoSaveOptions"
                    :key="opt.value"
                    class="radio-chip"
                    :class="{ active: settings.autoSaveDelay === opt.value }"
                  >
                    <input type="radio" :value="opt.value" v-model="settings.autoSaveDelay" />
                    {{ opt.label() }}
                  </label>
                </div>
              </div>
            </section>

            <!-- ── Image Processing ── -->
            <section class="settings-section">
              <h2 class="section-heading">{{ t('settings.images') }}</h2>

              <!-- Quality -->
              <div class="settings-row settings-row--column">
                <div class="row-label">
                  <span class="row-title">{{ t('settings.imageQuality') }}</span>
                  <span class="row-desc">{{ t('settings.imageQualityDesc') }}</span>
                </div>
                <div class="radio-group">
                  <label
                    v-for="opt in imageQualityOptions"
                    :key="opt.value"
                    class="radio-chip"
                    :class="{ active: settings.imageQuality === opt.value }"
                  >
                    <input type="radio" :value="opt.value" v-model="settings.imageQuality" />
                    {{ opt.label() }}
                  </label>
                </div>
              </div>

              <!-- Max dimension -->
              <div class="settings-row settings-row--column">
                <div class="row-label">
                  <span class="row-title">{{ t('settings.imageMaxDim') }}</span>
                  <span class="row-desc">{{ t('settings.imageMaxDimDesc') }}</span>
                </div>
                <div class="radio-group">
                  <label
                    v-for="opt in imageMaxDimOptions"
                    :key="opt.value"
                    class="radio-chip"
                    :class="{ active: settings.imageMaxDim === opt.value }"
                  >
                    <input type="radio" :value="opt.value" v-model="settings.imageMaxDim" />
                    {{ opt.label() }}
                  </label>
                </div>
              </div>
            </section>

          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────── */
.settings-page {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.settings-page-enter-active,
.settings-page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.settings-page-enter-from,
.settings-page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ── Header ──────────────────────────────────────────────────── */
.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 45px;
  padding: 0 14px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.back-btn {
  gap: 5px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 3px 8px;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-title .pi {
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ── Scrollable body ─────────────────────────────────────────── */
.settings-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 32px 16px 64px;
}

.settings-content {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Section ─────────────────────────────────────────────────── */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-heading {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--sidebar-border);
}

/* ── Row ─────────────────────────────────────────────────────── */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--sidebar-border);
}

.settings-row:last-child {
  border-bottom: none;
}

.settings-row--column {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-title {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--text-primary);
}

.row-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

/* ── Toggle switch ───────────────────────────────────────────── */
.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  background: var(--sidebar-border);
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(18px);
}

/* ── Radio chip group ────────────────────────────────────────── */
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.radio-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--sidebar-border);
  color: var(--text-secondary);
  background: transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  user-select: none;
  white-space: nowrap;
}

.radio-chip input {
  display: none;
}

.radio-chip:hover {
  background: rgba(55, 53, 47, 0.05);
  color: var(--text-primary);
}

.dark .radio-chip:hover {
  background: rgba(255, 255, 255, 0.05);
}

.radio-chip.active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent-text);
}

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
  transition: background 0.15s;
  white-space: nowrap;
  font-family: inherit;
  background: transparent;
}

.btn-ghost {
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: rgba(128, 128, 128, 0.1);
}
</style>
