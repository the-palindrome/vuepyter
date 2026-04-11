<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CodeEditorProps, NotebookCell } from '../types'
import CellOutput from './CellOutput.vue'
import CodeEditor from './CodeEditor.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = withDefaults(
  defineProps<{
    cell: NotebookCell
    index: number
    active?: boolean
    readOnly?: boolean
    maxOutputHeight?: number
    editorOptions?: Partial<CodeEditorProps>
    locale?: Record<string, string>
    dark?: boolean
    markdownEditing?: boolean
    outputHidden?: boolean
    outputScrollable?: boolean
  }>(),
  {
    active: false,
    readOnly: false,
    maxOutputHeight: 400,
    editorOptions: () => ({}),
    locale: () => ({}),
    dark: false,
    markdownEditing: false,
    outputHidden: false,
    outputScrollable: true,
  },
)

const emit = defineEmits<{
  select: [index: number]
  updateSource: [payload: { index: number; source: string }]
  execute: [payload: { index: number; advance: boolean }]
  focus: [index: number]
  blur: [index: number]
  navigateUp: [index: number]
  navigateDown: [index: number]
  splitCell: [payload: { index: number; cursorOffset: number }]
  toggleMarkdownMode: [payload: { index: number; editing: boolean }]
  dragStart: [index: number]
  drop: [index: number]
}>()

const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)

const isCodeCell = computed(() => props.cell.cell_type === 'code')
const isMarkdownCell = computed(() => props.cell.cell_type === 'markdown')
const resolvedReadOnly = computed(() => props.readOnly ?? false)
const resolvedMaxOutputHeight = computed(() => props.maxOutputHeight ?? 400)
const resolvedLocale = computed(() => props.locale ?? {})
const resolvedDark = computed(() => props.dark ?? false)
const resolvedOutputHidden = computed(() => props.outputHidden ?? false)
const resolvedOutputScrollable = computed(() => props.outputScrollable ?? true)
const showMarkdownPreview = computed(() => isMarkdownCell.value && !props.markdownEditing)
const editorLanguage = computed<'python' | 'markdown' | 'raw'>(() => {
  if (props.cell.cell_type === 'markdown') {
    return 'markdown'
  }
  if (props.cell.cell_type === 'raw') {
    return 'raw'
  }
  return 'python'
})
const executionLabel = computed(() => {
  if (!isCodeCell.value) {
    return ''
  }
  const count = props.cell.execution_count
  return `[${count ?? ' '}]:`
})
const cellTypeIcon = computed(() => {
  if (props.cell.cell_type === 'code') {
    return '</>'
  }
  if (props.cell.cell_type === 'markdown') {
    return 'M'
  }
  return 'R'
})

const mergedEditorOptions = computed(() => ({
  lineNumbers: props.editorOptions.lineNumbers ?? true,
  lineWrapping: props.editorOptions.lineWrapping ?? true,
  indentUnit: props.editorOptions.indentUnit ?? 4,
  tabSize: props.editorOptions.tabSize ?? 4,
  extensions: props.editorOptions.extensions ?? [],
}))

const onSourceUpdate = (source: string) => {
  emit('updateSource', { index: props.index, source })
}

const onExecute = (advance: boolean) => {
  emit('execute', { index: props.index, advance })
}

const onToggleMarkdown = (editing: boolean) => {
  if (!isMarkdownCell.value) {
    return
  }
  emit('toggleMarkdownMode', { index: props.index, editing })
}

defineExpose({
  focusEditor: () => editorRef.value?.focus(),
  blurEditor: () => editorRef.value?.blur(),
})
</script>

<template>
  <article
    class="vuepyter-cell"
    :class="{ 'is-active': active }"
    @click="emit('select', index)"
    @dragover.prevent
    @drop.prevent="emit('drop', index)"
  >
    <aside class="vuepyter-cell-gutter">
      <button
        class="vuepyter-drag-handle"
        type="button"
        :draggable="!resolvedReadOnly"
        :disabled="resolvedReadOnly"
        @dragstart="emit('dragStart', index)"
        @click.stop
      >
        ⋮⋮
      </button>
      <span class="vuepyter-cell-counter">{{ executionLabel }}</span>
      <span class="vuepyter-cell-icon">{{ cellTypeIcon }}</span>
    </aside>

    <div class="vuepyter-cell-content">
      <div
        v-if="showMarkdownPreview"
        class="vuepyter-markdown-preview"
        @dblclick="onToggleMarkdown(true)"
      >
        <slot name="markdown-renderer" :cell="cell" :source="cell.source">
          <MarkdownRenderer :source="cell.source" />
        </slot>
      </div>

      <slot
        v-else
        name="editor"
        :cell="cell"
        :index="index"
        :update-source="onSourceUpdate"
        :run-cell="onExecute"
      >
        <CodeEditor
          ref="editorRef"
          :model-value="cell.source"
          :language="editorLanguage"
          :read-only="resolvedReadOnly"
          :line-numbers="mergedEditorOptions.lineNumbers"
          :line-wrapping="mergedEditorOptions.lineWrapping"
          :indent-unit="mergedEditorOptions.indentUnit"
          :tab-size="mergedEditorOptions.tabSize"
          :extensions="mergedEditorOptions.extensions"
          :dark="resolvedDark"
          @update:model-value="onSourceUpdate"
          @execute="onExecute"
          @focus="emit('focus', index)"
          @blur="emit('blur', index)"
          @navigate-up="emit('navigateUp', index)"
          @navigate-down="emit('navigateDown', index)"
          @split="(cursorOffset) => emit('splitCell', { index, cursorOffset })"
        />
      </slot>

      <div v-if="isMarkdownCell && markdownEditing" class="vuepyter-markdown-actions">
        <button type="button" class="vuepyter-inline-button" @click="onToggleMarkdown(false)">Preview</button>
      </div>

      <CellOutput
        v-if="cell.cell_type === 'code' && !resolvedOutputHidden"
        :outputs="cell.outputs"
        :max-output-height="resolvedOutputScrollable ? resolvedMaxOutputHeight : false"
        :empty-label="resolvedLocale.noOutput ?? 'No output'"
      />
    </div>
  </article>
</template>

<style scoped>
.vuepyter-cell {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  background: var(--vuepyter-cell-bg);
  border: 1px solid var(--vuepyter-cell-border);
  border-radius: 0.45rem;
  padding: 0.5rem;
}

.vuepyter-cell.is-active {
  border-color: var(--vuepyter-cell-active-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vuepyter-cell-active-border) 35%, transparent);
}

.vuepyter-cell-gutter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 3.5rem;
  color: var(--vuepyter-text-secondary);
  font-family: var(--vuepyter-font-mono);
  font-size: 0.75rem;
}

.vuepyter-drag-handle {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: grab;
}

.vuepyter-cell-counter {
  min-height: 1rem;
}

.vuepyter-cell-icon {
  font-weight: 600;
}

.vuepyter-cell-content {
  display: grid;
  gap: 0.5rem;
}

.vuepyter-markdown-preview {
  min-height: 2rem;
  padding: 0.25rem;
}

.vuepyter-markdown-actions {
  display: flex;
  justify-content: flex-end;
}

.vuepyter-inline-button {
  border: 1px solid var(--vuepyter-cell-border);
  background: var(--vuepyter-button-bg);
  color: var(--vuepyter-text);
  border-radius: 0.35rem;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
}
</style>
