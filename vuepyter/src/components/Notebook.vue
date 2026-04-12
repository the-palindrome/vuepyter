<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from 'vue'
import type { CellType, CodeEditorProps, KeymapConfig, NotebookCell, NotebookCellType } from '../types'
import { useKeyboard } from '../composables/useKeyboard'
import Cell from './Cell.vue'

interface CellRef {
  focusEditor?: () => void
  blurEditor?: () => void
}

const props = withDefaults(
  defineProps<{
    cells: NotebookCell[]
    readOnly?: boolean
    keymap?: Partial<KeymapConfig>
    editorOptions?: Partial<CodeEditorProps>
    maxOutputHeight?: number
    locale?: Record<string, string>
    dark?: boolean
  }>(),
  {
    readOnly: false,
    keymap: () => ({}),
    editorOptions: () => ({}),
    maxOutputHeight: 400,
    locale: () => ({}),
    dark: false,
  },
)

const emit = defineEmits<{
  'update:activeIndex': [index: number]
  cellAdd: [payload: { index: number; type: CellType; cell?: NotebookCell }]
  cellDelete: [payload: { index: number }]
  cellMove: [payload: { from: number; to: number }]
  cellTag: [payload: { index: number }]
  cellType: [payload: { index: number; type: NotebookCellType }]
  cellSource: [payload: { index: number; source: string }]
  cellExecute: [payload: { index: number; advance: boolean; insertBelow?: boolean }]
  interrupt: []
  restartKernel: []
  showShortcuts: []
  save: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const cellRefs = ref<Record<string, CellRef | undefined>>({})
const activeIndex = ref(0)
const draggingIndex = ref<number | null>(null)
const markdownEditById = ref<Record<string, boolean>>({})
const lineNumbersById = ref<Record<string, boolean>>({})
const lineNumbersAll = ref<boolean | null>(null)
const outputHiddenById = ref<Record<string, boolean>>({})
const outputScrollableById = ref<Record<string, boolean>>({})
const clipboardCell = ref<NotebookCell | null>(null)
const deletedStack = ref<Array<{ cell: NotebookCell; index: number }>>([])
const redoStack = ref<Array<{ cell: NotebookCell; index: number }>>([])
const slots = useSlots()

const cellCount = computed(() => props.cells.length)
const keymapRef = computed(() => props.keymap)
const readOnlyRef = computed(() => props.readOnly)
const resolvedReadOnly = computed(() => props.readOnly ?? false)
const resolvedMaxOutputHeight = computed(() => props.maxOutputHeight ?? 400)
const resolvedEditorOptions = computed(() => props.editorOptions ?? {})
const resolvedLocale = computed(() => props.locale ?? {})
const resolvedDark = computed(() => props.dark ?? false)

watch(
  () => props.cells,
  (cells) => {
    const max = Math.max(0, cells.length - 1)
    if (activeIndex.value > max) {
      activeIndex.value = max
    }

    const cellIds = new Set(cells.map((cell) => cell.id))
    const compact = (store: Record<string, boolean>) =>
      Object.fromEntries(Object.entries(store).filter(([id]) => cellIds.has(id)))

    lineNumbersById.value = compact(lineNumbersById.value)
    outputHiddenById.value = compact(outputHiddenById.value)
    outputScrollableById.value = compact(outputScrollableById.value)
    markdownEditById.value = compact(markdownEditById.value)
    cellRefs.value = Object.fromEntries(Object.entries(cellRefs.value).filter(([id]) => cellIds.has(id)))
  },
  { deep: true },
)

watch(activeIndex, (value) => {
  emit('update:activeIndex', value)
})

function generateCellId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cell-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cloneCell(cell: NotebookCell, preserveId = true): NotebookCell {
  const cloned = JSON.parse(JSON.stringify(cell)) as NotebookCell
  if (!preserveId) {
    cloned.id = generateCellId()
  }
  return cloned
}

function cellForSplit(template: NotebookCell, source: string): NotebookCell {
  if (template.cell_type === 'code') {
    return {
      ...cloneCell(template, false),
      source,
      execution_count: null,
      outputs: [],
    }
  }
  return {
    ...cloneCell(template, false),
    source,
  }
}

function currentCell(): NotebookCell | null {
  return props.cells[activeIndex.value] ?? null
}

function setCellRef(cellId: string, instance: unknown): void {
  cellRefs.value[cellId] = (instance as CellRef | null) ?? undefined
}

async function focusActiveEditor(): Promise<void> {
  await nextTick()
  const cell = currentCell()
  if (!cell) {
    return
  }
  cellRefs.value[cell.id]?.focusEditor?.()
}

function blurActiveEditor(): void {
  const cell = currentCell()
  if (!cell) {
    return
  }
  cellRefs.value[cell.id]?.blurEditor?.()
}

function lineNumbersForCell(cell: NotebookCell): boolean {
  const explicit = lineNumbersById.value[cell.id]
  if (typeof explicit === 'boolean') {
    return explicit
  }
  if (typeof lineNumbersAll.value === 'boolean') {
    return lineNumbersAll.value
  }
  return resolvedEditorOptions.value.lineNumbers ?? true
}

function editorOptionsForCell(cell: NotebookCell): Partial<CodeEditorProps> {
  return {
    ...resolvedEditorOptions.value,
    lineNumbers: lineNumbersForCell(cell),
  }
}

function outputHidden(cell: NotebookCell): boolean {
  return outputHiddenById.value[cell.id] ?? false
}

function outputScrollable(cell: NotebookCell): boolean {
  return outputScrollableById.value[cell.id] ?? true
}

function pushDeletedCell(cell: NotebookCell, index: number): void {
  deletedStack.value.push({
    cell: cloneCell(cell, true),
    index,
  })
  if (deletedStack.value.length > 100) {
    deletedStack.value.shift()
  }
}

function deleteCellAt(index: number, options: { copyToClipboard?: boolean; trackUndo?: boolean } = {}): void {
  const cell = props.cells[index]
  if (!cell) {
    return
  }

  if (options.copyToClipboard) {
    clipboardCell.value = cloneCell(cell, true)
  }

  if (options.trackUndo !== false) {
    pushDeletedCell(cell, index)
    redoStack.value = []
  }

  emit('cellDelete', { index })

  if (props.cells.length > 1) {
    activeIndex.value = Math.min(index, props.cells.length - 2)
  } else {
    activeIndex.value = 0
  }
}

function pasteCellAt(index: number): void {
  if (!clipboardCell.value) {
    return
  }
  const safeIndex = Math.max(0, Math.min(index, props.cells.length))
  const pastedCell = cloneCell(clipboardCell.value, false)
  emit('cellAdd', { index: safeIndex, type: pastedCell.cell_type, cell: pastedCell })
  activeIndex.value = safeIndex
}

function headingSource(source: string, level: 1 | 2 | 3 | 4 | 5 | 6): string {
  const withoutHeading = source.replace(/^\s{0,3}#{1,6}\s*/u, '').trimStart()
  const prefix = '#'.repeat(level)
  return withoutHeading ? `${prefix} ${withoutHeading}` : `${prefix} `
}

function mergeCells(targetIndex: number, removeIndex: number): void {
  if (targetIndex < 0 || removeIndex < 0 || targetIndex === removeIndex) {
    return
  }
  const target = props.cells[targetIndex]
  const removed = props.cells[removeIndex]
  if (!target || !removed) {
    return
  }
  const mergedSource = [target.source, removed.source].filter(Boolean).join('\n\n')
  emit('cellSource', { index: targetIndex, source: mergedSource })
  pushDeletedCell(removed, removeIndex)
  redoStack.value = []
  emit('cellDelete', { index: removeIndex })
  activeIndex.value = Math.min(targetIndex, props.cells.length - 2)
}

const { setMode, onKeydown } = useKeyboard({
  keymap: keymapRef,
  readOnly: readOnlyRef,
  activeCellIndex: activeIndex,
  cellCount,
  onRunCell: (advance) => {
    emit('cellExecute', { index: activeIndex.value, advance })
  },
  onRunCellAndInsertBelow: () => {
    emit('cellExecute', { index: activeIndex.value, advance: true, insertBelow: true })
    activeIndex.value = Math.min(activeIndex.value + 1, props.cells.length)
  },
  onMoveCellSelection: (nextIndex) => {
    activeIndex.value = nextIndex
  },
  onMoveCellUpPosition: ({ from, to }) => {
    if (from === to) {
      return
    }
    emit('cellMove', { from, to })
    activeIndex.value = to
  },
  onMoveCellDownPosition: ({ from, to }) => {
    if (from === to) {
      return
    }
    emit('cellMove', { from, to })
    activeIndex.value = to
  },
  onAddCell: (insertAt) => {
    emit('cellAdd', { index: insertAt, type: 'code' })
    activeIndex.value = insertAt
  },
  onDeleteCell: (index) => {
    deleteCellAt(index)
  },
  onUndoCellAction: () => {
    const entry = deletedStack.value.pop()
    if (!entry) {
      return
    }
    const safeIndex = Math.max(0, Math.min(entry.index, props.cells.length))
    const restored = cloneCell(entry.cell, true)
    emit('cellAdd', {
      index: safeIndex,
      type: restored.cell_type,
      cell: restored,
    })
    activeIndex.value = safeIndex
    redoStack.value.push({
      cell: cloneCell(entry.cell, true),
      index: safeIndex,
    })
  },
  onRedoCellAction: () => {
    const entry = redoStack.value.pop()
    if (!entry) {
      return
    }
    const index = props.cells.findIndex((cell) => cell.id === entry.cell.id)
    if (index < 0) {
      return
    }
    pushDeletedCell(entry.cell, index)
    emit('cellDelete', { index })
    activeIndex.value = Math.max(0, Math.min(index, props.cells.length - 2))
  },
  onCopyCell: (index) => {
    const cell = props.cells[index]
    if (!cell) {
      return
    }
    clipboardCell.value = cloneCell(cell, true)
  },
  onCutCell: (index) => {
    deleteCellAt(index, { copyToClipboard: true })
  },
  onPasteCellBelow: (index) => {
    pasteCellAt(index + 1)
  },
  onPasteCellAbove: (index) => {
    pasteCellAt(index)
  },
  onMergeCells: (index) => {
    mergeCells(index, index + 1)
  },
  onMergeCellAbove: (index) => {
    mergeCells(index - 1, index)
  },
  onMergeCellBelow: (index) => {
    mergeCells(index, index + 1)
  },
  onChangeCellType: ({ index, type }) => {
    emit('cellType', { index, type })
  },
  onSetHeadingLevel: ({ index, level }) => {
    const cell = props.cells[index]
    if (!cell) {
      return
    }
    emit('cellType', { index, type: 'markdown' })
    emit('cellSource', { index, source: headingSource(cell.source, level) })
  },
  onEnterEditMode: async () => {
    const cell = currentCell()
    if (!cell) {
      return
    }
    if (cell.cell_type === 'markdown') {
      markdownEditById.value[cell.id] = true
    }
    setMode('edit')
    await focusActiveEditor()
  },
  onToggleMarkdownEdit: () => {
    void focusActiveEditor()
  },
  onExitEditMode: () => {
    const current = currentCell()
    if (!current) {
      return
    }
    if (current.cell_type === 'markdown') {
      markdownEditById.value[current.id] = false
    }
    blurActiveEditor()
    setMode('command')
  },
  onSelectAllCells: () => {
    if (props.cells.length > 0) {
      activeIndex.value = props.cells.length - 1
    }
  },
  onToggleLineNumbers: () => {
    const cell = currentCell()
    if (!cell) {
      return
    }
    lineNumbersById.value[cell.id] = !lineNumbersForCell(cell)
  },
  onToggleAllLineNumbers: () => {
    const current = lineNumbersAll.value ?? (resolvedEditorOptions.value.lineNumbers ?? true)
    lineNumbersAll.value = !current
    lineNumbersById.value = {}
  },
  onToggleOutput: () => {
    const cell = currentCell()
    if (!cell || cell.cell_type !== 'code') {
      return
    }
    outputHiddenById.value[cell.id] = !(outputHiddenById.value[cell.id] ?? false)
  },
  onToggleOutputScrolling: () => {
    const cell = currentCell()
    if (!cell || cell.cell_type !== 'code') {
      return
    }
    outputScrollableById.value[cell.id] = !(outputScrollableById.value[cell.id] ?? true)
  },
  onInterruptKernel: () => emit('interrupt'),
  onRestartKernel: () => emit('restartKernel'),
  onShowShortcuts: () => emit('showShortcuts'),
  onSaveCommand: () => emit('save'),
  onInsertHeadingAbove: () => {
    const index = activeIndex.value
    const headingCell: NotebookCell = {
      id: generateCellId(),
      cell_type: 'markdown',
      source: '# ',
      metadata: {},
    }
    emit('cellAdd', { index, type: 'markdown', cell: headingCell })
    activeIndex.value = index
  },
  onInsertHeadingBelow: () => {
    const index = activeIndex.value + 1
    const headingCell: NotebookCell = {
      id: generateCellId(),
      cell_type: 'markdown',
      source: '# ',
      metadata: {},
    }
    emit('cellAdd', { index, type: 'markdown', cell: headingCell })
    activeIndex.value = index
  },
  onSave: () => emit('save'),
})

const onCellSelect = (index: number) => {
  activeIndex.value = index
  setMode('command')
}

const onCellExecute = (payload: { index: number; advance: boolean; insertBelow?: boolean }) => {
  const cell = props.cells[payload.index]
  if (cell?.cell_type === 'markdown') {
    markdownEditById.value[cell.id] = false
    blurActiveEditor()
    setMode('command')
  }

  activeIndex.value = payload.index
  emit('cellExecute', payload)
  if (payload.insertBelow) {
    activeIndex.value = Math.min(payload.index + 1, props.cells.length)
    return
  }
  if (payload.advance) {
    activeIndex.value = Math.min(payload.index + 1, props.cells.length)
  }
}

const onCellDragStart = (index: number) => {
  draggingIndex.value = index
}

const onCellDrop = (targetIndex: number) => {
  if (draggingIndex.value === null || draggingIndex.value === targetIndex) {
    draggingIndex.value = null
    return
  }
  emit('cellMove', { from: draggingIndex.value, to: targetIndex })
  activeIndex.value = targetIndex
  draggingIndex.value = null
}

const onCellMarkdownMode = (payload: { index: number; editing: boolean }) => {
  const cell = props.cells[payload.index]
  if (!cell || cell.cell_type !== 'markdown') {
    return
  }
  markdownEditById.value[cell.id] = payload.editing
  setMode(payload.editing ? 'edit' : 'command')
}

const markdownEditing = (cell: NotebookCell): boolean => markdownEditById.value[cell.id] ?? false

const onCellSplit = (payload: { index: number; cursorOffset: number }) => {
  const cell = props.cells[payload.index]
  if (!cell || (props.readOnly ?? false)) {
    return
  }
  const safeOffset = Math.max(0, Math.min(payload.cursorOffset, cell.source.length))
  const sourceA = cell.source.slice(0, safeOffset)
  const sourceB = cell.source.slice(safeOffset)
  emit('cellSource', { index: payload.index, source: sourceA })
  const splitCell = cellForSplit(cell, sourceB)
  emit('cellAdd', { index: payload.index + 1, type: splitCell.cell_type, cell: splitCell })
  activeIndex.value = payload.index + 1
}

const onCellToolbarConvert = (payload: { index: number; type: NotebookCellType }) => {
  if (resolvedReadOnly.value) {
    return
  }
  activeIndex.value = payload.index
  emit('cellType', payload)
}

const onCellToolbarMoveUp = (index: number) => {
  if (resolvedReadOnly.value || index <= 0) {
    return
  }
  emit('cellMove', { from: index, to: index - 1 })
  activeIndex.value = index - 1
}

const onCellToolbarMoveDown = (index: number) => {
  if (resolvedReadOnly.value || index >= props.cells.length - 1) {
    return
  }
  emit('cellMove', { from: index, to: index + 1 })
  activeIndex.value = index + 1
}

const onCellToolbarAddTag = (index: number) => {
  if (resolvedReadOnly.value) {
    return
  }
  activeIndex.value = index
  emit('cellTag', { index })
}

const onCellToolbarDelete = (index: number) => {
  if (resolvedReadOnly.value) {
    return
  }
  activeIndex.value = index
  deleteCellAt(index)
}
</script>

<template>
  <div
    ref="rootRef"
    class="vuepyter-notebook"
    tabindex="0"
    role="application"
    @keydown="onKeydown"
  >
    <Cell
      v-for="(cell, index) in cells"
      :key="cell.id"
      :ref="(instance) => setCellRef(cell.id, instance)"
      :cell="cell"
      :index="index"
      :total-cells="cells.length"
      :active="index === activeIndex"
      :read-only="resolvedReadOnly"
      :max-output-height="resolvedMaxOutputHeight"
      :editor-options="editorOptionsForCell(cell)"
      :locale="resolvedLocale"
      :dark="resolvedDark"
      :markdown-editing="markdownEditing(cell)"
      :output-hidden="outputHidden(cell)"
      :output-scrollable="outputScrollable(cell)"
      @select="onCellSelect"
      @update-source="emit('cellSource', $event)"
      @execute="onCellExecute"
      @focus="() => setMode('edit')"
      @blur="() => setMode('command')"
      @navigate-up="() => onCellSelect(Math.max(0, index - 1))"
      @navigate-down="() => onCellSelect(Math.min(cells.length - 1, index + 1))"
      @split-cell="onCellSplit"
      @toolbar-convert="onCellToolbarConvert"
      @toolbar-move-up="onCellToolbarMoveUp"
      @toolbar-move-down="onCellToolbarMoveDown"
      @toolbar-add-tag="onCellToolbarAddTag"
      @toolbar-delete="onCellToolbarDelete"
      @drag-start="onCellDragStart"
      @drop="onCellDrop"
      @toggle-markdown-mode="onCellMarkdownMode"
    >
      <template v-if="slots.editor" #editor="slotProps">
        <slot name="editor" v-bind="slotProps" />
      </template>
      <template v-if="slots['markdown-renderer']" #markdown-renderer="slotProps">
        <slot name="markdown-renderer" v-bind="slotProps" />
      </template>
    </Cell>
  </div>
</template>

<style scoped>
.vuepyter-notebook {
  display: grid;
  gap: 0.75rem;
  outline: none;
}
</style>
