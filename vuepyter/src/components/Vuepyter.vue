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
import { cloneNotebookCell } from '../utils/nbformat'
import type {
  CellType,
  CodeEditorProps,
  KernelUpdateMode,
  KeymapConfig,
  NotebookCell,
  SerializedNotebookDocument,
  VuepyterLoadingOverlay,
  VuepyterLoadingPhase,
  VuepyterModelValue,
} from '../types'
import EditorBar from './EditorBar.vue'
import Notebook from './Notebook.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: VuepyterModelValue | null
    pyodideUrl?: string
    pyodidePackages?: string[]
    pyodideInitCode?: string
    preamble?: string
    kernelUpdateMode?: KernelUpdateMode
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
    loading?: boolean
    loadingOverlay?: VuepyterLoadingOverlay
    loadingText?: string
    loadingBlockInteraction?: boolean
  }>(),
  {
    modelValue: null,
    pyodideUrl: DEFAULT_PYODIDE_URL,
    pyodidePackages: () => [],
    pyodideInitCode: '',
    preamble: '',
    kernelUpdateMode: 'after-execution',
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
    loading: false,
    loadingOverlay: 'auto',
    loadingText: 'Loading notebook...',
    loadingBlockInteraction: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [document: SerializedNotebookDocument]
  ready: [payload: { pyodide: unknown; workspace: { value: Record<string, unknown> } }]
  'cell:execute': [payload: { cellId: string; source: string }]
  'cell:complete': [payload: { cellId: string; outputs: unknown[]; error?: Error }]
  'workspace:sync': [payload: { workspace: Record<string, unknown>; mode: KernelUpdateMode }]
  'kernel:update-mode': [payload: { mode: KernelUpdateMode }]
  'shortcuts:help': []
  error: [payload: { type: string; message: string; detail?: unknown }]
}>()

const activeCellIndex = ref(0)
const pendingAutosave = ref(false)
const clipboardCell = ref<NotebookCell | null>(null)
const slots = useSlots()
const resolvedReadOnly = computed(() => props.readOnly ?? false)
const resolvedCellTypes = computed(() => props.cellTypes ?? DEFAULT_CELL_TYPES)
const resolvedMaxOutputHeight = computed(() => props.maxOutputHeight ?? 400)
const kernelUpdateMode = ref<KernelUpdateMode>(
  props.kernelUpdateMode === 'always-live' ? 'always-live' : 'after-execution',
)

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
  preamble: props.preamble,
  getWorkspaceUpdateMode: () => kernelUpdateMode.value,
  onReady: ({ pyodide }) => {
    emit('ready', {
      pyodide,
      workspace: kernel.workspace,
    })
  },
  onWorkspaceSync: ({ workspace }) => {
    emit('workspace:sync', {
      workspace,
      mode: kernelUpdateMode.value,
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

const resolvedLoadingOverlay = computed<VuepyterLoadingOverlay>(() => {
  const mode = props.loadingOverlay
  if (mode === 'always' || mode === 'never') {
    return mode
  }
  return 'auto'
})

const isExternalLoading = computed(() => props.loading === true)
const isKernelLoading = computed(() => kernel.status.value === 'loading')
const loadingOverlayBlocksInteraction = computed(() => props.loadingBlockInteraction ?? true)

// Overlay phase priority: explicit mode -> external loading -> kernel loading.
const loadingPhase = computed<VuepyterLoadingPhase | null>(() => {
  if (resolvedLoadingOverlay.value === 'always') {
    return 'always'
  }
  if (resolvedLoadingOverlay.value === 'never') {
    return null
  }
  if (isExternalLoading.value) {
    return 'external'
  }
  if (isKernelLoading.value) {
    return 'kernel'
  }
  return null
})

const activeLoadingPhase = computed<VuepyterLoadingPhase>(() => loadingPhase.value ?? 'external')
const showLoadingOverlay = computed(() => loadingPhase.value !== null)
const resolvedLoadingText = computed(() => {
  const customText = props.loadingText?.trim()
  if (customText) {
    return customText
  }
  return 'Loading notebook...'
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
const notebookMetadata = computed<Record<string, unknown>>(() => {
  const metadata = notebookModel.notebook.value.metadata
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata
  }
  return {}
})
const notebookTitle = computed(() => {
  const title = notebookMetadata.value.title
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return 'Untitled.ipynb'
})
const trusted = computed(() => {
  const trustedFlag = notebookMetadata.value.trusted
  if (typeof trustedFlag === 'boolean') {
    return trustedFlag
  }
  return true
})
const kernelName = computed(() => props.locale?.kernelName ?? 'Python (Pyodide)')

let emitDebounceTimer: ReturnType<typeof setTimeout> | null = null
let autosaveTimer: ReturnType<typeof setInterval> | null = null

const serializeNotebook = (): SerializedNotebookDocument => notebookModel.serialize()

const flushModelValue = (nextDocument?: SerializedNotebookDocument) => {
  pendingAutosave.value = false
  emit('update:modelValue', nextDocument ?? serializeNotebook())
}

const scheduleModelValueEmit = () => {
  pendingAutosave.value = true
  // In manual mode we debounce model emits; interval mode is handled by setupAutosave.
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
    // Avoid serializing unchanged notebooks at every tick.
    if (pendingAutosave.value) {
      flushModelValue()
    }
  }, props.autosaveInterval)
}

const clampIndex = (index: number) => Math.max(0, Math.min(index, notebookModel.cells.value.length - 1))

const updateNotebookMetadata = (patch: Record<string, unknown>) => {
  notebookModel.notebook.value = {
    ...notebookModel.notebook.value,
    metadata: {
      ...notebookMetadata.value,
      ...patch,
    },
  }
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
    // Keep internal normalized notebook synced with external v-model replacement.
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

watch(
  () => props.kernelUpdateMode,
  (mode) => {
    kernelUpdateMode.value = mode === 'always-live' ? 'always-live' : 'after-execution'
  },
)

watch(
  () => notebookModel.cells.value.length,
  (length) => {
    if (length <= 0) {
      activeCellIndex.value = 0
      return
    }
    activeCellIndex.value = clampIndex(activeCellIndex.value)
  },
)

const addCell = (type: CellType) => {
  const insertIndex = Math.min(activeCellIndex.value + 1, notebookModel.cells.value.length)
  notebookModel.addCell(insertIndex, type)
  activeCellIndex.value = clampIndex(insertIndex)
}

const addCellAbove = (type: CellType = 'code') => {
  const insertIndex = Math.max(0, activeCellIndex.value)
  notebookModel.addCell(insertIndex, type)
  activeCellIndex.value = clampIndex(insertIndex)
}

const deleteActiveCell = () => {
  if (resolvedReadOnly.value) {
    return
  }
  const cell = notebookModel.cells.value[activeCellIndex.value]
  if (!cell) {
    return
  }
  notebookModel.removeCell(cell.id)
  activeCellIndex.value = clampIndex(activeCellIndex.value)
}

const setActiveCellType = (type: CellType) => {
  if (resolvedReadOnly.value) {
    return
  }
  const cell = notebookModel.cells.value[activeCellIndex.value]
  if (!cell) {
    return
  }
  notebookModel.setCellType(cell.id, type)
}

const copyActiveCell = () => {
  const cell = activeCell.value
  if (!cell) {
    return
  }
  clipboardCell.value = cloneNotebookCell(cell, { resetCodeExecutionState: true })
}

const cutActiveCell = () => {
  if (resolvedReadOnly.value) {
    return
  }
  copyActiveCell()
  deleteActiveCell()
}

const pasteCellAt = (index: number) => {
  if (resolvedReadOnly.value || !clipboardCell.value) {
    return
  }
  const safeIndex = Math.max(0, Math.min(index, notebookModel.cells.value.length))
  const pastedCell = cloneNotebookCell(clipboardCell.value, {
    preserveId: false,
    resetCodeExecutionState: true,
  })
  notebookModel.insertCell(pastedCell, safeIndex)
  activeCellIndex.value = clampIndex(safeIndex)
}

const pasteCellBelow = () => {
  pasteCellAt(activeCellIndex.value + 1)
}

const pasteCellAbove = () => {
  pasteCellAt(activeCellIndex.value)
}

const duplicateActiveCell = () => {
  copyActiveCell()
  pasteCellBelow()
}

const moveActiveCellBy = (delta: number) => {
  if (resolvedReadOnly.value) {
    return
  }
  const from = activeCellIndex.value
  const to = clampIndex(from + delta)
  if (from === to || notebookModel.cells.value.length <= 1) {
    return
  }
  notebookModel.moveCell(from, to)
  activeCellIndex.value = to
}

const moveActiveCellUp = () => {
  moveActiveCellBy(-1)
}

const moveActiveCellDown = () => {
  moveActiveCellBy(1)
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
  // Notebook model stores rendered outputs; kernel returns canonical execution payloads.
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
  if (activeCell.value?.cell_type === 'markdown') {
    if (advance) {
      const nextIndex = activeCellIndex.value + 1
      if (nextIndex >= notebookModel.cells.value.length) {
        notebookModel.addCell(notebookModel.cells.value.length, 'code')
        activeCellIndex.value = notebookModel.cells.value.length - 1
      } else {
        activeCellIndex.value = nextIndex
      }
    }
    return
  }

  await executeCell(activeCellIndex.value)
  if (advance) {
    const nextIndex = activeCellIndex.value + 1
    if (nextIndex >= notebookModel.cells.value.length) {
      notebookModel.addCell(notebookModel.cells.value.length, 'code')
      activeCellIndex.value = notebookModel.cells.value.length - 1
    } else {
      activeCellIndex.value = nextIndex
    }
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

const restartRunAll = async () => {
  await restartKernel()
  await executeAllCells()
}

const setKernelUpdateMode = (mode: KernelUpdateMode) => {
  const normalized: KernelUpdateMode = mode === 'always-live' ? 'always-live' : 'after-execution'
  if (kernelUpdateMode.value === normalized) {
    return
  }
  kernelUpdateMode.value = normalized
  emit('kernel:update-mode', { mode: normalized })
}

defineExpose({
  executeAllCells,
  setKernelUpdateMode,
  getKernelUpdateMode: () => kernelUpdateMode.value,
})

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

const resolveDownloadFilename = () => {
  const baseName = notebookTitle.value.trim() || 'Untitled.ipynb'
  const sanitized = baseName.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').trim() || 'Untitled.ipynb'
  return /\.ipynb$/iu.test(sanitized) ? sanitized : `${sanitized}.ipynb`
}

const downloadNotebook = (documentData: SerializedNotebookDocument) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return
  }

  const payload = `${JSON.stringify(documentData, null, 2)}\n`
  const blob = new Blob([payload], { type: 'application/x-ipynb+json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = resolveDownloadFilename()
  anchor.rel = 'noopener'
  anchor.style.display = 'none'

  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  if (typeof URL.revokeObjectURL === 'function') {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}

const saveNotebook = () => {
  const snapshot = serializeNotebook()
  flushModelValue(snapshot)
  downloadNotebook(snapshot)
}

const renameNotebook = (nextTitle: string) => {
  const normalized = nextTitle.trim()
  if (!normalized) {
    return
  }
  updateNotebookMetadata({ title: normalized })
}

const toggleTrust = () => {
  updateNotebookMetadata({ trusted: !trusted.value })
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

const onCellMetadata = (payload: { index: number; metadata: Record<string, unknown> }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }
  notebookModel.updateCell(cell.id, {
    metadata: payload.metadata,
  })
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

const onCellTag = (payload: { index: number }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }

  const metadata =
    cell.metadata && typeof cell.metadata === 'object' && !Array.isArray(cell.metadata)
      ? { ...(cell.metadata as Record<string, unknown>) }
      : {}

  const tags = Array.isArray(metadata.tags) ? metadata.tags.map((tag) => String(tag)) : []
  if (tags.includes('tag')) {
    return
  }

  notebookModel.updateCell(cell.id, {
    metadata: {
      ...metadata,
      tags: [...tags, 'tag'],
    },
  })
}

const onCellExecute = async (payload: { index: number; advance: boolean; insertBelow?: boolean }) => {
  const cell = notebookModel.cells.value[payload.index]
  if (!cell) {
    return
  }

  activeCellIndex.value = payload.index
  if (cell.cell_type === 'code') {
    await executeCell(payload.index)
  }

  if (payload.insertBelow) {
    const insertIndex = Math.min(payload.index + 1, notebookModel.cells.value.length)
    notebookModel.addCell(insertIndex, 'code')
    activeCellIndex.value = insertIndex
    return
  }

  if (payload.advance) {
    const nextIndex = payload.index + 1
    if (nextIndex >= notebookModel.cells.value.length) {
      notebookModel.addCell(notebookModel.cells.value.length, 'code')
      activeCellIndex.value = notebookModel.cells.value.length - 1
      return
    }
    activeCellIndex.value = nextIndex
  }
}
</script>

<template>
  <div class="vuepyter-root" :style="themeStyle">
    <div class="vuepyter-canvas">
      <EditorBar
        v-if="showEditorBar && editorBarPosition === 'top'"
        :read-only="resolvedReadOnly"
        :status="kernel.status.value"
        :trusted="trusted"
        :notebook-title="notebookTitle"
        :kernel-name="kernelName"
        :kernel-update-mode="kernelUpdateMode"
        :active-cell-type="activeCellType"
        :cell-types="resolvedCellTypes"
        :locale="locale"
        @save="saveNotebook"
        @add-cell="addCell"
        @add-cell-above="addCellAbove"
        @delete-active="deleteActiveCell"
        @set-cell-type="setActiveCellType"
        @run-active="executeActiveCell()"
        @run-and-advance="executeActiveCell(true)"
        @run-all="executeAllCells"
        @restart-kernel="restartKernel"
        @restart-run-all="restartRunAll"
        @set-kernel-update-mode="setKernelUpdateMode"
        @interrupt="interrupt"
        @clear-outputs="clearOutputs"
        @copy-active="copyActiveCell"
        @cut-active="cutActiveCell"
        @paste-below="pasteCellBelow"
        @paste-above="pasteCellAbove"
        @move-cell-up="moveActiveCellUp"
        @move-cell-down="moveActiveCellDown"
        @duplicate-active="duplicateActiveCell"
        @toggle-trust="toggleTrust"
        @show-shortcuts="emit('shortcuts:help')"
        @rename-notebook="renameNotebook"
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
        @cell-metadata="onCellMetadata"
        @cell-add="onCellAdd"
        @cell-delete="onCellDelete"
        @cell-move="onCellMove"
        @cell-tag="onCellTag"
        @cell-type="onCellType"
        @cell-execute="onCellExecute"
        @interrupt="interrupt"
        @restart-kernel="restartKernel"
        @show-shortcuts="emit('shortcuts:help')"
        @save="saveNotebook"
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
        :trusted="trusted"
        :notebook-title="notebookTitle"
        :kernel-name="kernelName"
        :kernel-update-mode="kernelUpdateMode"
        :active-cell-type="activeCellType"
        :cell-types="resolvedCellTypes"
        :locale="locale"
        @save="saveNotebook"
        @add-cell="addCell"
        @add-cell-above="addCellAbove"
        @delete-active="deleteActiveCell"
        @set-cell-type="setActiveCellType"
        @run-active="executeActiveCell()"
        @run-and-advance="executeActiveCell(true)"
        @run-all="executeAllCells"
        @restart-kernel="restartKernel"
        @restart-run-all="restartRunAll"
        @set-kernel-update-mode="setKernelUpdateMode"
        @interrupt="interrupt"
        @clear-outputs="clearOutputs"
        @copy-active="copyActiveCell"
        @cut-active="cutActiveCell"
        @paste-below="pasteCellBelow"
        @paste-above="pasteCellAbove"
        @move-cell-up="moveActiveCellUp"
        @move-cell-down="moveActiveCellDown"
        @duplicate-active="duplicateActiveCell"
        @toggle-trust="toggleTrust"
        @show-shortcuts="emit('shortcuts:help')"
        @rename-notebook="renameNotebook"
      >
        <template v-if="slots['bar-prepend']" #bar-prepend><slot name="bar-prepend" /></template>
        <template v-if="slots['bar-left']" #bar-left><slot name="bar-left" /></template>
        <template v-if="slots['bar-center']" #bar-center><slot name="bar-center" /></template>
        <template v-if="slots['bar-right']" #bar-right><slot name="bar-right" /></template>
        <template v-if="slots['bar-append']" #bar-append><slot name="bar-append" /></template>
      </EditorBar>

      <div
        v-if="showLoadingOverlay"
        class="vuepyter-loading-overlay"
        :class="{ 'is-pass-through': !loadingOverlayBlocksInteraction }"
        :aria-busy="showLoadingOverlay"
      >
        <slot
          name="loading"
          :phase="activeLoadingPhase"
          :text="resolvedLoadingText"
          :status="kernel.status.value"
          :blocking="loadingOverlayBlocksInteraction"
        >
          <div class="vuepyter-loading-indicator" role="status" aria-live="polite">
            <span class="vuepyter-loading-spinner" aria-hidden="true" />
            <span class="vuepyter-loading-text">{{ resolvedLoadingText }}</span>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vuepyter-root {
  min-height: 100%;
  overflow: auto;
  background: var(--vuepyter-bg);
  color: var(--vuepyter-text);
  font-family: var(--vuepyter-font-mono);
  font-size: var(--vuepyter-font-size);
  border-radius: 0.5rem;
  padding: 0.75rem;
  box-sizing: border-box;
}

.vuepyter-canvas {
  display: grid;
  gap: 0.75rem;
  width: min(100%, var(--vuepyter-content-max-width, 1040px));
  margin: 0 auto;
  position: relative;
}

.vuepyter-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--vuepyter-bg) 60%, transparent);
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
  pointer-events: auto;
}

.vuepyter-loading-overlay.is-pass-through {
  pointer-events: none;
}

.vuepyter-loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 70%, transparent);
  background: color-mix(in srgb, var(--vuepyter-cell-bg) 86%, transparent);
  color: var(--vuepyter-text-secondary);
  box-shadow: 0 10px 24px rgb(15 23 42 / 18%);
}

.vuepyter-loading-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--vuepyter-text-secondary) 30%, transparent);
  border-top-color: var(--vuepyter-text);
  animation: vuepyter-spin 0.9s linear infinite;
}

.vuepyter-loading-text {
  font-size: 0.82rem;
  white-space: nowrap;
}

@keyframes vuepyter-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
