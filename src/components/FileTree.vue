<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspace.js'

const { t } = useI18n()
const store = useWorkspaceStore()
const searchQuery = ref('')
const expandedKeys = ref({})

function filterTree(nodes, query) {
  if (!query) return nodes
  const lq = query.toLowerCase()
  return nodes.reduce((acc, node) => {
    if (node.type === 'directory') {
      const filtered = filterTree(node.children || [], query)
      if (filtered.length > 0) {
        acc.push({ ...node, children: filtered })
      }
    } else if (node.label.toLowerCase().includes(lq)) {
      acc.push(node)
    }
    return acc
  }, [])
}

const filteredTree = computed(() => filterTree(store.fileTree, searchQuery.value))

function onSelect(path) {
  store.selectFile(path)
}

function isSelected(path) {
  return store.selectedFile === path
}

function isAnnotated(path) {
  return store.annotatedFiles.has(path)
}

function toggleExpand(key) {
  if (expandedKeys.value[key]) {
    delete expandedKeys.value[key]
  } else {
    expandedKeys.value[key] = true
  }
}

function isExpanded(key) {
  return !!expandedKeys.value[key]
}

// Auto-expand all on first load
watch(() => store.fileTree, (tree) => {
  if (tree.length > 0 && Object.keys(expandedKeys.value).length === 0) {
    const expand = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'directory') {
          expandedKeys.value[n.key] = true
          if (n.children) expand(n.children)
        }
      }
    }
    expand(tree)
  }
}, { immediate: true })
</script>

<template>
  <div class="file-tree-root">
    <div class="search-box">
      <div class="relative">
        <i class="pi pi-search search-icon"></i>
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="t('sidebar.searchPlaceholder')"
          class="search-input"
        />
      </div>
    </div>

    <div class="tree-container">
      <template v-if="filteredTree.length === 0">
        <div class="empty-state">
          <i class="pi pi-inbox empty-icon"></i>
          <span>{{ t('sidebar.noFiles') }}</span>
        </div>
      </template>

      <div v-else class="tree-list">
        <TreeNode
          v-for="node in filteredTree"
          :key="node.key"
          :node="node"
          :depth="0"
          :is-selected="isSelected"
          :is-annotated="isAnnotated"
          :is-expanded="isExpanded"
          @select="onSelect"
          @toggle="toggleExpand"
        />
      </div>
    </div>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue'

export default {
  components: { TreeNode },
}
</script>

<style scoped>
.file-tree-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-box {
  padding: 8px 10px 6px;
}

.search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 0.75rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 5px 10px 5px 28px;
  font-size: 0.78rem;
  font-family: inherit;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid var(--sidebar-border);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 2px 6px 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem;
  color: var(--text-muted);
  gap: 6px;
}

.empty-icon {
  font-size: 1.5rem;
}
</style>
