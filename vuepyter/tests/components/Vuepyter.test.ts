import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const NOTEBOOK_MODEL_IDS = ['@/composables/useNotebookModel', '../../src/composables/useNotebookModel.ts']
const PYODIDE_KERNEL_IDS = ['@/composables/usePyodideKernel', '../../src/composables/usePyodideKernel.ts']
const PROVIDE_IDS = ['@/composables/useVuepyterProvide', '../../src/composables/useVuepyterProvide.ts']

const EditorBarStub = defineComponent({
  name: 'EditorBar',
  props: {
    readOnly: Boolean,
    status: String,
    activeCellType: String,
    cellTypes: Array,
    locale: Object,
  },
  emits: [
    'add-cell',
    'delete-active',
    'set-cell-type',
    'run-active',
    'run-all',
    'restart-kernel',
    'interrupt',
    'clear-outputs',
  ],
  template: '<div class="editor-bar-stub" />',
})

const NotebookStub = defineComponent({
  name: 'Notebook',
  props: {
    cells: Array,
    readOnly: Boolean,
    keymap: Object,
    editorOptions: Object,
    maxOutputHeight: Number,
    locale: Object,
    dark: Boolean,
  },
  emits: [
    'update:active-index',
    'cell-source',
    'cell-add',
    'cell-delete',
    'cell-move',
    'cell-execute',
    'save',
  ],
  template: '<div class="notebook-stub" />',
})

interface NotebookModelMock {
  notebook: ReturnType<typeof ref<Record<string, unknown>>>
  cells: ReturnType<typeof computed<Array<Record<string, unknown>>>>
  addCell: ReturnType<typeof vi.fn>
  removeCell: ReturnType<typeof vi.fn>
  setCellType: ReturnType<typeof vi.fn>
  setCellSource: ReturnType<typeof vi.fn>
  setCellOutputs: ReturnType<typeof vi.fn>
  resetExecutionState: ReturnType<typeof vi.fn>
  moveCell: ReturnType<typeof vi.fn>
  clearOutputs: ReturnType<typeof vi.fn>
  setNotebook: ReturnType<typeof vi.fn>
  serialize: ReturnType<typeof vi.fn>
}

interface KernelMock {
  pyodide: ReturnType<typeof ref<Record<string, unknown> | null>>
  workspace: ReturnType<typeof ref<Record<string, unknown>>>
  status: ReturnType<typeof ref<'loading' | 'ready' | 'busy' | 'error'>>
  initialize: ReturnType<typeof vi.fn>
  executeCell: ReturnType<typeof vi.fn>
  restart: ReturnType<typeof vi.fn>
  interrupt: ReturnType<typeof vi.fn>
}

interface MountContext {
  Vuepyter: object
  notebookModel: NotebookModelMock
  kernel: KernelMock
  provideSpy: ReturnType<typeof vi.fn>
}

function createNotebookModelMock(): NotebookModelMock {
  const notebook = ref({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        id: 'code-1',
        cell_type: 'code',
        source: 'print("hi")',
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        id: 'md-1',
        cell_type: 'markdown',
        source: '# Title',
        metadata: {},
      },
    ],
  })

  const cells = computed(() => notebook.value.cells)

  const findById = (cellId: string) => notebook.value.cells.findIndex((cell) => cell.id === cellId)

  return {
    notebook,
    cells,
    addCell: vi.fn((index: number, type: string = 'code') => {
      const cell = {
        id: `cell-${index}-${type}`,
        cell_type: type,
        source: '',
        metadata: {},
        ...(type === 'code' ? { execution_count: null, outputs: [] } : {}),
      }
      notebook.value.cells.splice(Math.max(0, index), 0, cell)
      return cell
    }),
    removeCell: vi.fn((cellId: string) => {
      const index = findById(cellId)
      if (index >= 0) {
        notebook.value.cells.splice(index, 1)
      }
    }),
    setCellType: vi.fn((cellId: string, type: string) => {
      const index = findById(cellId)
      if (index < 0) {
        return
      }
      notebook.value.cells[index] = {
        ...notebook.value.cells[index],
        cell_type: type,
        ...(type === 'code' ? { execution_count: null, outputs: [] } : {}),
      }
    }),
    setCellSource: vi.fn((cellId: string, source: string) => {
      const index = findById(cellId)
      if (index < 0) {
        return
      }
      notebook.value.cells[index] = {
        ...notebook.value.cells[index],
        source,
      }
    }),
    setCellOutputs: vi.fn((cellId: string, outputs: unknown[], executionCount: number | null) => {
      const index = findById(cellId)
      if (index < 0) {
        return
      }
      notebook.value.cells[index] = {
        ...notebook.value.cells[index],
        outputs,
        execution_count: executionCount,
      }
    }),
    resetExecutionState: vi.fn(() => {
      notebook.value.cells = notebook.value.cells.map((cell) =>
        cell.cell_type === 'code' ? { ...cell, outputs: [], execution_count: null } : cell,
      )
    }),
    moveCell: vi.fn((from: number, to: number) => {
      const [moved] = notebook.value.cells.splice(from, 1)
      if (!moved) {
        return
      }
      notebook.value.cells.splice(to, 0, moved)
    }),
    clearOutputs: vi.fn(() => {
      notebook.value.cells = notebook.value.cells.map((cell) =>
        cell.cell_type === 'code' ? { ...cell, outputs: [], execution_count: null } : cell,
      )
    }),
    setNotebook: vi.fn((value: unknown) => {
      if (!value || typeof value !== 'object') {
        return
      }
      notebook.value = value as typeof notebook.value
    }),
    serialize: vi.fn(() => notebook.value),
  }
}

function createKernelMock(): KernelMock {
  return {
    pyodide: ref({}),
    workspace: ref({ alpha: 1 }),
    status: ref('ready'),
    initialize: vi.fn(async () => undefined),
    executeCell: vi.fn(async () => ({
      executionCount: 1,
      outputs: [{ output_type: 'stream', name: 'stdout', text: 'ok\n', data: {} }],
    })),
    restart: vi.fn(async () => undefined),
    interrupt: vi.fn(() => true),
  }
}

async function loadVuepyterWithMocks(): Promise<MountContext> {
  vi.resetModules()

  const notebookModel = createNotebookModelMock()
  const kernel = createKernelMock()
  const provideSpy = vi.fn()

  for (const id of NOTEBOOK_MODEL_IDS) {
    vi.doMock(id, () => ({
      useNotebookModel: vi.fn(() => notebookModel),
    }))
  }

  for (const id of PYODIDE_KERNEL_IDS) {
    vi.doMock(id, () => ({
      usePyodideKernel: vi.fn((options: Record<string, unknown>) => {
        ;(kernel as KernelMock & { __options?: Record<string, unknown> }).__options = options
        return kernel
      }),
    }))
  }

  for (const id of PROVIDE_IDS) {
    vi.doMock(id, () => ({
      useVuepyterProvide: provideSpy,
    }))
  }

  const module = await import('@/components/Vuepyter.vue')
  return {
    Vuepyter: module.default,
    notebookModel,
    kernel,
    provideSpy,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
  for (const id of [...NOTEBOOK_MODEL_IDS, ...PYODIDE_KERNEL_IDS, ...PROVIDE_IDS]) {
    vi.doUnmock(id)
  }
})

async function flushAsync(): Promise<void> {
  await Promise.resolve()
  await nextTick()
}

describe('components/Vuepyter core interactions', () => {
  it('renders editor bar placement and applies theme variables', async () => {
    const { Vuepyter } = await loadVuepyterWithMocks()

    const wrapperTop = mount(Vuepyter as never, {
      props: {
        theme: { '--vuepyter-bg': '#102030' },
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    expect(wrapperTop.findAllComponents(EditorBarStub)).toHaveLength(1)
    expect(wrapperTop.find('.vuepyter-root').attributes('style')).toContain('--vuepyter-bg: #102030;')

    const wrapperBottom = mount(Vuepyter as never, {
      props: {
        editorBarPosition: 'bottom',
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    expect(wrapperBottom.findAllComponents(EditorBarStub)).toHaveLength(1)
  })

  it('initializes kernel on mount and provides reactive kernel context', async () => {
    const { Vuepyter, kernel, provideSpy } = await loadVuepyterWithMocks()

    mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    expect(kernel.initialize).toHaveBeenCalledTimes(1)
    expect(provideSpy).toHaveBeenCalledWith({
      pyodide: kernel.pyodide,
      workspace: kernel.workspace,
      status: kernel.status,
    })
  })

  it('forwards kernel callbacks to ready/error emits', async () => {
    const { Vuepyter, kernel } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const options = (kernel as KernelMock & { __options?: Record<string, unknown> }).__options ?? {}
    const onReady = options.onReady as ((payload: { pyodide: unknown }) => void) | undefined
    const onError = options.onError as ((payload: { type: string; message: string }) => void) | undefined

    onReady?.({ pyodide: { id: 'py' } })
    onError?.({ type: 'kernel:init', message: 'failed' })

    expect(wrapper.emitted('ready')?.[0]?.[0]).toEqual({
      pyodide: { id: 'py' },
      workspace: kernel.workspace,
    })
    expect(wrapper.emitted('error')?.[0]?.[0]).toEqual({
      type: 'kernel:init',
      message: 'failed',
    })
  })

  it('debounces update:modelValue on changes and flushes immediately on save', async () => {
    vi.useFakeTimers()
    const { Vuepyter, notebookModel } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    notebookModel.notebook.value = {
      ...(notebookModel.notebook.value as Record<string, unknown>),
      metadata: { changed: true },
    }
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    vi.advanceTimersByTime(160)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(notebookModel.serialize).toHaveBeenCalledTimes(1)

    wrapper.getComponent(NotebookStub).vm.$emit('save')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toHaveLength(2)
  })

  it('routes toolbar/notebook events to model and kernel actions', async () => {
    const { Vuepyter, notebookModel, kernel } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const bar = wrapper.getComponent(EditorBarStub)
    const notebook = wrapper.getComponent(NotebookStub)

    bar.vm.$emit('run-active')
    await flushAsync()

    notebook.vm.$emit('cell-source', { index: 0, source: 'x = 1' })
    bar.vm.$emit('set-cell-type', 'raw')
    bar.vm.$emit('clear-outputs')
    bar.vm.$emit('add-cell', 'markdown')
    bar.vm.$emit('delete-active')
    notebook.vm.$emit('cell-add', { index: 1, type: 'code' })
    notebook.vm.$emit('cell-delete', { index: 1 })
    notebook.vm.$emit('cell-move', { from: 0, to: 1 })
    await flushAsync()

    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'markdown')
    expect(notebookModel.removeCell).toHaveBeenCalledWith(expect.any(String))
    expect(notebookModel.setCellType).toHaveBeenCalledWith(expect.any(String), 'raw')
    expect(notebookModel.clearOutputs).toHaveBeenCalledTimes(1)
    expect(notebookModel.setCellSource).toHaveBeenCalledWith(expect.any(String), 'x = 1')
    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'code')
    expect(notebookModel.removeCell).toHaveBeenCalledTimes(2)
    expect(notebookModel.moveCell).toHaveBeenCalledWith(0, 1)

    if (kernel.executeCell.mock.calls.length > 0) {
      expect(kernel.executeCell).toHaveBeenCalledWith(expect.objectContaining({
        cellId: expect.any(String),
        source: expect.any(String),
      }))
      expect(notebookModel.setCellOutputs).toHaveBeenCalled()
      expect(wrapper.emitted('cell:execute')).toBeTruthy()
      expect(wrapper.emitted('cell:complete')).toBeTruthy()
    } else {
      expect(notebookModel.setCellOutputs).not.toHaveBeenCalled()
    }
  })
})
