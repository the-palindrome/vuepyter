import { describe, expect, it, vi } from 'vitest'
import { usePyodideKernel } from '@/composables/usePyodideKernel'
import type { PyodideInterface } from '@/types'

function createFetchResponse(body: string, status = 200): Pick<Response, 'ok' | 'status' | 'text'> {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }
}

function createFakePyodide(runImpl?: (source: string) => Promise<unknown>): PyodideInterface {
  let stdout = (_value: string) => {}
  let stderr = (_value: string) => {}

  return {
    runPythonAsync: vi.fn(async (source: string) => {
      if (runImpl) {
        return runImpl(source)
      }
      if (source.includes('micropip.install')) {
        return null
      }
      stdout(`stdout:${source}`)
      return `result:${source}`
    }),
    setStdout: vi.fn((options: { batched?: (output: string) => void }) => {
      stdout = options.batched ?? ((_value: string) => {})
    }),
    setStderr: vi.fn((options: { batched?: (output: string) => void }) => {
      stderr = options.batched ?? ((_value: string) => {})
      if (stderr) {
        stderr('')
      }
    }),
    interruptExecution: vi.fn(),
    globals: {
      toJs: vi.fn(() => ({
        _hidden: 1,
        visible: 42,
        fn: () => null,
      })),
      set: vi.fn(),
    },
    loadPackage: vi.fn(async () => {}),
  }
}

describe('usePyodideKernel', () => {
  it('initializes kernel and emits ready payload', async () => {
    const fake = createFakePyodide()
    const loadPyodide = vi.fn(async () => fake)
    vi.stubGlobal('loadPyodide', loadPyodide)
    const onReady = vi.fn()

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
      onReady,
    })

    await kernel.initialize()
    expect(kernel.status.value).toBe('ready')
    expect(kernel.workspace.value).toEqual({ visible: 42 })
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(loadPyodide).toHaveBeenCalledTimes(1)
    expect(loadPyodide).toHaveBeenCalledWith({
      indexURL: 'https://example.com/',
      packages: ['micropip'],
    })
    expect(fake.loadPackage).not.toHaveBeenCalled()
    expect(fake.runPythonAsync).toHaveBeenCalledWith('import micropip')
  })

  it('runs inline preamble during initialization', async () => {
    const fake = createFakePyodide()
    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
      preamble: 'import numpy as np\nx = 2',
    })

    await kernel.initialize()
    expect(fake.runPythonAsync).toHaveBeenCalledWith('import numpy as np\nx = 2')
  })

  it('loads and executes a .py preamble file before the kernel becomes ready', async () => {
    const fake = createFakePyodide()
    const fetchMock = vi.fn(async () => createFetchResponse('import numpy as np\nx = 2'))
    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))
    vi.stubGlobal('fetch', fetchMock)

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
      preamble: '/fixtures/preamble.py',
    })

    await kernel.initialize()

    expect(fetchMock).toHaveBeenCalledWith('/fixtures/preamble.py', {
      cache: 'no-store',
    })
    expect(fake.runPythonAsync).toHaveBeenCalledWith('import numpy as np\nx = 2')
  })

  it('loads a notebook preamble and executes only code cells', async () => {
    const fake = createFakePyodide()
    const notebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'markdown',
          source: ['# Ignore me'],
        },
        {
          cell_type: 'code',
          source: ['import numpy as np'],
        },
        {
          cell_type: 'code',
          source: ['x = 2'],
        },
      ],
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse(notebook)),
    )

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
      preamble: '/fixtures/preamble.ipynb',
    })

    await kernel.initialize()

    const calledSources = fake.runPythonAsync.mock.calls.map(([source]) => source)
    const preambleSource = calledSources.find((source) => source.includes('import numpy as np'))
    expect(preambleSource).toBeTruthy()
    expect(preambleSource).toContain('import numpy as np')
    expect(preambleSource).toContain('x = 2')
    expect(preambleSource).not.toContain('# Ignore me')
  })

  it('queues execution requests sequentially', async () => {
    const order: string[] = []
    const fake = createFakePyodide(async (source: string) => {
      order.push(`start:${source}`)
      await new Promise((resolve) => setTimeout(resolve, source === 'one' ? 10 : 1))
      order.push(`end:${source}`)
      return source
    })
    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
    })

    await kernel.initialize()
    order.length = 0

    const first = kernel.executeCell({ source: 'one' })
    const second = kernel.executeCell({ source: 'two' })
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(order).toEqual(['start:one', 'end:one', 'start:two', 'end:two'])
    expect(firstResult.outputs.some((output) => output.output_type === 'execute_result')).toBe(true)
    expect(secondResult.outputs.some((output) => output.output_type === 'execute_result')).toBe(true)
  })

  it('returns nbformat error output when execution fails', async () => {
    const fake = createFakePyodide(async (source: string) => {
      if (source === 'boom') {
        throw new Error('kaboom')
      }
      return null
    })
    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
    })

    const result = await kernel.executeCell({ cellId: 'c1', source: 'boom' })
    expect(result.cellId).toBe('c1')
    expect(result.error).toBeInstanceOf(Error)
    expect(result.outputs[0]?.output_type).toBe('error')
  })

  it('supports restart and interrupt behavior', async () => {
    const fake = createFakePyodide()
    const loadPyodide = vi.fn(async () => fake)
    vi.stubGlobal('loadPyodide', loadPyodide)

    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
    })

    await kernel.initialize()
    await kernel.executeCell({ source: 'x=1' })
    expect(kernel.executionCount.value).toBe(1)
    expect(kernel.interrupt()).toBe(true)

    await kernel.restart()
    expect(kernel.executionCount.value).toBe(0)
    expect(loadPyodide).toHaveBeenCalledTimes(2)
  })

  it('can set a workspace variable from JS', async () => {
    const fake = createFakePyodide()
    vi.stubGlobal('loadPyodide', vi.fn(async () => fake))
    const kernel = usePyodideKernel({
      pyodideUrl: 'https://example.com/pyodide.js',
    })

    await kernel.initialize()
    await kernel.setWorkspaceVariable('my_var', 123)
    expect(fake.globals.set).toHaveBeenCalledWith('my_var', 123)
  })
})
