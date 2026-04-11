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
  emits: ['runActive'],
  template: `<button class="run-active" @click="$emit('runActive')">run active</button>`,
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
  })
})
