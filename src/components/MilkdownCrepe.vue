<template>
  <Milkdown />
</template>

<script>
import { defineComponent } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { Milkdown, useEditor } from '@milkdown/vue'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

export default defineComponent({
  name: 'MilkdownCrepe',
  components: { Milkdown },
  props: {
    defaultValue: { type: String, default: '' },
  },
  emits: ['update'],
  setup(props, { emit }) {
    useEditor((root) => {
      const crepe = new Crepe({
        root,
        defaultValue: props.defaultValue,
        features: {
          [Crepe.Feature.Latex]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: 'Start writing annotations...',
          },
        },
      })

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            emit('update', markdown)
          }
        })
      })

      return crepe
    })
  },
})
</script>

<style>
/* ── Light mode: warm Notion palette ── */
.milkdown {
  --crepe-color-background: #ffffff;
  --crepe-color-on-background: #37352f;
  --crepe-color-surface: #f7f6f3;
  --crepe-color-surface-low: #f1f0ed;
  --crepe-color-on-surface: #37352f;
  --crepe-color-on-surface-variant: #787774;
  --crepe-color-outline: rgba(55, 53, 47, 0.16);
  --crepe-color-primary: #2383e2;
  --crepe-color-secondary: rgba(35, 131, 226, 0.07);
  --crepe-color-on-secondary: #2383e2;
  --crepe-color-inverse: #37352f;
  --crepe-color-on-inverse: #ffffff;
  --crepe-color-inline-code: #eb5757;
  --crepe-color-error: #eb5757;
  --crepe-color-hover: rgba(55, 53, 47, 0.04);
  --crepe-color-selected: rgba(35, 131, 226, 0.08);
  --crepe-color-inline-area: rgba(55, 53, 47, 0.04);

  --crepe-font-title: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --crepe-font-default: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --crepe-font-code: 'SFMono-Regular', Menlo, Consolas, 'PT Mono', 'Liberation Mono', Courier, monospace;

  --crepe-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.04);
  --crepe-shadow-2: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ── Dark mode: warm dark Notion palette ── */
.dark .milkdown {
  --crepe-color-background: #191919;
  --crepe-color-on-background: rgba(255, 255, 255, 0.81);
  --crepe-color-surface: #202020;
  --crepe-color-surface-low: #2f2f2f;
  --crepe-color-on-surface: rgba(255, 255, 255, 0.81);
  --crepe-color-on-surface-variant: rgba(255, 255, 255, 0.45);
  --crepe-color-outline: rgba(255, 255, 255, 0.1);
  --crepe-color-primary: #529cca;
  --crepe-color-secondary: rgba(35, 131, 226, 0.1);
  --crepe-color-on-secondary: #529cca;
  --crepe-color-inverse: rgba(255, 255, 255, 0.81);
  --crepe-color-on-inverse: #191919;
  --crepe-color-inline-code: #eb5757;
  --crepe-color-error: #eb5757;
  --crepe-color-hover: rgba(255, 255, 255, 0.04);
  --crepe-color-selected: rgba(35, 131, 226, 0.15);
  --crepe-color-inline-area: rgba(255, 255, 255, 0.04);

  --crepe-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.3);
  --crepe-shadow-2: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* ── Layout ── */
.milkdown-editor-wrapper .milkdown {
  height: 100%;
}

.milkdown .ProseMirror {
  min-height: 300px;
  padding: 2rem 2.5rem;
  outline: none;
  line-height: 1.7;
}

.milkdown .ProseMirror img {
  max-width: 100%;
  border-radius: 4px;
}
</style>
