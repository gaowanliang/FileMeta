<script setup>
const props = defineProps({
  node: Object,
  depth: Number,
  isSelected: Function,
  isAnnotated: Function,
  isExpanded: Function,
})

const emit = defineEmits(['select', 'toggle'])

function handleClick() {
  if (props.node.type === 'directory') {
    emit('toggle', props.node.key)
  } else {
    emit('select', props.node.key)
  }
}

function getExtension(name) {
  return name.split('.').pop()?.toLowerCase() || ''
}

const extColors = {
  pdf: '#ef4444',
  doc: '#3b82f6', docx: '#3b82f6',
  xls: '#22c55e', xlsx: '#22c55e',
  ppt: '#f97316', pptx: '#f97316',
  jpg: '#8b5cf6', jpeg: '#8b5cf6', png: '#8b5cf6', gif: '#8b5cf6', svg: '#8b5cf6', webp: '#8b5cf6',
  mp4: '#ec4899', mp3: '#ec4899',
  js: '#eab308', ts: '#3b82f6', vue: '#22c55e',
  html: '#f97316', css: '#8b5cf6',
  json: '#6b7280', md: '#6b7280', txt: '#6b7280',
  zip: '#a855f7', rar: '#a855f7',
}

function getExtColor(name) {
  return extColors[getExtension(name)] || '#94a3b8'
}
</script>

<template>
  <div class="tree-node">
    <div
      class="tree-item"
      :class="{
        'is-selected': node.type === 'file' && isSelected(node.key),
        'is-file': node.type === 'file',
      }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleClick"
    >
      <!-- Directory icon -->
      <template v-if="node.type === 'directory'">
        <i
          class="pi expand-icon"
          :class="isExpanded(node.key) ? 'pi-chevron-down' : 'pi-chevron-right'"
        ></i>
        <i
          class="pi folder-icon"
          :class="isExpanded(node.key) ? 'pi-folder-open' : 'pi-folder'"
        ></i>
      </template>

      <!-- File icon -->
      <template v-else>
        <span class="file-dot" :style="{ background: getExtColor(node.label) }"></span>
      </template>

      <span class="node-label" :title="node.key">{{ node.label }}</span>

      <!-- Annotation indicator -->
      <span
        v-if="node.type === 'file' && isAnnotated(node.key)"
        class="annotated-badge"
        title="Has annotations"
      >
        <i class="pi pi-bookmark-fill"></i>
      </span>
    </div>

    <!-- Children -->
    <div v-if="node.type === 'directory' && isExpanded(node.key) && node.children" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :is-selected="isSelected"
        :is-annotated="isAnnotated"
        :is-expanded="isExpanded"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'TreeNode',
}
</script>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-secondary);
  transition: background var(--transition-fast);
  user-select: none;
}

.tree-item:hover {
  background: rgba(55, 53, 47, 0.04);
  color: var(--text-primary);
}

.dark .tree-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tree-item.is-selected {
  background: rgba(55, 53, 47, 0.06);
  color: var(--text-primary);
  font-weight: 500;
}

.dark .tree-item.is-selected {
  background: rgba(255, 255, 255, 0.06);
}

.expand-icon {
  font-size: 0.55rem;
  color: var(--text-muted);
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}

.folder-icon {
  font-size: 0.82rem;
  color: #9b9a97;
  flex-shrink: 0;
}

.file-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 16px;
  opacity: 0.6;
}

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annotated-badge {
  color: var(--text-muted);
  font-size: 0.6rem;
  flex-shrink: 0;
}
</style>
