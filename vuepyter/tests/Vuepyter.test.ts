import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Vuepyter from '@/components/Vuepyter.vue'

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const waitForEvent = async (getter: () => unknown, attempts = 25) => {
  for (let i = 0; i < attempts; i += 1) {
    const result = getter()
    if (result) {
      return result
    }
    await flush()
  }
  return getter()
}

function createFakePyodide() {
  let stdout = (_value: string) => {}

  return {
    runPythonAsync: vi.fn(async (source: string) => {
      if (source.includes('micropip.install')) {
        return null
      }
      stdout(`ran:${source}`)
      return 7
    }),
    setStdout: vi.fn((options: { batched?: (text: string) => void }) => {
      stdout = options.batched ?? ((_value: string) => {})
    }),
    setStderr: vi.fn(),
    globals: {
      toJs: vi.fn(() => ({ alpha: 1 })),
      set: vi.fn(),
    },
    loadPackage: vi.fn(async () => {}),
    interruptExecution: vi.fn(),
  }
}

const NotebookStub = defineComponent({
  name: 'Notebook',
  emits: ['cellSource', 'cellExecute', 'save', 'update:activeIndex', 'cellAdd', 'cellDelete', 'cellMove', 'cellTag'],
  template: `
    <div>
      <button class="source" @click="$emit('cellSource', { index: 0, source: 'print(2)' })">source</button>
      <button class="execute" @click="$emit('cellExecute', { index: 0, advance: false })">execute</button>
      <button class="save" @click="$emit('save')">save</button>
    </div>
  `,
})

const EditorBarStub = defineComponent({
  name: 'EditorBar',
  emits: [
    'runActive',
    'copyActive',
    'pasteBelow',
    'moveCellDown',
    'renameNotebook',
    'toggleTrust',
    'save',
  ],
  template: `
    <div>
      <button class="run-active" @click="$emit('runActive')">run active</button>
      <button class="copy-active" @click="$emit('copyActive')">copy</button>
      <button class="paste-below" @click="$emit('pasteBelow')">paste below</button>
      <button class="move-down" @click="$emit('moveCellDown')">move down</button>
      <button class="rename" @click="$emit('renameNotebook', 'Renamed.ipynb')">rename</button>
      <button class="toggle-trust" @click="$emit('toggleTrust')">toggle trust</button>
      <button class="bar-save" @click="$emit('save')">bar save</button>
    </div>
  `,
})

describe('Vuepyter', () => {
  it('initializes kernel and emits ready', async () => {
    vi.stubGlobal('loadPyodide', vi.fn(async () => createFakePyodide()))

    const wrapper = mount(Vuepyter, {
      global: {
        stubs: {
          Notebook: NotebookStub,
          EditorBar: EditorBarStub,
        },
      },
    })

    const ready = await waitForEvent(() => wrapper.emitted('ready'))
    expect(ready).toBeTruthy()
    expect(wrapper.emitted('ready')?.length).toBe(1)
  })

  it('handles cell execute and save flows with serialized model output', async () => {
    vi.stubGlobal('loadPyodide', vi.fn(async () => createFakePyodide()))
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

    try {
      const wrapper = mount(Vuepyter, {
        props: {
          modelValue: {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {},
            cells: [
              {
                id: 'c1',
                cell_type: 'code',
                source: 'print(1)',
                metadata: {},
                execution_count: null,
                outputs: [],
              },
            ],
          },
        },
        global: {
          stubs: {
            Notebook: NotebookStub,
            EditorBar: EditorBarStub,
          },
        },
      })

      await flush()
      await wrapper.get('button.execute').trigger('click')
      await flush()

      const executeEvents = wrapper.emitted('cell:execute')
      const completeEvents = wrapper.emitted('cell:complete')
      expect(executeEvents?.length).toBe(1)
      expect(completeEvents?.length).toBe(1)
      expect((completeEvents?.[0]?.[0] as { outputs: unknown[] }).outputs.length).toBeGreaterThan(0)

      await wrapper.get('button.source').trigger('click')
      await wrapper.get('button.save').trigger('click')
      await flush()

      const updates = wrapper.emitted('update:modelValue')
      expect(updates?.length).toBeTruthy()
      const latest = updates?.[updates.length - 1]?.[0] as {
        cells: Array<{ source: string[] }>
      }
      expect(latest.cells[0]?.source).toEqual(['print(2)'])

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(anchorClickSpy).toHaveBeenCalledTimes(1)
      expect(clickedDownloads[0]).toBe('Untitled.ipynb')

      await flush()
      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    } finally {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
    }
  })

  it('applies header actions for title, trust, clipboard, and movement', async () => {
    vi.stubGlobal('loadPyodide', vi.fn(async () => createFakePyodide()))

    const wrapper = mount(Vuepyter, {
      props: {
        modelValue: {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: {
            title: 'Initial.ipynb',
            trusted: false,
          },
          cells: [
            {
              id: 'c1',
              cell_type: 'code',
              source: 'first',
              metadata: {},
              execution_count: null,
              outputs: [],
            },
            {
              id: 'c2',
              cell_type: 'code',
              source: 'second',
              metadata: {},
              execution_count: null,
              outputs: [],
            },
          ],
        },
      },
      global: {
        stubs: {
          Notebook: NotebookStub,
          EditorBar: EditorBarStub,
        },
      },
    })

    await flush()
    await wrapper.get('button.rename').trigger('click')
    await wrapper.get('button.toggle-trust').trigger('click')
    await wrapper.get('button.copy-active').trigger('click')
    await wrapper.get('button.paste-below').trigger('click')
    await wrapper.get('button.move-down').trigger('click')
    await wrapper.get('button.bar-save').trigger('click')
    await flush()

    const updates = wrapper.emitted('update:modelValue')
    expect(updates?.length).toBeTruthy()
    const latest = updates?.[updates.length - 1]?.[0] as {
      metadata: Record<string, unknown>
      cells: Array<{ source: string | string[] }>
    }

    expect(latest.metadata.title).toBe('Renamed.ipynb')
    expect(latest.metadata.trusted).toBe(true)
    expect(latest.cells).toHaveLength(3)

    const normalizedSources = latest.cells.map((cell) =>
      Array.isArray(cell.source) ? cell.source.join('') : cell.source,
    )
    expect(normalizedSources).toEqual(['first', 'second', 'first'])
  })
})
