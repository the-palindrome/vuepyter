import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import Cell from '@/components/Cell.vue'
import Notebook from '@/components/Notebook.vue'
import type { NotebookCell } from '@/types'

const CodeEditorStub = defineComponent({
  name: 'CodeEditor',
  emits: ['update:modelValue', 'execute', 'focus', 'blur', 'cursor', 'navigateUp', 'navigateDown', 'split'],
  setup(_props, { expose }) {
    expose({
      focus: () => {},
      blur: () => {},
    })
    return () => h('div', { class: 'code-editor-stub' })
  },
})

const MarkdownRendererStub = defineComponent({
  name: 'MarkdownRenderer',
  props: {
    source: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => h('div', { class: 'markdown-renderer-stub' }, props.source)
  },
})

const CellOutputStub = defineComponent({
  name: 'CellOutput',
  setup() {
    return () => h('div', { class: 'cell-output-stub' })
  },
})

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
}

function baseCells(): NotebookCell[] {
  return [
    {
      id: 'c1',
      cell_type: 'code',
      source: 'print(1)',
      metadata: {},
      execution_count: 1,
      outputs: [{ output_type: 'stream', name: 'stdout', text: '1\n' }],
    },
    {
      id: 'c2',
      cell_type: 'markdown',
      source: 'Second',
      metadata: {},
    },
  ]
}

function mountNotebook(cells: NotebookCell[] = baseCells()) {
  return mount(Notebook, {
    props: {
      cells,
    },
    global: {
      stubs: {
        CodeEditor: CodeEditorStub,
        MarkdownRenderer: MarkdownRendererStub,
        CellOutput: CellOutputStub,
      },
    },
  })
}

async function flushNotebookFocus(): Promise<void> {
  await nextTick()
  await nextTick()
}

describe('components/Notebook keyboard integration', () => {
  it('emits execute with insertBelow on Alt+Enter in command mode', async () => {
    const wrapper = mountNotebook()

    await wrapper.get('.vuepyter-notebook').trigger('keydown', { key: 'Enter', altKey: true })

    expect(wrapper.emitted('cellExecute')?.[0]?.[0]).toEqual({
      index: 0,
      advance: true,
      insertBelow: true,
    })
  })

  it('supports cut/copy/paste and undo/redo cell actions', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')

    notebook.element.dispatchEvent(keydown('c'))
    notebook.element.dispatchEvent(keydown('x'))
    notebook.element.dispatchEvent(keydown('v'))
    notebook.element.dispatchEvent(keydown('z'))
    notebook.element.dispatchEvent(keydown('z', { shiftKey: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cellDelete')?.[0]?.[0]).toEqual({ index: 0 })

    const pastePayload = wrapper.emitted('cellAdd')?.[0]?.[0] as {
      index: number
      type: string
      cell: NotebookCell
    }
    expect(pastePayload.index).toBe(1)
    expect(pastePayload.type).toBe('code')
    expect(pastePayload.cell.source).toBe('print(1)')
    expect(pastePayload.cell.id).not.toBe('c1')

    const undoPayload = wrapper.emitted('cellAdd')?.[1]?.[0] as {
      index: number
      type: string
      cell: NotebookCell
    }
    expect(undoPayload.index).toBe(0)
    expect(undoPayload.cell.id).toBe('c1')
    expect(wrapper.emitted('cellDelete')?.[1]?.[0]).toEqual({ index: 0 })
  })

  it('supports cell type and heading conversion shortcuts', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')

    notebook.element.dispatchEvent(keydown('m'))
    notebook.element.dispatchEvent(keydown('2'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cellType')?.[0]?.[0]).toEqual({ index: 0, type: 'markdown' })
    expect(wrapper.emitted('cellType')?.[1]?.[0]).toEqual({ index: 0, type: 'markdown' })
    expect(wrapper.emitted('cellSource')?.[0]?.[0]).toEqual({
      index: 0,
      source: '## print(1)',
    })
  })

  it('supports merge and split cell operations', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')

    notebook.element.dispatchEvent(keydown('m', { shiftKey: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cellSource')?.[0]?.[0]).toEqual({
      index: 0,
      source: 'print(1)\n\nSecond',
    })
    expect(wrapper.emitted('cellDelete')?.[0]?.[0]).toEqual({ index: 1 })

    const splitWrapper = mountNotebook([
      {
        id: 'code-cell',
        cell_type: 'code',
        source: 'abcdef',
        metadata: { test: true },
        execution_count: 3,
        outputs: [{ output_type: 'stream', name: 'stdout', text: 'ok\n' }],
      },
    ])

    splitWrapper.getComponent(Cell).vm.$emit('splitCell', { index: 0, cursorOffset: 3 })
    await splitWrapper.vm.$nextTick()

    expect(splitWrapper.emitted('cellSource')?.[0]?.[0]).toEqual({ index: 0, source: 'abc' })
    const addPayload = splitWrapper.emitted('cellAdd')?.[0]?.[0] as {
      index: number
      type: string
      cell: NotebookCell
    }
    expect(addPayload.index).toBe(1)
    expect(addPayload.type).toBe('code')
    expect(addPayload.cell.source).toBe('def')
    expect(addPayload.cell.execution_count).toBeNull()
    expect(addPayload.cell.outputs).toEqual([])
    expect(addPayload.cell.id).not.toBe('code-cell')
  })

  it('supports kernel sequences and output/line-number toggles', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(20).mockReturnValueOnce(30).mockReturnValueOnce(40)

    const i1 = keydown('i')
    const i2 = keydown('i')
    const z1 = keydown('0')
    const z2 = keydown('0')
    notebook.element.dispatchEvent(i1)
    notebook.element.dispatchEvent(i2)
    notebook.element.dispatchEvent(z1)
    notebook.element.dispatchEvent(z2)
    notebook.element.dispatchEvent(keydown('l'))
    await wrapper.vm.$nextTick()

    expect(i1.defaultPrevented).toBe(true)
    expect(i2.defaultPrevented).toBe(true)
    expect(z1.defaultPrevented).toBe(true)
    expect(z2.defaultPrevented).toBe(true)

    const firstCell = wrapper.getComponent(Cell)
    expect(firstCell.props('editorOptions')).toMatchObject({ lineNumbers: false })

    notebook.element.dispatchEvent(keydown('l', { shiftKey: true }))
    notebook.element.dispatchEvent(keydown('o'))
    notebook.element.dispatchEvent(keydown('o', { shiftKey: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('interrupt')?.length ?? 0).toBe(1)
    expect(wrapper.emitted('restartKernel')?.length ?? 0).toBe(1)
    expect(firstCell.props('outputHidden')).toBe(true)
    expect(firstCell.props('outputScrollable')).toBe(false)
    expect(wrapper.emitted('cellMetadata')?.[0]?.[0]).toEqual({
      index: 0,
      metadata: {
        outputCollapsed: true,
        outputs_hidden: true,
        jupyter: {
          outputs_hidden: true,
        },
      },
    })
  })

  it('returns focus to the notebook when edit mode exits with Escape', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')
    const focusSpy = vi.spyOn(notebook.element as HTMLDivElement, 'focus')

    wrapper.getComponent(Cell).vm.$emit('exitEditMode', 0)
    await flushNotebookFocus()

    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the notebook after Shift+Enter advances to the next cell', async () => {
    const wrapper = mountNotebook()
    const notebook = wrapper.get('.vuepyter-notebook')
    const focusSpy = vi.spyOn(notebook.element as HTMLDivElement, 'focus')

    wrapper.getComponent(Cell).vm.$emit('execute', { index: 0, advance: true })
    await flushNotebookFocus()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('cellExecute')?.[0]?.[0]).toEqual({ index: 0, advance: true })
  })

  it('hydrates modern jupyter hidden flags from metadata and persists source toggle', async () => {
    const wrapper = mountNotebook([
      {
        id: 'code-hidden',
        cell_type: 'code',
        source: 'print("x")',
        metadata: {
          jupyter: {
            source_hidden: true,
            outputs_hidden: true,
          },
        },
        execution_count: 1,
        outputs: [{ output_type: 'stream', name: 'stdout', text: 'x\n' }],
      },
    ])

    const cell = wrapper.getComponent(Cell)
    expect(cell.props('sourceHidden')).toBe(true)
    expect(cell.props('outputHidden')).toBe(true)
    expect(wrapper.get('.vuepyter-source-hidden-line').text()).toBe('print("x")')
    expect(wrapper.get('.vuepyter-source-hidden-line').html()).toContain('<span')

    cell.vm.$emit('toggleSourceVisibility', 0)
    await wrapper.vm.$nextTick()

    expect(cell.props('sourceHidden')).toBe(false)
    expect(wrapper.emitted('cellMetadata')?.[0]?.[0]).toEqual({
      index: 0,
      metadata: {
        collapsed: false,
        inputCollapsed: false,
        source_hidden: false,
        jupyter: {
          source_hidden: false,
          outputs_hidden: true,
        },
      },
    })
  })

  it('hydrates hidden flags from VS Code-compatible metadata keys', () => {
    const wrapper = mountNotebook([
      {
        id: 'vscode-hidden',
        cell_type: 'code',
        source: '# hidden in vscode\nprint(1)',
        metadata: {
          inputCollapsed: true,
          outputCollapsed: true,
        },
        execution_count: 1,
        outputs: [{ output_type: 'stream', name: 'stdout', text: '1\n' }],
      },
    ])

    const cell = wrapper.getComponent(Cell)
    expect(cell.props('sourceHidden')).toBe(true)
    expect(cell.props('outputHidden')).toBe(true)
    expect(wrapper.get('.vuepyter-source-hidden-line').text()).toBe('# hidden in vscode')
    expect(wrapper.get('.vuepyter-source-hidden-line').html()).toContain('<span')
  })

  it('handles hover toolbar actions for run/convert/move/tag/delete', async () => {
    const wrapper = mountNotebook()
    const cells = wrapper.findAllComponents(Cell)
    const first = cells[0]
    const second = cells[1]

    await first.get('[aria-label="Run cell"]').trigger('click')
    first.vm.$emit('toolbarConvert', { index: 0, type: 'markdown' })
    first.vm.$emit('toolbarMoveDown', 0)
    second.vm.$emit('toolbarMoveUp', 1)
    first.vm.$emit('toolbarAddTag', 0)
    first.vm.$emit('toolbarDelete', 0)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cellExecute')?.[0]?.[0]).toEqual({ index: 0, advance: false })
    expect(wrapper.emitted('cellType')?.[0]?.[0]).toEqual({ index: 0, type: 'markdown' })
    expect(wrapper.emitted('cellMove')?.[0]?.[0]).toEqual({ from: 0, to: 1 })
    expect(wrapper.emitted('cellMove')?.[1]?.[0]).toEqual({ from: 1, to: 0 })
    expect(wrapper.emitted('cellTag')?.[0]?.[0]).toEqual({ index: 0 })
    expect(wrapper.emitted('cellDelete')?.[0]?.[0]).toEqual({ index: 0 })
  })

  it('commits markdown edit mode and advances selection on execute', async () => {
    const wrapper = mountNotebook([
      {
        id: 'md-1',
        cell_type: 'markdown',
        source: '# Heading',
        metadata: {},
      },
      {
        id: 'code-2',
        cell_type: 'code',
        source: 'print(2)',
        metadata: {},
        execution_count: null,
        outputs: [],
      },
    ])

    const firstCell = wrapper.findAllComponents(Cell)[0]
    firstCell.vm.$emit('toggleMarkdownMode', { index: 0, editing: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.code-editor-stub').length).toBeGreaterThan(0)

    firstCell.vm.$emit('execute', { index: 0, advance: true })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cellExecute')?.[0]?.[0]).toEqual({ index: 0, advance: true })
    const cellsAfter = wrapper.findAllComponents(Cell)
    expect(cellsAfter[0]?.props('markdownEditing')).toBe(false)
    expect(cellsAfter[1]?.props('active')).toBe(true)
  })

  it('does not render a preview button in markdown edit mode', async () => {
    const wrapper = mountNotebook([
      {
        id: 'md-only',
        cell_type: 'markdown',
        source: '# Previewless',
        metadata: {},
      },
    ])

    const cell = wrapper.getComponent(Cell)
    cell.vm.$emit('toggleMarkdownMode', { index: 0, editing: true })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.vuepyter-markdown-actions').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Preview')
  })

  it('renders unexecuted prompt with a non-breaking space to prevent wrapping', () => {
    const wrapper = mountNotebook([
      {
        id: 'code-empty',
        cell_type: 'code',
        source: '1 + 1',
        metadata: {},
        execution_count: null,
        outputs: [],
      },
    ])

    const prompt = wrapper.get('.vuepyter-cell-counter').text()
    expect(prompt).toContain('\u00a0')
    expect(prompt.replace('\u00a0', ' ')).toBe('[ ]:')
  })
})
