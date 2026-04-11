<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeHtml } from '../utils/htmlSanitize'
import { renderMarkdown } from '../utils/markdownRender'

const props = withDefaults(
  defineProps<{
    source?: string
  }>(),
  {
    source: '',
  },
)

const renderedHtml = computed(() => sanitizeHtml(renderMarkdown(props.source)))
</script>

<template>
  <div class="vuepyter-markdown" v-html="renderedHtml" />
</template>

<style scoped>
.vuepyter-markdown {
  color: var(--vuepyter-text);
  line-height: 1.5;
}

.vuepyter-markdown :deep(a) {
  color: #2563eb;
}

.vuepyter-markdown :deep(code) {
  font-family: var(--vuepyter-font-mono);
  background: rgba(148, 163, 184, 0.2);
  border-radius: 0.25rem;
  padding: 0 0.25rem;
}

.vuepyter-markdown :deep(pre) {
  overflow-x: auto;
  padding: 0.5rem;
  border-radius: 0.35rem;
  background: var(--vuepyter-output-bg);
}
</style>
