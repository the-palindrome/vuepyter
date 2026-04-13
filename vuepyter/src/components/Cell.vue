<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Play,
  Tag,
  Trash2,
} from 'lucide-vue-next'
import type { CellOutput as NotebookCellOutput, CodeEditorProps, NotebookCell, NotebookCellType } from '../types'
import { highlightPreviewLine } from '../utils/highlightPreview'
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
    sourceHidden?: boolean
    outputHidden?: boolean
    outputScrollable?: boolean
    totalCells?: number
  }>(),
  {
    active: false,
    readOnly: false,
    maxOutputHeight: 400,
    editorOptions: () => ({}),
    locale: () => ({}),
    dark: false,
    markdownEditing: false,
    sourceHidden: false,
    outputHidden: false,
    outputScrollable: true,
    totalCells: 0,
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
  toolbarConvert: [payload: { index: number; type: NotebookCellType }]
  toolbarMoveUp: [index: number]
  toolbarMoveDown: [index: number]
  toolbarAddTag: [index: number]
  toolbarDelete: [index: number]
  toggleSourceVisibility: [index: number]
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
const resolvedSourceHidden = computed(() => props.sourceHidden ?? false)
const resolvedOutputHidden = computed(() => props.outputHidden ?? false)
const resolvedOutputScrollable = computed(() => props.outputScrollable ?? true)
const showMarkdownPreview = computed(() => isMarkdownCell.value && !props.markdownEditing)
const canRun = computed(() => props.cell.cell_type === 'code')
const convertTargetType = computed<NotebookCellType>(() =>
  props.cell.cell_type === 'code' ? 'markdown' : 'code',
)
const convertLabel = computed(() =>
  props.cell.cell_type === 'code' ? 'Convert to markdown' : 'Convert to code',
)
const convertIcon = computed(() => (convertTargetType.value === 'markdown' ? FileText : FileCode2))
const sourceVisibilityLabel = computed(() => (resolvedSourceHidden.value ? 'Show source' : 'Hide source'))
const sourceVisibilityIcon = computed(() => (resolvedSourceHidden.value ? Eye : EyeOff))
const isFirstCell = computed(() => props.index <= 0)
const isLastCell = computed(() => props.index >= Math.max(0, (props.totalCells ?? 0) - 1))
const hasVisibleOutput = computed(() => {
  if (!isCodeCell.value || !('outputs' in props.cell)) {
    return false
  }
  return Array.isArray(props.cell.outputs) && props.cell.outputs.length > 0
})
const codeOutputs = computed<NotebookCellOutput[]>(() => {
  if (!isCodeCell.value || !('outputs' in props.cell) || !Array.isArray(props.cell.outputs)) {
    return []
  }
  return props.cell.outputs
})
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
  return `[${count ?? '\u00a0'}]:`
})
const hiddenSourcePreviewHtml = computed(() => {
  if (!isCodeCell.value) {
    return '...'
  }
  return highlightPreviewLine(props.cell.source, editorLanguage.value)
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

const onToolbarConvert = () => {
  emit('toolbarConvert', { index: props.index, type: convertTargetType.value })
}

const onToolbarMoveUp = () => {
  emit('toolbarMoveUp', props.index)
}

const onToolbarMoveDown = () => {
  emit('toolbarMoveDown', props.index)
}

const onToolbarAddTag = () => {
  emit('toolbarAddTag', props.index)
}

const onToolbarDelete = () => {
  emit('toolbarDelete', props.index)
}

const onToggleSourceVisibility = () => {
  if (!isCodeCell.value) {
    return
  }
  emit('toggleSourceVisibility', props.index)
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
    </aside>

    <div class="vuepyter-cell-content">
      <div class="vuepyter-cell-actions" @click.stop>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="!canRun"
          title="Run cell"
          aria-label="Run cell"
          @click="onExecute(false)"
        >
          <Play :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="resolvedReadOnly"
          :title="convertLabel"
          :aria-label="convertLabel"
          @click="onToolbarConvert"
        >
          <component :is="convertIcon" :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="resolvedReadOnly || !isCodeCell"
          :title="sourceVisibilityLabel"
          :aria-label="sourceVisibilityLabel"
          @click="onToggleSourceVisibility"
        >
          <component :is="sourceVisibilityIcon" :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="resolvedReadOnly || isFirstCell"
          title="Move cell up"
          aria-label="Move cell up"
          @click="onToolbarMoveUp"
        >
          <ArrowUp :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="resolvedReadOnly || isLastCell"
          title="Move cell down"
          aria-label="Move cell down"
          @click="onToolbarMoveDown"
        >
          <ArrowDown :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action"
          :disabled="resolvedReadOnly"
          title="Add cell tag"
          aria-label="Add cell tag"
          @click="onToolbarAddTag"
        >
          <Tag :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="vuepyter-cell-action is-danger"
          :disabled="resolvedReadOnly"
          title="Delete cell"
          aria-label="Delete cell"
          @click="onToolbarDelete"
        >
          <Trash2 :size="14" :stroke-width="1.9" aria-hidden="true" />
        </button>
      </div>

      <div
        v-if="showMarkdownPreview"
        class="vuepyter-markdown-preview"
        @dblclick="onToggleMarkdown(true)"
      >
        <slot name="markdown-renderer" :cell="cell" :source="cell.source">
          <MarkdownRenderer :source="cell.source" />
        </slot>
      </div>

      <div v-else-if="isCodeCell && resolvedSourceHidden" class="vuepyter-source-hidden">
        <code class="vuepyter-source-hidden-line" v-html="hiddenSourcePreviewHtml" />
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

      <CellOutput
        v-if="hasVisibleOutput && !resolvedOutputHidden"
        :outputs="codeOutputs"
        :max-output-height="resolvedOutputScrollable ? resolvedMaxOutputHeight : false"
        :empty-label="resolvedLocale.noOutput ?? 'No output'"
        hide-empty
      />
    </div>
  </article>
</template>

<style scoped>
.vuepyter-cell {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  background: color-mix(in srgb, var(--vuepyter-cell-bg) 78%, var(--vuepyter-bg));
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 45%, transparent);
  border-radius: 0.75rem;
  padding: 0.55rem 0.7rem;
}

.vuepyter-cell.is-active {
  border-color: color-mix(in srgb, var(--vuepyter-cell-active-border) 60%, var(--vuepyter-cell-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vuepyter-cell-active-border) 25%, transparent);
}

.vuepyter-cell-gutter {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.35rem;
  width: 2.45rem;
  padding-top: 0.3rem;
  color: var(--vuepyter-text-secondary);
  font-family: var(--vuepyter-font-mono);
  font-size: 0.78rem;
}

.vuepyter-drag-handle {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: grab;
  padding: 0;
  opacity: 0;
  transition: opacity 120ms ease;
}

.vuepyter-cell:hover .vuepyter-drag-handle,
.vuepyter-cell.is-active .vuepyter-drag-handle {
  opacity: 0.65;
}

.vuepyter-cell-counter {
  min-height: 1.1rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.vuepyter-cell-content {
  position: relative;
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.vuepyter-cell-actions {
  position: absolute;
  top: -0.38rem;
  right: 0.45rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.08rem;
  padding: 0.16rem 0.2rem;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 70%, transparent);
  background: color-mix(in srgb, var(--vuepyter-cell-bg) 82%, var(--vuepyter-bg));
  box-shadow: 0 4px 14px rgba(2, 8, 23, 0.12);
  opacity: 0;
  transform: translateY(-2px);
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}

.vuepyter-cell:hover .vuepyter-cell-actions,
.vuepyter-cell.is-active .vuepyter-cell-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.vuepyter-cell-action {
  border: 0;
  background: transparent;
  color: var(--vuepyter-text);
  border-radius: 0.32rem;
  min-width: 1.35rem;
  height: 1.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
}

.vuepyter-cell-action :deep(svg) {
  width: 0.92rem;
  height: 0.92rem;
}

.vuepyter-cell-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 72%, transparent);
}

.vuepyter-cell-action:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.vuepyter-cell-action.is-danger {
  color: var(--vuepyter-error-color);
}

.vuepyter-markdown-preview {
  min-height: 2rem;
  padding: 0.2rem 0.1rem;
}

.vuepyter-source-hidden {
  min-height: 1.25rem;
  display: flex;
  align-items: flex-start;
  padding: 0.32rem 0.1rem 0.08rem;
}

.vuepyter-source-hidden-line {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
  line-height: 1.1rem;
  margin: 0;
  font-family: var(--vuepyter-font-mono);
  font-size: 0.84rem;
}

</style>
