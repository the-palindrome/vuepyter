<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import {
  DARK_THEME,
  DEFAULT_CELL_TYPES,
  DEFAULT_KEYMAP,
  DEFAULT_LOCALE,
  DEFAULT_PYODIDE_URL,
  LIGHT_THEME,
} from '../constants'
import { useNotebookModel } from '../composables/useNotebookModel'
import { usePyodideKernel } from '../composables/usePyodideKernel'
import { useVuepyterProvide } from '../composables/useVuepyterProvide'
import type { CellType, CodeEditorProps, KeymapConfig, NotebookCell, NotebookDocument } from '../types'
import EditorBar from './EditorBar.vue'
import Notebook from './Notebook.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: NotebookDocument | null
    pyodideUrl?: string
    pyodidePackages?: string[]
    pyodideInitCode?: string
    readOnly?: boolean
    showEditorBar?: boolean
    editorBarPosition?: 'top' | 'bottom'
    theme?: 'light' | 'dark' | Record<string, string>
    maxOutputHeight?: number
    cellTypes?: CellType[]
    autosaveInterval?: number | false
    locale?: Record<string, string>
    keymap?: Partial<KeymapConfig>
    editorOptions?: Partial<CodeEditorProps>
  }>(),
  {
    modelValue: null,
    pyodideUrl: DEFAULT_PYODIDE_URL,
    pyodidePackages: () => [],
    pyodideInitCode: '',
    readOnly: false,
    showEditorBar: true,
    editorBarPosition: 'top',
    theme: 'light',
    maxOutputHeight: 400,
    cellTypes: () => DEFAULT_CELL_TYPES,
    autosaveInterval: false,
    locale: () => ({}),
    keymap: () => ({}),
    editorOptions: () => ({}),
  },
)

const emit = defineEmits<{
  'update:modelValue': [document: NotebookDocument]
  ready: [payload: { pyodide: unknown; workspace: { value: Record<string, unknown> } }]
  'cell:execute': [payload: { cellId: string; source: string }]
  'cell:complete': [payload: { cellId: string; outputs: unknown[]; error?: Error }]
  'shortcuts:help': []
  error: [payload: { type: string; message: string; detail?: unknown }]
}>()

const activeCellIndex = ref(0)
const pendingAutosave = ref(false)
const slots = useSlots()
const resolvedReadOnly = computed(() => props.readOnly ?? false)
const resolvedCellTypes = computed(() => props.cellTypes ?? DEFAULT_CELL_TYPES)
const resolvedMaxOutputHeight = computed(() => props.maxOutputHeight ?? 400)

const locale = computed(() => ({
  ...DEFAULT_LOCALE,
  ...props.locale,
  noOutput: props.locale?.noOutput ?? 'No output',
  kernelLoading: props.locale?.kernelLoading ?? props.locale?.statusLoading ?? 'Loading',
  kernelReady: props.locale?.kernelReady ?? props.locale?.statusReady ?? 'Ready',
  kernelBusy: props.locale?.kernelBusy ?? props.locale?.statusBusy ?? 'Busy',
  kernelError: props.locale?.kernelError ?? props.locale?.statusError ?? 'Error',
}))

const keymap = computed(() => ({
  ...DEFAULT_KEYMAP,
  ...props.keymap,
}))

const editorOptions = computed(() => ({
  lineNumbers: true,
  lineWrapping: true,
  indentUnit: 4,
  tabSize: 4,
  extensions: [],
  ...props.editorOptions,
}))

const notebookModel = useNotebookModel({
  modelValue: props.modelValue,
})

const kernel = usePyodideKernel({
  pyodideUrl: props.pyodideUrl,
  pyodidePackages: props.pyodidePackages,
  pyodideInitCode: props.pyodideInitCode,
  onReady: ({ pyodide }) => {
    emit('ready', {
      pyodide,
      workspace: kernel.workspace,
    })
  },
  onError: (payload) => {
    emit('error', payload)
  },
})

useVuepyterProvide({
  pyodide: kernel.pyodide,
  workspace: kernel.workspace,
  status: kernel.status,
})

const isDark = computed(() => props.theme === 'dark')

const themeVariables = computed<Record<string, string>>(() => {
  const base = props.theme === 'dark' ? DARK_THEME : LIGHT_THEME
  if (props.theme && typeof props.theme === 'object') {
    return {
      ...base,
      ...props.theme,
    }
  }
  return base
})

const themeStyle = computed(() => themeVariables.value)

const activeCell = computed(() => notebookModel.cells.value[activeCellIndex.value] ?? null)
const activeCellType = computed<CellType>(() => activeCell.value?.cell_type ?? 'code')

let emitDebounceTimer: ReturnType<typeof setTimeout> | null = null
let autosaveTimer: ReturnType<typeof setInterval> | null = null

const serializeNotebook = () => notebookModel.serialize() as unknown as NotebookDocument

const flushModelValue = () => {
  pendingAutosave.value = false
  emit('update:modelValue', serializeNotebook())
}

const scheduleModelValueEmit = () => {
  pendingAutosave.value = true
  if (props.autosaveInterval !== false) {
    return
  }
  if (emitDebounceTimer) {
    clearTimeout(emitDebounceTimer)
  }
  emitDebounceTimer = setTimeout(() => {
    flushModelValue()
  }, 150)
}

const setupAutosave = () => {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
  if (typeof props.autosaveInterval !== 'number' || props.autosaveInterval <= 0) {
    return
  }
  autosaveTimer = setInterval(() => {
    if (pendingAutosave.value) {
      flushModelValue()
    }
  }, props.autosaveInterval)
}

watch(
  () => notebookModel.notebook.value,
  () => {
    scheduleModelValueEmit()
  },
  { deep: true },
)

watch(
  () => props.modelValue,
  (value) => {
    notebookModel.setNotebook(value)
  },
  { deep: true },
)

watch(
  () => props.autosaveInterval,
  () => {
    setupAutosave()
  },
  { immediate: true },
)

const addCell = (type: CellType) => {
  notebookModel.addCell(activeCellIndex.value + 1, type)
}

const deleteActiveCell = () => {
  const cell = notebookModel.cells.value[activeCellIndex.value]
  if (!cell) {
    return
  }
  notebookModel.removeCell(cell.id)
}

const setActiveCellType = (type: CellType) => {
  const cell = notebookModel.cells.value[activeCellIndex.value]
  if (!cell) {
    return
  }
  notebookModel.setCellType(cell.id, type)
}

const executeCell = async (index: number) => {
  const cell = notebookModel.cells.value[index]
  if (!cell || cell.cell_type !== 'code') {
    return
  }
  emit('cell:execute', { cellId: cell.id, source: cell.source })
  const result = await kernel.executeCell({
    cellId: cell.id,
    source: cell.source,
  })
  notebookModel.setCellOutputs(cell.id, result.outputs, result.executionCount)
  if (result.error) {
    emit('cell:complete', {
      cellId: cell.id,
      outputs: result.outputs,
      error: result.error,
    })
  } else {
    emit('cell:complete', {
      cellId: cell.id,
      outputs: result.outputs,
    })
  }
}

const executeActiveCell = async (advance = false) => {
  await executeCell(activeCellIndex.value)
  if (advance) {
    activeCellIndex.value = Math.min(activeCellIndex.value + 1, notebookModel.cells.value.length - 1)
  }
}

const executeAllCells = async () => {
  for (const [index, cell] of notebookModel.cells.value.entries()) {
    if (cell.cell_type === 'code') {
      await executeCell(index)
    }
  }
}

const restartKernel = async () => {
  await kernel.restart()
  notebookModel.resetExecutionState()
}

const interrupt = () => {
  const interrupted = kernel.interrupt()
  if (!interrupted) {
    emit('error', {
      type: 'kernel:interrupt',
      message: 'Kernel interrupt is not available in this environment.',
    })
  }
}

const clearOutputs = () => {
  notebookModel.clearOutputs()
}

onMounted(async () => {
  try {
    await kernel.initialize()
  } catch {
    // Error event is emitted from kernel composable.
  }
})

onBeforeUnmount(() => {
  if (emitDebounceTimer) {
    clearTimeout(emitDebounceTimer)
  }
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
  }
})

const onCellSource = (payload: { index: number; source: string }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }
  notebookModel.setCellSource(cell.id, payload.source)
}

const onCellAdd = (payload: { index: number; type: CellType; cell?: NotebookCell }) => {
  if (payload.cell) {
    notebookModel.insertCell(payload.cell, payload.index)
    activeCellIndex.value = payload.index
    return
  }
  notebookModel.addCell(payload.index, payload.type)
  activeCellIndex.value = payload.index
}

const onCellDelete = (payload: { index: number }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }
  notebookModel.removeCell(cell.id)
}

const onCellMove = (payload: { from: number; to: number }) => {
  notebookModel.moveCell(payload.from, payload.to)
}

const onCellType = (payload: { index: number; type: CellType }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }
  notebookModel.setCellType(cell.id, payload.type)
}

const onCellExecute = async (payload: { index: number; advance: boolean; insertBelow?: boolean }) => {
  activeCellIndex.value = payload.index
  await executeCell(payload.index)
  if (payload.insertBelow) {
    const insertIndex = Math.min(payload.index + 1, notebookModel.cells.value.length)
    notebookModel.addCell(insertIndex, 'code')
    activeCellIndex.value = insertIndex
    return
  }
  if (payload.advance) {
    activeCellIndex.value = Math.min(payload.index + 1, notebookModel.cells.value.length - 1)
  }
}
</script>

<template>
  <div class="vuepyter-root" :style="themeStyle">
    <EditorBar
      v-if="showEditorBar && editorBarPosition === 'top'"
      :read-only="resolvedReadOnly"
      :status="kernel.status.value"
      :active-cell-type="activeCellType"
      :cell-types="resolvedCellTypes"
      :locale="locale"
      @add-cell="addCell"
      @delete-active="deleteActiveCell"
      @set-cell-type="setActiveCellType"
      @run-active="executeActiveCell()"
      @run-all="executeAllCells"
      @restart-kernel="restartKernel"
      @interrupt="interrupt"
      @clear-outputs="clearOutputs"
    >
      <template v-if="slots['bar-prepend']" #bar-prepend><slot name="bar-prepend" /></template>
      <template v-if="slots['bar-left']" #bar-left><slot name="bar-left" /></template>
      <template v-if="slots['bar-center']" #bar-center><slot name="bar-center" /></template>
      <template v-if="slots['bar-right']" #bar-right><slot name="bar-right" /></template>
      <template v-if="slots['bar-append']" #bar-append><slot name="bar-append" /></template>
    </EditorBar>

    <Notebook
      :cells="notebookModel.cells.value"
      :read-only="resolvedReadOnly"
      :keymap="keymap"
      :editor-options="editorOptions"
      :max-output-height="resolvedMaxOutputHeight"
      :locale="locale"
      :dark="isDark"
      @update:active-index="activeCellIndex = $event"
      @cell-source="onCellSource"
      @cell-add="onCellAdd"
      @cell-delete="onCellDelete"
      @cell-move="onCellMove"
      @cell-type="onCellType"
      @cell-execute="onCellExecute"
      @interrupt="interrupt"
      @restart-kernel="restartKernel"
      @show-shortcuts="emit('shortcuts:help')"
      @save="flushModelValue"
    >
      <template v-if="slots.editor" #editor="slotProps">
        <slot name="editor" v-bind="slotProps" />
      </template>
      <template v-if="slots['markdown-renderer']" #markdown-renderer="slotProps">
        <slot name="markdown-renderer" v-bind="slotProps" />
      </template>
    </Notebook>

    <EditorBar
      v-if="showEditorBar && editorBarPosition === 'bottom'"
      :read-only="resolvedReadOnly"
      :status="kernel.status.value"
      :active-cell-type="activeCellType"
      :cell-types="resolvedCellTypes"
      :locale="locale"
      @add-cell="addCell"
      @delete-active="deleteActiveCell"
      @set-cell-type="setActiveCellType"
      @run-active="executeActiveCell()"
      @run-all="executeAllCells"
      @restart-kernel="restartKernel"
      @interrupt="interrupt"
      @clear-outputs="clearOutputs"
    >
      <template v-if="slots['bar-prepend']" #bar-prepend><slot name="bar-prepend" /></template>
      <template v-if="slots['bar-left']" #bar-left><slot name="bar-left" /></template>
      <template v-if="slots['bar-center']" #bar-center><slot name="bar-center" /></template>
      <template v-if="slots['bar-right']" #bar-right><slot name="bar-right" /></template>
      <template v-if="slots['bar-append']" #bar-append><slot name="bar-append" /></template>
    </EditorBar>
  </div>
</template>

<style scoped>
.vuepyter-root {
  display: grid;
  gap: 0.75rem;
  background: var(--vuepyter-bg);
  color: var(--vuepyter-text);
  font-family: var(--vuepyter-font-mono);
  font-size: var(--vuepyter-font-size);
  border-radius: 0.5rem;
  padding: 0.75rem;
}
</style>
