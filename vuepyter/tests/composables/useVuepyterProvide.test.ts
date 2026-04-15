import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createVuepyterProvideDefaults,
  useVuepyterProvide,
  useVuepyterPyodide,
  useVuepyterStatus,
  useVuepyterWorkspace,
} from '@/composables/useVuepyterProvide'

function mountProviderConsumer(options: Parameters<typeof useVuepyterProvide>[0]) {
  let injected: {
    pyodide: ReturnType<typeof useVuepyterPyodide>
    workspace: ReturnType<typeof useVuepyterWorkspace>
    status: ReturnType<typeof useVuepyterStatus>
  } | null = null

  const Consumer = defineComponent({
    setup() {
      injected = {
        pyodide: useVuepyterPyodide(),
        workspace: useVuepyterWorkspace(),
        status: useVuepyterStatus(),
      }

      return () => h('div')
    },
  })

  const Provider = defineComponent({
    setup() {
      useVuepyterProvide(options)
      return () => h(Consumer)
    },
  })

  const wrapper = mount(Provider)
  return { injected, wrapper }
}

describe('composables/useVuepyterProvide', () => {
  it('provides refs directly when refs are passed in', () => {
    const pyodide = shallowRef({ id: 'py' })
    const workspace = ref<Record<string, unknown>>({ alpha: 1 })
    const status = ref<'loading' | 'ready' | 'busy' | 'error'>('ready')

    const { injected, wrapper } = mountProviderConsumer({ pyodide, workspace, status })

    expect(injected?.pyodide).toBe(pyodide)
    expect(injected?.workspace).toBe(workspace)
    expect(injected?.status).toBe(status)

    pyodide.value = { id: 'next' }
    workspace.value = { beta: 2 }
    status.value = 'busy'

    expect(injected?.pyodide.value).toEqual({ id: 'next' })
    expect(injected?.workspace.value).toEqual({ beta: 2 })
    expect(injected?.status.value).toBe('busy')
    wrapper.unmount()
  })

  it('wraps plain values and exposes reactive defaults', () => {
    const { injected, wrapper } = mountProviderConsumer({
      pyodide: null,
      workspace: { alpha: 1 },
      status: 'loading',
    })

    const defaults = createVuepyterProvideDefaults()

    expect(defaults.pyodide.value).toBeNull()
    expect(defaults.workspace.value).toEqual({})
    expect(defaults.status.value).toBe('loading')
    expect(injected?.pyodide.value).toBeNull()
    expect(injected?.workspace.value).toEqual({ alpha: 1 })
    expect(injected?.status.value).toBe('loading')
    wrapper.unmount()
  })

  it('throws when injectors are used without a provider', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (const [label, useInjection] of [
      ['useVuepyterPyodide', useVuepyterPyodide],
      ['useVuepyterWorkspace', useVuepyterWorkspace],
      ['useVuepyterStatus', useVuepyterStatus],
    ] as const) {
      const Consumer = defineComponent({
        setup() {
          useInjection()
          return () => h('div', label)
        },
      })

      expect(() => mount(Consumer)).toThrow('must be used within a Vuepyter provider')
    }

    warnSpy.mockRestore()
  })
})
