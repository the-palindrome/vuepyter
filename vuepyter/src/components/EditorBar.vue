<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Copy,
  FastForward,
  FilePenLine,
  Play,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  SkipForward,
  Square,
  Trash2,
} from 'lucide-vue-next'
import type { CellType, KernelStatus } from '../types'

type MenuId = 'file' | 'edit' | 'run' | 'kernel'
type MenuAction =
  | 'save'
  | 'renameNotebook'
  | 'addCodeCellBelow'
  | 'addMarkdownCellBelow'
  | 'addRawCellBelow'
  | 'addCodeCellAbove'
  | 'deleteActive'
  | 'cutActive'
  | 'copyActive'
  | 'pasteBelow'
  | 'pasteAbove'
  | 'moveCellUp'
  | 'moveCellDown'
  | 'setCellTypeCode'
  | 'setCellTypeMarkdown'
  | 'setCellTypeRaw'
  | 'runActive'
  | 'runAndAdvance'
  | 'runAll'
  | 'clearOutputs'
  | 'interrupt'
  | 'restartKernel'
  | 'restartRunAll'
  | 'toggleTrust'
  | 'showShortcuts'
  | 'duplicateActive'

interface MenuItem {
  id: string
  label?: string
  action?: MenuAction
  separator?: boolean
  disabled?: boolean
}

interface MenuDefinition {
  id: MenuId
  label: string
  items: MenuItem[]
}

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
    status?: KernelStatus
    activeCellType?: CellType
    cellTypes?: CellType[]
    locale?: Record<string, string>
    notebookTitle?: string
    trusted?: boolean
    kernelName?: string
  }>(),
  {
    readOnly: false,
    status: 'loading',
    activeCellType: 'code',
    cellTypes: () => ['code', 'markdown', 'raw'],
    locale: () => ({}),
    notebookTitle: 'Untitled.ipynb',
    trusted: true,
    kernelName: 'Python (Pyodide)',
  },
)

const emit = defineEmits<{
  save: []
  addCell: [type: CellType]
  addCellAbove: [type: CellType]
  deleteActive: []
  setCellType: [type: CellType]
  runActive: []
  runAndAdvance: []
  runAll: []
  restartKernel: []
  restartRunAll: []
  interrupt: []
  clearOutputs: []
  cutActive: []
  copyActive: []
  pasteBelow: []
  pasteAbove: []
  moveCellUp: []
  moveCellDown: []
  toggleTrust: []
  showShortcuts: []
  duplicateActive: []
  renameNotebook: [title: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const openMenu = ref<MenuId | null>(null)
const isRenaming = ref(false)
const titleDraft = ref(props.notebookTitle)

const resolvedReadOnly = computed(() => props.readOnly ?? false)
const resolvedTitle = computed(() => props.notebookTitle?.trim() || 'Untitled.ipynb')
const resolvedKernelName = computed(() => props.kernelName?.trim() || 'Python (Pyodide)')
const resolvedCellTypes = computed<CellType[]>(() =>
  props.cellTypes?.length ? props.cellTypes : ['code', 'markdown', 'raw'],
)
const activeCellType = computed<CellType>(() => {
  const requestedType = props.activeCellType ?? 'code'
  return resolvedCellTypes.value.includes(requestedType) ? requestedType : resolvedCellTypes.value[0] ?? 'code'
})
const trusted = computed(() => props.trusted ?? true)

const labels = computed(() => ({
  addCodeCell: props.locale?.addCodeCell ?? 'Add code cell',
  addMarkdownCell: props.locale?.addMarkdownCell ?? 'Add markdown cell',
  addRawCell: props.locale?.addRawCell ?? 'Add raw cell',
  addCodeCellAbove: props.locale?.addCodeCellAbove ?? 'Add code cell above',
  deleteCell: props.locale?.deleteCell ?? 'Delete cell',
  runCell: props.locale?.runCell ?? 'Run cell',
  runCellAdvance: props.locale?.runCellAdvance ?? 'Run cell and select next',
  runAllCells: props.locale?.runAllCells ?? 'Run all cells',
  restartKernel: props.locale?.restartKernel ?? 'Restart kernel',
  restartRunAll: props.locale?.restartRunAll ?? 'Restart kernel and run all cells',
  interruptKernel: props.locale?.interruptKernel ?? 'Interrupt kernel',
  clearAllOutputs: props.locale?.clearAllOutputs ?? 'Clear all outputs',
  statusLoading: props.locale?.kernelLoading ?? props.locale?.statusLoading ?? 'Loading',
  statusReady: props.locale?.kernelReady ?? props.locale?.statusReady ?? 'Ready',
  statusBusy: props.locale?.kernelBusy ?? props.locale?.statusBusy ?? 'Busy',
  statusError: props.locale?.kernelError ?? props.locale?.statusError ?? 'Error',
  cellTypeCode: props.locale?.cellTypeCode ?? 'Code',
  cellTypeMarkdown: props.locale?.cellTypeMarkdown ?? 'Markdown',
  cellTypeRaw: props.locale?.cellTypeRaw ?? 'Raw',
}))

const statusText = computed(() => {
  switch (props.status) {
    case 'ready':
      return labels.value.statusReady
    case 'busy':
      return labels.value.statusBusy
    case 'error':
      return labels.value.statusError
    case 'loading':
    default:
      return labels.value.statusLoading
  }
})

const statusClass = computed(() => `is-${props.status ?? 'loading'}`)
const trustedLabel = computed(() => (trusted.value ? 'Trusted' : 'Not Trusted'))

const menuDefinitions = computed<MenuDefinition[]>(() => [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'file-save', label: 'Save Notebook', action: 'save' },
      {
        id: 'file-rename',
        label: 'Rename Notebook',
        action: 'renameNotebook',
        disabled: resolvedReadOnly.value,
      },
      { id: 'file-separator-a', separator: true },
      {
        id: 'file-add-code-below',
        label: labels.value.addCodeCell,
        action: 'addCodeCellBelow',
        disabled: resolvedReadOnly.value,
      },
      {
        id: 'file-add-markdown-below',
        label: labels.value.addMarkdownCell,
        action: 'addMarkdownCellBelow',
        disabled: resolvedReadOnly.value,
      },
      {
        id: 'file-add-raw-below',
        label: labels.value.addRawCell,
        action: 'addRawCellBelow',
        disabled: resolvedReadOnly.value,
      },
      {
        id: 'file-add-code-above',
        label: labels.value.addCodeCellAbove,
        action: 'addCodeCellAbove',
        disabled: resolvedReadOnly.value,
      },
      {
        id: 'file-duplicate',
        label: 'Duplicate Cell',
        action: 'duplicateActive',
        disabled: resolvedReadOnly.value,
      },
      {
        id: 'file-delete',
        label: labels.value.deleteCell,
        action: 'deleteActive',
        disabled: resolvedReadOnly.value,
      },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'edit-cut', label: 'Cut Cell', action: 'cutActive', disabled: resolvedReadOnly.value },
      { id: 'edit-copy', label: 'Copy Cell', action: 'copyActive' },
      { id: 'edit-paste-below', label: 'Paste Cell Below', action: 'pasteBelow', disabled: resolvedReadOnly.value },
      { id: 'edit-paste-above', label: 'Paste Cell Above', action: 'pasteAbove', disabled: resolvedReadOnly.value },
      { id: 'edit-separator-a', separator: true },
      { id: 'edit-move-up', label: 'Move Cell Up', action: 'moveCellUp', disabled: resolvedReadOnly.value },
      { id: 'edit-move-down', label: 'Move Cell Down', action: 'moveCellDown', disabled: resolvedReadOnly.value },
      { id: 'edit-separator-b', separator: true },
      { id: 'edit-type-code', label: labels.value.cellTypeCode, action: 'setCellTypeCode', disabled: resolvedReadOnly.value },
      {
        id: 'edit-type-markdown',
        label: labels.value.cellTypeMarkdown,
        action: 'setCellTypeMarkdown',
        disabled: resolvedReadOnly.value,
      },
      { id: 'edit-type-raw', label: labels.value.cellTypeRaw, action: 'setCellTypeRaw', disabled: resolvedReadOnly.value },
    ],
  },
  {
    id: 'run',
    label: 'Run',
    items: [
      { id: 'run-active', label: labels.value.runCell, action: 'runActive' },
      { id: 'run-advance', label: labels.value.runCellAdvance, action: 'runAndAdvance' },
      { id: 'run-all', label: labels.value.runAllCells, action: 'runAll' },
      { id: 'run-clear', label: labels.value.clearAllOutputs, action: 'clearOutputs' },
    ],
  },
  {
    id: 'kernel',
    label: 'Kernel',
    items: [
      { id: 'kernel-interrupt', label: labels.value.interruptKernel, action: 'interrupt' },
      { id: 'kernel-restart', label: labels.value.restartKernel, action: 'restartKernel' },
      { id: 'kernel-restart-run-all', label: labels.value.restartRunAll, action: 'restartRunAll' },
    ],
  },
])

const onGlobalPointerDown = (event: MouseEvent) => {
  if (!rootRef.value) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }
  if (!rootRef.value.contains(target)) {
    openMenu.value = null
    if (isRenaming.value) {
      isRenaming.value = false
      titleDraft.value = resolvedTitle.value
    }
  }
}

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return
  }
  openMenu.value = null
  if (isRenaming.value) {
    event.preventDefault()
    isRenaming.value = false
    titleDraft.value = resolvedTitle.value
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  document.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  document.removeEventListener('keydown', onGlobalKeydown)
})

watch(
  () => props.notebookTitle,
  (title) => {
    if (!isRenaming.value) {
      titleDraft.value = title || ''
    }
  },
)

const toggleMenu = (id: MenuId) => {
  openMenu.value = openMenu.value === id ? null : id
}

const closeMenus = () => {
  openMenu.value = null
}

const beginRename = async () => {
  if (resolvedReadOnly.value) {
    return
  }
  closeMenus()
  isRenaming.value = true
  titleDraft.value = resolvedTitle.value
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

const submitRename = () => {
  const nextTitle = titleDraft.value.trim()
  isRenaming.value = false
  if (!nextTitle || nextTitle === resolvedTitle.value) {
    titleDraft.value = resolvedTitle.value
    return
  }
  emit('renameNotebook', nextTitle)
}

const cancelRename = () => {
  isRenaming.value = false
  titleDraft.value = resolvedTitle.value
}

const runMenuAction = (action: MenuAction) => {
  switch (action) {
    case 'save':
      emit('save')
      break
    case 'renameNotebook':
      void beginRename()
      break
    case 'addCodeCellBelow':
      emit('addCell', 'code')
      break
    case 'addMarkdownCellBelow':
      emit('addCell', 'markdown')
      break
    case 'addRawCellBelow':
      emit('addCell', 'raw')
      break
    case 'addCodeCellAbove':
      emit('addCellAbove', 'code')
      break
    case 'deleteActive':
      emit('deleteActive')
      break
    case 'cutActive':
      emit('cutActive')
      break
    case 'copyActive':
      emit('copyActive')
      break
    case 'pasteBelow':
      emit('pasteBelow')
      break
    case 'pasteAbove':
      emit('pasteAbove')
      break
    case 'moveCellUp':
      emit('moveCellUp')
      break
    case 'moveCellDown':
      emit('moveCellDown')
      break
    case 'setCellTypeCode':
      emit('setCellType', 'code')
      break
    case 'setCellTypeMarkdown':
      emit('setCellType', 'markdown')
      break
    case 'setCellTypeRaw':
      emit('setCellType', 'raw')
      break
    case 'runActive':
      emit('runActive')
      break
    case 'runAndAdvance':
      emit('runAndAdvance')
      break
    case 'runAll':
      emit('runAll')
      break
    case 'clearOutputs':
      emit('clearOutputs')
      break
    case 'interrupt':
      emit('interrupt')
      break
    case 'restartKernel':
      emit('restartKernel')
      break
    case 'restartRunAll':
      emit('restartRunAll')
      break
    case 'toggleTrust':
      emit('toggleTrust')
      break
    case 'showShortcuts':
      emit('showShortcuts')
      break
    case 'duplicateActive':
      emit('duplicateActive')
      break
    default:
      break
  }
}

const selectMenuAction = (item: MenuItem) => {
  if (item.disabled || !item.action) {
    return
  }
  if (item.action !== 'renameNotebook') {
    closeMenus()
  }
  runMenuAction(item.action)
}

const onCellTypeChange = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }
  const nextType = target.value as CellType
  emit('setCellType', nextType)
}
</script>

<template>
  <div ref="rootRef" class="vuepyter-editorbar">
    <slot name="bar-prepend" />

    <header class="vuepyter-editorbar-row top-row">
      <div class="identity-wrap">
        <div class="brand-wrap" aria-hidden="true">
          <span class="brand-icon"></span>
          <span class="brand-wordmark">Vuepyter</span>
        </div>

        <button
          v-if="!isRenaming"
          class="title-button"
          type="button"
          :disabled="resolvedReadOnly"
          data-testid="title-button"
          :title="resolvedReadOnly ? resolvedTitle : 'Rename notebook'"
          @dblclick.prevent="beginRename"
          @click.prevent="beginRename"
        >
          {{ resolvedTitle }}
        </button>
        <input
          v-else
          ref="titleInputRef"
          v-model="titleDraft"
          class="title-input"
          type="text"
          data-testid="title-input"
          @keydown.enter.prevent="submitRename"
          @keydown.esc.prevent="cancelRename"
          @blur="submitRename"
        />

        <slot name="bar-left" />
      </div>

      <div class="identity-meta">
        <button
          type="button"
          class="trusted-pill"
          data-testid="trusted-button"
          :title="trustedLabel"
          @click="emit('toggleTrust')"
        >
          {{ trustedLabel }}
        </button>
        <span class="kernel-state-text">{{ statusText }}</span>
      </div>
    </header>

    <nav class="vuepyter-editorbar-row menu-row" aria-label="Notebook menus">
      <div
        v-for="menu in menuDefinitions"
        :key="menu.id"
        class="menu-group"
      >
        <button
          type="button"
          class="menu-trigger"
          :data-testid="`menu-${menu.id}`"
          :aria-expanded="openMenu === menu.id"
          :aria-controls="`menu-${menu.id}-panel`"
          @click="toggleMenu(menu.id)"
        >
          {{ menu.label }}
        </button>

        <div
          v-if="openMenu === menu.id"
          :id="`menu-${menu.id}-panel`"
          class="menu-panel"
          role="menu"
        >
          <template v-for="item in menu.items" :key="item.id">
            <div v-if="item.separator" class="menu-separator" role="separator"></div>
            <button
              v-else
              type="button"
              class="menu-item"
              :data-testid="`menu-item-${item.id}`"
              :disabled="item.disabled"
              role="menuitem"
              @click="selectMenuAction(item)"
            >
              {{ item.label }}
            </button>
          </template>
        </div>
      </div>
    </nav>

    <div class="vuepyter-editorbar-row toolbar-row">
      <div class="toolbar-group">
        <button
          type="button"
          class="toolbar-btn"
          title="Save notebook"
          aria-label="Save notebook"
          data-testid="toolbar-save"
          @click="emit('save')"
        >
          <Save :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          :title="labels.addCodeCell"
          :aria-label="labels.addCodeCell"
          data-testid="toolbar-add-below"
          @click="emit('addCell', 'code')"
        >
          <Plus :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          :title="labels.addCodeCellAbove"
          :aria-label="labels.addCodeCellAbove"
          data-testid="toolbar-add-above"
          @click="emit('addCellAbove', 'code')"
        >
          <FilePenLine :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          title="Cut cell"
          aria-label="Cut cell"
          data-testid="toolbar-cut"
          @click="emit('cutActive')"
        >
          <Scissors :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          title="Copy cell"
          aria-label="Copy cell"
          data-testid="toolbar-copy"
          @click="emit('copyActive')"
        >
          <Copy :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          title="Paste cell below"
          aria-label="Paste cell below"
          data-testid="toolbar-paste"
          @click="emit('pasteBelow')"
        >
          <ClipboardPaste :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <button
          type="button"
          class="toolbar-btn"
          :title="labels.runCell"
          :aria-label="labels.runCell"
          data-testid="toolbar-run"
          @click="emit('runActive')"
        >
          <Play :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :title="labels.runCellAdvance"
          :aria-label="labels.runCellAdvance"
          data-testid="toolbar-run-advance"
          @click="emit('runAndAdvance')"
        >
          <SkipForward :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :title="labels.interruptKernel"
          :aria-label="labels.interruptKernel"
          data-testid="toolbar-interrupt"
          @click="emit('interrupt')"
        >
          <Square :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :title="labels.restartKernel"
          :aria-label="labels.restartKernel"
          data-testid="toolbar-restart"
          @click="emit('restartKernel')"
        >
          <RotateCcw :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :title="labels.runAllCells"
          :aria-label="labels.runAllCells"
          data-testid="toolbar-run-all"
          @click="emit('runAll')"
        >
          <FastForward :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <span class="toolbar-divider" aria-hidden="true"></span>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          title="Move cell up"
          aria-label="Move cell up"
          data-testid="toolbar-move-up"
          @click="emit('moveCellUp')"
        >
          <ArrowUp :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn"
          :disabled="resolvedReadOnly"
          title="Move cell down"
          aria-label="Move cell down"
          data-testid="toolbar-move-down"
          @click="emit('moveCellDown')"
        >
          <ArrowDown :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="toolbar-btn danger"
          :disabled="resolvedReadOnly"
          :title="labels.deleteCell"
          :aria-label="labels.deleteCell"
          data-testid="toolbar-delete"
          @click="emit('deleteActive')"
        >
          <Trash2 :size="15" :stroke-width="1.9" aria-hidden="true" />
        </button>
      </div>

      <div class="toolbar-meta">
        <slot name="bar-center" />

        <label class="cell-type-wrap">
          <span class="sr-only">Cell type</span>
          <select
            class="cell-type-select"
            data-testid="cell-type-select"
            :disabled="resolvedReadOnly"
            :value="activeCellType"
            @change="onCellTypeChange"
          >
            <option
              v-for="cellType in resolvedCellTypes"
              :key="cellType"
              :value="cellType"
            >
              {{
                cellType === 'code'
                  ? labels.cellTypeCode
                  : cellType === 'markdown'
                    ? labels.cellTypeMarkdown
                    : labels.cellTypeRaw
              }}
            </option>
          </select>
        </label>

        <span class="kernel-label" data-testid="kernel-name">{{ resolvedKernelName }}</span>
        <span class="kernel-dot" :class="statusClass" aria-hidden="true"></span>

        <slot name="bar-right" />
      </div>
    </div>

    <slot name="bar-append" />
  </div>
</template>

<style scoped>
.vuepyter-editorbar {
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 80%, #d6d8dd);
  border-radius: 0.5rem;
  overflow: visible;
  background: color-mix(in srgb, var(--vuepyter-toolbar-bg) 95%, #ffffff);
  color: var(--vuepyter-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--vuepyter-cell-border) 30%, transparent);
}

.vuepyter-editorbar-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.18rem 0.52rem;
}

.top-row {
  justify-content: space-between;
  min-height: 2rem;
}

.menu-row {
  min-height: 1.85rem;
  border-top: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 62%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 62%, transparent);
  gap: 0.14rem;
  flex-wrap: wrap;
}

.toolbar-row {
  justify-content: space-between;
  min-height: 2.1rem;
}

.identity-wrap {
  display: flex;
  align-items: center;
  gap: 0.52rem;
  min-width: 0;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  margin-right: 0.18rem;
}

.brand-icon {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 999px;
  background: linear-gradient(140deg, #f4d03f, #f39c12);
  box-shadow: 0 0 0 1px rgba(196, 139, 17, 0.55);
}

.brand-wordmark {
  font-size: 1rem;
  font-style: italic;
  color: #5a5a5a;
}

.title-button,
.title-input {
  border: 1px solid transparent;
  border-radius: 0.34rem;
  background: transparent;
  color: var(--vuepyter-text);
  font-size: 0.84rem;
  line-height: 1.2;
  min-height: 1.55rem;
  padding: 0.1rem 0.4rem;
  max-width: min(46vw, 28rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-button {
  cursor: text;
}

.title-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--vuepyter-cell-border) 65%, transparent);
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 30%, transparent);
}

.title-button:disabled {
  cursor: default;
}

.title-input {
  background: color-mix(in srgb, var(--vuepyter-button-bg) 65%, #ffffff);
  border-color: color-mix(in srgb, var(--vuepyter-cell-active-border) 55%, transparent);
  outline: none;
}

.identity-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
}

.trusted-pill {
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 78%, transparent);
  border-radius: 0.28rem;
  padding: 0.08rem 0.4rem;
  min-height: 1.45rem;
  font-size: 0.75rem;
  line-height: 1;
  color: var(--vuepyter-text);
  background: color-mix(in srgb, var(--vuepyter-button-bg) 70%, #ffffff);
  cursor: pointer;
}

.trusted-pill:hover {
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 60%, #ffffff);
}

.kernel-state-text {
  font-size: 0.74rem;
  color: var(--vuepyter-text-secondary);
}

.menu-group {
  position: relative;
}

.menu-trigger {
  border: 1px solid transparent;
  border-radius: 0.28rem;
  background: transparent;
  color: var(--vuepyter-text);
  padding: 0.1rem 0.4rem;
  font-size: 0.84rem;
  line-height: 1.2;
  min-height: 1.5rem;
  cursor: pointer;
}

.menu-trigger:hover,
.menu-trigger[aria-expanded='true'] {
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 55%, #ffffff);
  border-color: color-mix(in srgb, var(--vuepyter-cell-border) 70%, transparent);
}

.menu-panel {
  position: absolute;
  top: calc(100% + 0.18rem);
  left: 0;
  min-width: 13.6rem;
  max-width: min(24rem, 90vw);
  background: color-mix(in srgb, var(--vuepyter-toolbar-bg) 94%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 78%, transparent);
  border-radius: 0.42rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
  padding: 0.22rem;
  z-index: 40;
}

.menu-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--vuepyter-text);
  text-align: left;
  border-radius: 0.35rem;
  padding: 0.32rem 0.5rem;
  font-size: 0.83rem;
  line-height: 1.26;
  cursor: pointer;
}

.menu-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 60%, #ffffff);
}

.menu-item:disabled {
  opacity: 0.54;
  cursor: not-allowed;
}

.menu-separator {
  height: 1px;
  margin: 0.2rem 0.14rem;
  background: color-mix(in srgb, var(--vuepyter-cell-border) 60%, transparent);
}

.toolbar-group,
.toolbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.toolbar-meta {
  gap: 0.38rem;
}

.toolbar-divider {
  width: 1px;
  height: 1.1rem;
  margin: 0 0.16rem;
  background: color-mix(in srgb, var(--vuepyter-cell-border) 65%, transparent);
}

.toolbar-btn {
  width: 1.72rem;
  height: 1.72rem;
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 55%, transparent);
  border-radius: 0.36rem;
  background: color-mix(in srgb, var(--vuepyter-button-bg) 70%, #ffffff);
  color: var(--vuepyter-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.toolbar-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vuepyter-button-hover-bg) 68%, #ffffff);
}

.toolbar-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.toolbar-btn.danger {
  color: color-mix(in srgb, var(--vuepyter-error-color) 86%, #ef4444);
}

.cell-type-wrap {
  display: inline-flex;
}

.cell-type-select {
  min-width: 8.1rem;
  height: 1.72rem;
  border: 1px solid color-mix(in srgb, var(--vuepyter-cell-border) 70%, transparent);
  border-radius: 0.36rem;
  background: color-mix(in srgb, var(--vuepyter-button-bg) 54%, #ffffff);
  color: var(--vuepyter-text);
  padding: 0 0.48rem;
  font-size: 0.82rem;
}

.kernel-label {
  font-size: 0.79rem;
  color: var(--vuepyter-text-secondary);
}

.kernel-dot {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vuepyter-status-ready) 80%, #16a34a);
}

.kernel-dot.is-loading {
  background: color-mix(in srgb, var(--vuepyter-text-secondary) 64%, #94a3b8);
}

.kernel-dot.is-busy {
  background: color-mix(in srgb, var(--vuepyter-status-busy) 86%, #f59e0b);
}

.kernel-dot.is-error {
  background: color-mix(in srgb, var(--vuepyter-status-error) 86%, #ef4444);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .top-row,
  .toolbar-row {
    flex-wrap: wrap;
  }

  .title-button,
  .title-input {
    max-width: min(80vw, 21rem);
  }

  .toolbar-group {
    flex-wrap: wrap;
  }
}
</style>
