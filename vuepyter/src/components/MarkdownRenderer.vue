<script setup lang="ts">
import { computed } from 'vue'
import 'katex/dist/katex.min.css'
import { renderMarkdownToHtml } from '../utils/markdownRender'

const props = withDefaults(
  defineProps<{
    source?: string
  }>(),
  {
    source: '',
  },
)

const renderedHtml = computed(() => renderMarkdownToHtml(props.source))
</script>

<template>
  <div class="vuepyter-markdown" v-html="renderedHtml" />
</template>

<style scoped>
.vuepyter-markdown {
  color: var(--vuepyter-text);
  font-family:
    Inter,
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Helvetica,
    Arial,
    sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}

.vuepyter-markdown :deep(a) {
  color: #2563eb;
}

.vuepyter-markdown :deep(h1),
.vuepyter-markdown :deep(h2),
.vuepyter-markdown :deep(h3),
.vuepyter-markdown :deep(h4),
.vuepyter-markdown :deep(h5),
.vuepyter-markdown :deep(h6) {
  margin: 1.05em 0 0.5em;
  line-height: 1.24;
  font-weight: 600;
  letter-spacing: -0.015em;
  text-transform: none;
}

.vuepyter-markdown :deep(h1) {
  font-size: 2rem;
  margin-top: 0.15em;
}

.vuepyter-markdown :deep(h2) {
  font-size: 1.6rem;
  font-weight: 550;
}

.vuepyter-markdown :deep(h3) {
  font-size: 1.3rem;
  font-weight: 520;
}

.vuepyter-markdown :deep(h4) {
  font-size: 1.12rem;
  font-weight: 520;
}

.vuepyter-markdown :deep(h5),
.vuepyter-markdown :deep(h6) {
  font-size: 1rem;
  font-weight: 500;
}

.vuepyter-markdown :deep(p) {
  margin: 0.7em 0;
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

.vuepyter-markdown :deep(.katex) {
  color: inherit;
}

.vuepyter-markdown :deep(.katex-display > .katex) {
  font-size: 1.35em;
}
</style>
