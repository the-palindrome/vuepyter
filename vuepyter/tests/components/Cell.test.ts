import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import Cell from '@/components/Cell.vue'
import type { NotebookCell } from '@/types'

const CodeEditorStub = defineComponent({
  name: 'CodeEditor',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'python',
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
    lineNumbers: {
      type: Boolean,
      default: true,
    },
    lineWrapping: {
      type: Boolean,
      default: true,
    },
    indentUnit: {
      type: Number,
      default: 4,
    },
    tabSize: {
      type: Number,
      default: 4,
    },
    extensions: {
      type: Array,
      default: () => [],
    },
    dark: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'execute', 'exit', 'focus', 'blur', 'navigateUp', 'navigateDown', 'split'],
  setup(props, { expose }) {
    expose({
      focus: () => {},
      blur: () => {},
    })

    return () =>
      h(
        'div',
        {
          class: 'code-editor-stub',
          'data-language': props.language,
          'data-read-only': String(props.readOnly),
          'data-line-numbers': String(props.lineNumbers),
        },
        props.modelValue,
      )
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
  props: {
    outputs: {
      type: Array,
      default: () => [],
    },
    maxOutputHeight: {
      type: [Number, Boolean],
      default: 400,
    },
    emptyLabel: {
      type: String,
      default: '',
    },
    hideEmpty: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'cell-output-stub',
          'data-max-height': String(props.maxOutputHeight),
        },
        JSON.stringify(props.outputs),
      )
  },
})

function mountCell(props: Partial<InstanceType<typeof Cell>['$props']> = {}) {
  const cell = props.cell ?? {
    id: 'cell-1',
    cell_type: 'code',
    source: 'print(1)',
    metadata: {},
    execution_count: 1,
    outputs: [{ output_type: 'stream', name: 'stdout', text: '1\n' }],
  }

  return mount(Cell, {
    props: {
      cell: cell as NotebookCell,
      index: 0,
      ...props,
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

describe('Cell', () => {
  it('renders code cell actions, output, and emits toolbar events', async () => {
    const wrapper = mountCell({
      index: 0,
      totalCells: 2,
      outputScrollable: false,
    })

    expect(wrapper.get('.vuepyter-cell-counter').text()).toBe('[1]:')
    expect(wrapper.getComponent(CodeEditorStub).props('language')).toBe('python')
    expect(wrapper.getComponent(CellOutputStub).props('maxOutputHeight')).toBe(false)

    await wrapper.get('.vuepyter-cell').trigger('click')
    await wrapper.get('button[aria-label="Run cell"]').trigger('click')
    await wrapper.get('button[aria-label="Convert to markdown"]').trigger('click')
    await wrapper.get('button[aria-label="Hide source"]').trigger('click')
    await wrapper.get('button[aria-label="Move cell down"]').trigger('click')
    await wrapper.get('button[aria-label="Add cell tag"]').trigger('click')
    await wrapper.get('button[aria-label="Delete cell"]').trigger('click')

    expect(wrapper.emitted('execute')?.[0]?.[0]).toEqual({ index: 0, advance: false })
    expect(wrapper.emitted('toolbarConvert')?.[0]?.[0]).toEqual({ index: 0, type: 'markdown' })
    expect(wrapper.emitted('toggleSourceVisibility')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('toolbarMoveDown')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('toolbarAddTag')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('toolbarDelete')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('select')?.[0]?.[0]).toBe(0)
  })

  it('disables move controls on a single-cell notebook edge', async () => {
    const wrapper = mountCell({
      index: 0,
      totalCells: 1,
    })

    expect(wrapper.get('button[aria-label="Move cell up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Move cell down"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('toolbarMoveUp')).toBeUndefined()
    expect(wrapper.emitted('toolbarMoveDown')).toBeUndefined()
  })

  it('renders hidden source previews for code cells', async () => {
    const wrapper = mountCell({
      cell: {
        id: 'hidden-code',
        cell_type: 'code',
        source: 'print("x")\nsecond line',
        metadata: {},
        execution_count: 2,
        outputs: [],
      },
      sourceHidden: true,
      outputHidden: true,
    })

    const hiddenPreview = wrapper.get('.vuepyter-source-hidden-line')
    expect(hiddenPreview.text()).toBe('print("x")')
    expect(hiddenPreview.html()).toContain('<span')
    expect(wrapper.get('button[aria-label="Show source"]').attributes('title')).toBe('Show source')

    await wrapper.get('button[aria-label="Show source"]').trigger('click')
    expect(wrapper.emitted('toggleSourceVisibility')?.[0]?.[0]).toBe(0)
    expect(wrapper.findComponent(CellOutputStub).exists()).toBe(false)
  })

  it('renders markdown preview and switches into editor mode on double click', async () => {
    const wrapper = mountCell({
      cell: {
        id: 'markdown-1',
        cell_type: 'markdown',
        source: '# Preview me',
        metadata: {},
      },
    })

    expect(wrapper.get('.vuepyter-markdown-preview').text()).toContain('# Preview me')
    expect(wrapper.findComponent(CodeEditorStub).exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Convert to code"]').attributes('title')).toBe('Convert to code')

    await wrapper.get('.vuepyter-markdown-preview').trigger('dblclick')
    expect(wrapper.emitted('toggleMarkdownMode')?.[0]?.[0]).toEqual({ index: 0, editing: true })

    await wrapper.setProps({ markdownEditing: true })
    expect(wrapper.find('.vuepyter-markdown-preview').exists()).toBe(false)
    expect(wrapper.getComponent(CodeEditorStub).props('language')).toBe('markdown')
    expect(wrapper.get('button[aria-label="Run cell"]').attributes('disabled')).toBeDefined()
  })

  it('passes raw cells through the raw editor language', async () => {
    const wrapper = mountCell({
      cell: {
        id: 'raw-1',
        cell_type: 'raw',
        source: 'Untouched content',
        metadata: {},
      },
      index: 2,
      totalCells: 4,
    })

    expect(wrapper.getComponent(CodeEditorStub).props('language')).toBe('raw')
    expect(wrapper.get('button[aria-label="Convert to code"]').attributes('title')).toBe('Convert to code')
    expect(wrapper.get('button[aria-label="Run cell"]').attributes('disabled')).toBeDefined()

    await wrapper.get('button[aria-label="Convert to code"]').trigger('click')
    expect(wrapper.emitted('toolbarConvert')?.[0]?.[0]).toEqual({ index: 2, type: 'code' })
  })

  it('keeps mutating controls disabled in read-only mode', () => {
    const wrapper = mountCell({
      readOnly: true,
    })

    expect(wrapper.get('.vuepyter-drag-handle').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.vuepyter-drag-handle').attributes('draggable')).toBe('false')
    expect(wrapper.get('button[aria-label="Convert to markdown"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Hide source"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Move cell up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Move cell down"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Add cell tag"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="Delete cell"]').attributes('disabled')).toBeDefined()
  })

  it('emits select, dragStart, and drop from the cell frame', async () => {
    const wrapper = mountCell()

    await wrapper.get('.vuepyter-cell').trigger('click')
    await wrapper.get('.vuepyter-drag-handle').trigger('dragstart')
    await wrapper.get('.vuepyter-cell').trigger('drop')

    expect(wrapper.emitted('select')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('dragStart')?.[0]?.[0]).toBe(0)
    expect(wrapper.emitted('drop')?.[0]?.[0]).toBe(0)
  })
})
