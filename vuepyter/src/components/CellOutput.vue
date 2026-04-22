<script setup lang="ts">
import { computed } from 'vue'
import type { CellOutput } from '../types'
import { ansiToHtml } from '../utils/ansiToHtml'
import { sanitizeHtml } from '../utils/htmlSanitize'

const props = withDefaults(
  defineProps<{
    outputs?: CellOutput[]
    maxOutputHeight?: number | false
    emptyLabel?: string
    hideEmpty?: boolean
  }>(),
  {
    outputs: () => [],
    maxOutputHeight: 400,
    emptyLabel: 'No output',
    hideEmpty: false,
  },
)

const resolvedOutputs = computed(() => props.outputs ?? [])
const shouldRender = computed(() => resolvedOutputs.value.length > 0 || !(props.hideEmpty ?? false))

const hasImageOutput = computed(() =>
  resolvedOutputs.value.some((output) => {
    if (output.output_type === 'stream' || output.output_type === 'error') {
      return false
    }
    return Object.keys(output.data ?? {}).some((mimeType) => mimeType.startsWith('image/'))
  }),
)

const outputStyle = computed(() => {
  if (hasImageOutput.value) {
    return {
      maxHeight: 'none',
      overflow: 'visible',
    }
  }

  return {
    maxHeight: props.maxOutputHeight === false ? 'none' : `${props.maxOutputHeight ?? 400}px`,
    overflow: props.maxOutputHeight === false ? 'visible' : 'auto',
  }
})

const asText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join('')
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'undefined' || value === null) {
    return ''
  }
  return String(value)
}

const imageSource = (value: unknown): string => {
  const raw = asText(value).trim()
  if (!raw) {
    return ''
  }
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
}

const textPlain = (output: CellOutput): string => {
  if (output.output_type === 'stream') {
    return asText(output.text)
  }
  if (output.output_type === 'error') {
    return output.traceback.join('\n')
  }
  return asText(output.data['text/plain'])
}

const htmlData = (output: CellOutput): string => {
  if (output.output_type !== 'display_data' && output.output_type !== 'execute_result') {
    return ''
  }
  return sanitizeHtml(asText(output.data['text/html']))
}

const tracebackHtml = (output: CellOutput): string => {
  if (output.output_type !== 'error') {
    return ''
  }
  return ansiToHtml(output.traceback.join('\n'))
}
</script>

<template>
  <div v-if="shouldRender" class="vuepyter-output-wrap" :style="outputStyle">
    <template v-if="resolvedOutputs.length">
      <div v-for="(output, index) in resolvedOutputs" :key="index" class="vuepyter-output-item">
        <pre v-if="output.output_type === 'stream'" class="vuepyter-output-pre">{{ textPlain(output) }}</pre>
        <div v-else-if="output.output_type === 'error'" class="vuepyter-output-error" v-html="tracebackHtml(output)" />
        <template v-else>
          <div
            v-if="output.data['text/html']"
            class="vuepyter-output-html"
            v-html="htmlData(output)"
          />
          <img
            v-else-if="output.data['image/png']"
            class="vuepyter-output-image"
            :src="imageSource(output.data['image/png'])"
            alt="cell output"
          />
          <pre v-else class="vuepyter-output-pre">{{ textPlain(output) }}</pre>
        </template>
      </div>
    </template>
    <div v-else class="vuepyter-output-empty">{{ emptyLabel }}</div>
  </div>
</template>

<style scoped>
.vuepyter-output-wrap {
  overflow: auto;
  background: transparent;
  border-radius: 0;
  border: 0;
}

.vuepyter-output-item + .vuepyter-output-item {
  border-top: 1px dashed color-mix(in srgb, var(--vuepyter-cell-border) 65%, transparent);
}

.vuepyter-output-pre,
.vuepyter-output-error,
.vuepyter-output-html {
  margin: 0;
  padding: 0.15rem 0.15rem 0.35rem;
  font-family: var(--vuepyter-font-mono);
  font-size: 0.92rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.vuepyter-output-error {
  color: var(--vuepyter-error-color);
}

.vuepyter-output-image {
  max-width: 100%;
  display: block;
}

.vuepyter-output-empty {
  color: var(--vuepyter-text-secondary);
  padding: 0.25rem 0.15rem 0.35rem;
  font-size: 0.85rem;
}
</style>
