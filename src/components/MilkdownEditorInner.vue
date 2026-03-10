<template>
  <MilkdownProvider>
    <MilkdownCrepe
      :default-value="props.defaultValue"
      @update="(v) => emit('update', v)"
    />
  </MilkdownProvider>
</template>

<script setup>
import { MilkdownProvider } from '@milkdown/vue'
import MilkdownCrepe from './MilkdownCrepe.vue'

const props = defineProps({
  defaultValue: { type: String, default: '' },
})

const emit = defineEmits(['update'])
</script>
