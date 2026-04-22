import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
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
    'add-cell-above',
    'delete-active',
    'set-cell-type',
    'run-active',
    'run-and-advance',
    'run-all',
    'restart-kernel',
    'restart-run-all',
    'set-kernel-update-mode',
    'interrupt',
    'clear-outputs',
    'copy-active',
    'cut-active',
    'paste-below',
    'paste-above',
    'move-cell-up',
    'move-cell-down',
    'duplicate-active',
    'toggle-trust',
    'show-shortcuts',
    'rename-notebook',
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
    'cell-metadata',
    'cell-add',
    'cell-delete',
    'cell-move',
    'cell-tag',
    'cell-type',
    'cell-execute',
    'interrupt',
    'restart-kernel',
    'show-shortcuts',
    'save',
  ],
  template: '<div class="notebook-stub" />',
})

interface NotebookModelMock {
  notebook: ReturnType<typeof ref<Record<string, unknown>>>
  cells: ReturnType<typeof computed<Array<Record<string, unknown>>>>
  addCell: ReturnType<typeof vi.fn>
  insertCell: ReturnType<typeof vi.fn>
  removeCell: ReturnType<typeof vi.fn>
  setCellType: ReturnType<typeof vi.fn>
  updateCell: ReturnType<typeof vi.fn>
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
    insertCell: vi.fn((cell: Record<string, unknown>, index: number) => {
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
    updateCell: vi.fn((cellId: string, patch: Record<string, unknown>) => {
      const index = findById(cellId)
      if (index < 0) {
        return null
      }
      const current = notebook.value.cells[index]
      if (!current) {
        return null
      }
      const next = { ...current, ...patch }
      notebook.value.cells[index] = next
      return next
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

const loadingSlot = (slotProps: Record<string, unknown>) =>
  h('div', {
    'data-testid': 'loading-slot',
    'data-phase': String(slotProps.phase ?? ''),
    'data-text': String(slotProps.text ?? ''),
    'data-status': String(slotProps.status ?? ''),
    'data-blocking': String(slotProps.blocking ?? ''),
  })

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

  it('shows loading overlay in auto mode while kernel is loading and hides once ready', async () => {
    const { Vuepyter, kernel } = await loadVuepyterWithMocks()
    kernel.status.value = 'loading'

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
      slots: {
        loading: loadingSlot,
      },
    })

    await flushAsync()
    const loadingWhileKernelStarts = wrapper.find('[data-testid="loading-slot"]')
    expect(loadingWhileKernelStarts.exists()).toBe(true)
    expect(loadingWhileKernelStarts.attributes('data-phase')).toBe('kernel')
    expect(loadingWhileKernelStarts.attributes('data-status')).toBe('loading')

    kernel.status.value = 'ready'
    await flushAsync()
    expect(wrapper.find('[data-testid="loading-slot"]').exists()).toBe(false)
  })

  it('suppresses auto loading overlay when loadingOverlay is set to never', async () => {
    const { Vuepyter, kernel } = await loadVuepyterWithMocks()
    kernel.status.value = 'loading'

    const wrapper = mount(Vuepyter as never, {
      props: {
        loadingOverlay: 'never',
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
      slots: {
        loading: loadingSlot,
      },
    })

    await flushAsync()
    expect(wrapper.find('[data-testid="loading-slot"]').exists()).toBe(false)
  })

  it('shows external loading overlay and keeps slot props in sync with config', async () => {
    const { Vuepyter, kernel } = await loadVuepyterWithMocks()
    kernel.status.value = 'ready'

    const wrapper = mount(Vuepyter as never, {
      props: {
        loading: false,
        loadingText: 'Starting notebook...',
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
      slots: {
        loading: loadingSlot,
      },
    })

    await flushAsync()
    expect(wrapper.find('[data-testid="loading-slot"]').exists()).toBe(false)

    await wrapper.setProps({ loading: true })
    await flushAsync()

    const loading = wrapper.find('[data-testid="loading-slot"]')
    expect(loading.exists()).toBe(true)
    expect(loading.attributes('data-phase')).toBe('external')
    expect(loading.attributes('data-text')).toBe('Starting notebook...')
    expect(loading.attributes('data-status')).toBe('ready')
    expect(loading.attributes('data-blocking')).toBe('true')
  })

  it('marks loading overlay as pass-through when loadingBlockInteraction is false', async () => {
    const { Vuepyter } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      props: {
        loading: true,
        loadingBlockInteraction: false,
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
      slots: {
        loading: loadingSlot,
      },
    })

    await flushAsync()
    expect(wrapper.get('[data-testid="loading-slot"]').attributes('data-blocking')).toBe('false')
    expect(wrapper.get('.vuepyter-loading-overlay').classes()).toContain('is-pass-through')
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
    bar.vm.$emit('set-kernel-update-mode', 'always-live')
    bar.vm.$emit('add-cell', 'markdown')
    bar.vm.$emit('delete-active')
    notebook.vm.$emit('cell-add', { index: 1, type: 'code' })
    notebook.vm.$emit('cell-delete', { index: 1 })
    notebook.vm.$emit('cell-move', { from: 0, to: 1 })
    notebook.vm.$emit('cell-tag', { index: 0 })
    await flushAsync()

    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'markdown')
    expect(notebookModel.removeCell).toHaveBeenCalledWith(expect.any(String))
    expect(notebookModel.setCellType).toHaveBeenCalledWith(expect.any(String), 'raw')
    expect(notebookModel.clearOutputs).toHaveBeenCalledTimes(1)
    expect(notebookModel.setCellSource).toHaveBeenCalledWith(expect.any(String), 'x = 1')
    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'code')
    expect(notebookModel.removeCell).toHaveBeenCalledTimes(2)
    expect(notebookModel.moveCell).toHaveBeenCalledWith(0, 1)
    expect(notebookModel.updateCell).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      metadata: expect.objectContaining({
        tags: expect.arrayContaining(['tag']),
      }),
    }))
    expect(wrapper.emitted('kernel:update-mode')?.[0]).toEqual([{ mode: 'always-live' }])

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

  it('inserts a new code cell when advancing from the last markdown cell', async () => {
    const { Vuepyter, notebookModel, kernel } = await loadVuepyterWithMocks()
    notebookModel.notebook.value = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          id: 'md-last',
          cell_type: 'markdown',
          source: '# Last markdown',
          metadata: {},
        },
      ],
    }

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    wrapper.getComponent(NotebookStub).vm.$emit('cell-execute', { index: 0, advance: true })
    await flushAsync()

    expect(kernel.executeCell).not.toHaveBeenCalled()
    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'code')
  })

  it('ignores missing execute targets and advances to the next existing cell', async () => {
    const { Vuepyter, notebookModel, kernel } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const notebook = wrapper.getComponent(NotebookStub)
    notebook.vm.$emit('cell-execute', { index: 99, advance: true })
    notebook.vm.$emit('cell-execute', { index: 0, advance: true })
    await flushAsync()

    expect(kernel.executeCell).toHaveBeenCalledTimes(1)
    expect(kernel.executeCell).toHaveBeenCalledWith(expect.objectContaining({
      cellId: 'code-1',
    }))
    expect(notebookModel.addCell).not.toHaveBeenCalled()
  })

  it('saves notebooks with sanitized filenames and preserves metadata edits', async () => {
    vi.useFakeTimers()
    const { Vuepyter, notebookModel } = await loadVuepyterWithMocks()
    const createObjectURL = vi.fn(() => 'blob:vuepyter-test')
    const revokeObjectURL = vi.fn()
    const clickedDownloads: string[] = []
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockAnchorClick(this: HTMLAnchorElement) {
        clickedDownloads.push(this.download)
      })
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL

    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    notebookModel.notebook.value = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        title: 'Folder/Name.ipynb',
        trusted: false,
      },
      cells: [
        {
          id: 'code-1',
          cell_type: 'code',
          source: 'print("hi")',
          metadata: {},
          execution_count: null,
          outputs: [],
        },
      ],
    }

    try {
      const wrapper = mount(Vuepyter as never, {
        props: {
          modelValue: notebookModel.notebook.value as never,
          theme: 'dark',
          kernelUpdateMode: 'always-live',
        },
        global: {
          stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
        },
      })

      await nextTick()
      expect(wrapper.find('.vuepyter-root').attributes('style')).toContain('--vuepyter-bg: #0f172a;')
      expect(wrapper.getComponent(NotebookStub).props('dark')).toBe(true)
      expect((wrapper.vm as { getKernelUpdateMode: () => string }).getKernelUpdateMode()).toBe('always-live')

      wrapper.getComponent(EditorBarStub).vm.$emit('rename-notebook', '   ')
      await flushAsync()
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      wrapper.getComponent(EditorBarStub).vm.$emit('rename-notebook', 'Renamed/Notebook.ipynb')
      wrapper.getComponent(EditorBarStub).vm.$emit('toggle-trust')
      wrapper.getComponent(NotebookStub).vm.$emit('save')
      await flushAsync()

      const updates = wrapper.emitted('update:modelValue')
      expect(updates?.length ?? 0).toBeGreaterThan(0)
      const latest = updates?.at(-1)?.[0] as {
        metadata: { title?: string; trusted?: boolean }
      }
      expect(latest.metadata.title).toBe('Renamed/Notebook.ipynb')
      expect(latest.metadata.trusted).toBe(true)
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(anchorClickSpy).toHaveBeenCalledTimes(1)
      expect(clickedDownloads[0]).toBe('Renamed-Notebook.ipynb')
      expect(notebookModel.serialize).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(0)
      await flushAsync()
      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    } finally {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      anchorClickSpy.mockRestore()
    }
  })

  it('covers clipboard, movement, and read-only guards', async () => {
    const interactive = await loadVuepyterWithMocks()
    const wrapper = mount(interactive.Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const bar = wrapper.getComponent(EditorBarStub)
    const notebook = wrapper.getComponent(NotebookStub)

    bar.vm.$emit('copy-active')
    bar.vm.$emit('paste-below')
    bar.vm.$emit('paste-above')
    bar.vm.$emit('duplicate-active')
    bar.vm.$emit('add-cell-above')
    notebook.vm.$emit('update:active-index', 1)
    bar.vm.$emit('move-cell-up')
    notebook.vm.$emit('update:active-index', 0)
    bar.vm.$emit('move-cell-down')
    bar.vm.$emit('cut-active')
    bar.vm.$emit('delete-active')
    await flushAsync()

    expect(interactive.notebookModel.addCell).toHaveBeenCalledWith(2, 'code')
    expect(interactive.notebookModel.insertCell).toHaveBeenCalledTimes(3)
    const insertedCells = interactive.notebookModel.insertCell.mock.calls.map(([cell]) => cell as {
      cell_type: string
      id: string
      execution_count: number | null
      outputs: unknown[]
    })
    expect(insertedCells.every((cell) => cell.id !== 'code-1')).toBe(true)
    expect(insertedCells[0]).toMatchObject({
      cell_type: 'code',
      execution_count: null,
      outputs: [],
    })
    expect(interactive.notebookModel.moveCell).toHaveBeenCalledWith(1, 0)
    expect(interactive.notebookModel.moveCell).toHaveBeenCalledWith(0, 1)
    expect(interactive.notebookModel.removeCell).toHaveBeenCalled()

    const readOnly = await loadVuepyterWithMocks()
    const readOnlyWrapper = mount(readOnly.Vuepyter as never, {
      props: { readOnly: true },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const readOnlyBar = readOnlyWrapper.getComponent(EditorBarStub)
    readOnlyBar.vm.$emit('delete-active')
    readOnlyBar.vm.$emit('set-cell-type', 'raw')
    readOnlyBar.vm.$emit('cut-active')
    readOnlyBar.vm.$emit('paste-below')
    readOnlyBar.vm.$emit('paste-above')
    readOnlyBar.vm.$emit('move-cell-up')
    readOnlyBar.vm.$emit('move-cell-down')
    await flushAsync()

    expect(readOnly.notebookModel.removeCell).not.toHaveBeenCalled()
    expect(readOnly.notebookModel.setCellType).not.toHaveBeenCalled()
    expect(readOnly.notebookModel.insertCell).not.toHaveBeenCalled()
    expect(readOnly.notebookModel.moveCell).not.toHaveBeenCalled()
  })

  it('flushes pending notebook changes on the autosave interval', async () => {
    vi.useFakeTimers()
    const { Vuepyter, notebookModel } = await loadVuepyterWithMocks()

    const wrapper = mount(Vuepyter as never, {
      props: {
        autosaveInterval: 50,
      },
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    notebookModel.notebook.value = {
      ...(notebookModel.notebook.value as Record<string, unknown>),
      metadata: {
        autosaved: true,
      },
    }

    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    vi.advanceTimersByTime(50)
    await flushAsync()

    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(notebookModel.serialize).toHaveBeenCalledTimes(1)
  })

  it('surfaces execution failures, restart, and interrupt errors', async () => {
    const { Vuepyter, notebookModel, kernel } = await loadVuepyterWithMocks()
    kernel.executeCell.mockResolvedValueOnce({
      executionCount: 2,
      outputs: [{ output_type: 'stream', name: 'stdout', text: 'boom\n', data: {} }],
      error: new Error('boom'),
    })
    kernel.interrupt.mockReturnValueOnce(false)

    const wrapper = mount(Vuepyter as never, {
      global: {
        stubs: { EditorBar: EditorBarStub, Notebook: NotebookStub },
      },
    })

    const bar = wrapper.getComponent(EditorBarStub)
    const notebook = wrapper.getComponent(NotebookStub)

    notebook.vm.$emit('cell-execute', { index: 0, advance: false, insertBelow: true })
    bar.vm.$emit('restart-kernel')
    bar.vm.$emit('restart-run-all')
    bar.vm.$emit('interrupt')
    bar.vm.$emit('show-shortcuts')
    await flushAsync()

    expect(kernel.executeCell).toHaveBeenCalledWith(expect.objectContaining({
      cellId: 'code-1',
      source: 'print("hi")',
    }))
    expect(notebookModel.addCell).toHaveBeenCalledWith(1, 'code')
    expect(notebookModel.resetExecutionState).toHaveBeenCalledTimes(2)
    expect(kernel.restart).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('cell:complete')?.[0]?.[0]).toMatchObject({
      cellId: 'code-1',
      outputs: expect.any(Array),
      error: expect.any(Error),
    })
    expect(wrapper.emitted('error')?.[0]?.[0]).toEqual({
      type: 'kernel:interrupt',
      message: 'Kernel interrupt is not available in this environment.',
    })
    expect(wrapper.emitted('shortcuts:help')).toHaveLength(1)
  })
})
