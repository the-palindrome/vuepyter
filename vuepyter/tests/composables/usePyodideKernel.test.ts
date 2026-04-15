import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePyodideKernel } from '@/composables/usePyodideKernel'
import type { PyodideInterface, PyodideStdIOOptions } from '@/types'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

interface MockPyodide extends PyodideInterface {
  __emitStdout: (value: string) => void
  __emitStderr: (value: string) => void
  __globalsMap: Map<string, unknown>
  destroy: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createMockPyodide(): MockPyodide {
  const globalsMap = new Map<string, unknown>([
    ['visible', 7],
    ['_hidden', true],
    ['callable', () => 'skip'],
  ])

  let stdoutHandler: ((value: string) => void) | undefined
  let stderrHandler: ((value: string) => void) | undefined

  const instance = {
    runPythonAsync: vi.fn(async () => undefined),
    setStdout: vi.fn((options: PyodideStdIOOptions) => {
      stdoutHandler = options.batched
    }),
    setStderr: vi.fn((options: PyodideStdIOOptions) => {
      stderrHandler = options.batched
    }),
    loadPackage: vi.fn(async () => undefined),
    interruptExecution: vi.fn(() => undefined),
    globals: {
      toJs: vi.fn(() =>
        Object.fromEntries(globalsMap.entries()),
      ),
      set: vi.fn((name: string, value: unknown) => {
        globalsMap.set(name, value)
      }),
    },
    destroy: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    __emitStdout(value: string) {
      stdoutHandler?.(value)
    },
    __emitStderr(value: string) {
      stderrHandler?.(value)
    },
    __globalsMap: globalsMap,
  } as unknown as MockPyodide

  return instance
}

describe('composables/usePyodideKernel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes pyodide, preloads micropip, installs packages/init code, and syncs workspace', async () => {
    const instance = createMockPyodide()
    const loadPyodide = vi.fn(async () => instance)
    vi.stubGlobal('loadPyodide', loadPyodide)

    const onReady = vi.fn()
    const kernel = usePyodideKernel({
      pyodideUrl: 'https://cdn.example.test/pyodide/v1/pyodide.mjs?x=1#hash',
      pyodidePackages: ['numpy', 'pandas'],
      pyodideInitCode: 'x = 1',
      onReady,
    })

    const resolved = await kernel.initialize()

    expect(resolved).toBe(instance)
    expect(loadPyodide).toHaveBeenCalledWith({
      indexURL: 'https://cdn.example.test/pyodide/v1/',
      packages: ['micropip'],
    })
    expect(instance.loadPackage).not.toHaveBeenCalled()
    expect(instance.runPythonAsync).toHaveBeenNthCalledWith(1, 'import micropip')
    expect(instance.runPythonAsync).toHaveBeenNthCalledWith(
      2,
      'await micropip.install(["numpy","pandas"])',
    )
    expect(instance.runPythonAsync).toHaveBeenNthCalledWith(3, 'x = 1')
    expect(kernel.status.value).toBe('ready')
    expect(kernel.isReady.value).toBe(true)
    expect(kernel.workspace.value).toEqual({ visible: 7 })
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('preloads micropip even when no extra packages are requested', async () => {
    const instance = createMockPyodide()
    const loadPyodide = vi.fn(async () => instance)
    vi.stubGlobal('loadPyodide', loadPyodide)

    const kernel = usePyodideKernel()

    await kernel.initialize()

    expect(loadPyodide).toHaveBeenCalledWith({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/',
      packages: ['micropip'],
    })
    expect(instance.loadPackage).not.toHaveBeenCalled()
    expect(instance.runPythonAsync).toHaveBeenCalledTimes(1)
    expect(instance.runPythonAsync).toHaveBeenCalledWith('import micropip')
  })

  it('falls back to explicit micropip loading when bootstrap packages are not importable yet', async () => {
    const missingMicropipError = new Error("No module named 'micropip'")
    const instance = createMockPyodide()
    instance.runPythonAsync.mockImplementation(async (source: string) => {
      if (source === 'import micropip' && instance.loadPackage.mock.calls.length === 0) {
        throw missingMicropipError
      }
      return undefined
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))

    const kernel = usePyodideKernel()

    await kernel.initialize()

    expect(instance.loadPackage).toHaveBeenCalledWith('micropip')
    expect(instance.runPythonAsync).toHaveBeenNthCalledWith(1, 'import micropip')
    expect(instance.runPythonAsync).toHaveBeenNthCalledWith(2, 'import micropip')
  })

  it('executes a cell with stdout/stderr capture and execute_result output', async () => {
    const instance = createMockPyodide()
    const resultProxy = {
      toJs: vi.fn(() => ({ answer: 42 })),
      destroy: vi.fn(),
      toString: () => 'PyProxy(42)',
    }

    instance.runPythonAsync.mockImplementation(async (source: string) => {
      if (source === 'print(42)') {
        instance.__emitStdout('42\n')
        instance.__emitStderr('warn\n')
        return resultProxy
      }
      return undefined
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))
    const kernel = usePyodideKernel()

    await kernel.initialize()
    const result = await kernel.executeCell({ cellId: 'cell-1', source: 'print(42)' })

    expect(result.cellId).toBe('cell-1')
    expect(result.executionCount).toBe(1)
    expect(result.result).toEqual({ answer: 42 })
    expect(result.outputs).toEqual([
      { output_type: 'stream', name: 'stdout', text: '42\n', data: {} },
      { output_type: 'stream', name: 'stderr', text: 'warn\n', data: {} },
      {
        output_type: 'execute_result',
        execution_count: 1,
        data: { 'text/plain': 'PyProxy(42)' },
        metadata: {},
      },
    ])
    expect(resultProxy.toJs).toHaveBeenCalledTimes(1)
    expect(resultProxy.destroy).toHaveBeenCalledTimes(1)
    expect(kernel.executionCount.value).toBe(1)
    expect(kernel.status.value).toBe('ready')

    const finalStdout = instance.setStdout.mock.calls.at(-1)?.[0] as PyodideStdIOOptions
    const finalStderr = instance.setStderr.mock.calls.at(-1)?.[0] as PyodideStdIOOptions
    expect(typeof finalStdout.batched).toBe('function')
    expect(typeof finalStderr.batched).toBe('function')
  })

  it('returns stream + error outputs when execution fails', async () => {
    const instance = createMockPyodide()
    instance.runPythonAsync.mockImplementation(async (source: string) => {
      if (source === 'raise') {
        instance.__emitStderr('before-error\n')
        const err = new Error('boom') as Error & { traceback?: string[]; name: string }
        err.name = 'ValueError'
        err.traceback = ['trace line 1', 'trace line 2']
        throw err
      }
      return undefined
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))
    const kernel = usePyodideKernel()
    await kernel.initialize()

    const result = await kernel.executeCell({ source: 'raise' })

    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('boom')
    expect(result.outputs[0]).toEqual({
      output_type: 'stream',
      name: 'stderr',
      text: 'before-error\n',
      data: {},
    })
    expect(result.outputs[1]).toMatchObject({
      output_type: 'error',
      ename: 'ValueError',
      evalue: 'boom',
      traceback: ['trace line 1', 'trace line 2'],
    })
    expect(kernel.status.value).toBe('ready')
  })

  it('supports always-live workspace sync mode during cell execution', async () => {
    const instance = createMockPyodide()
    const onWorkspaceSync = vi.fn()

    instance.runPythonAsync.mockImplementation(async (source: string) => {
      if (source.includes('step_once()')) {
        const liveSync = instance.__globalsMap.get('_vuepyter_live_sync_workspace')
        if (typeof liveSync === 'function') {
          ;(liveSync as () => void)()
        }
        return undefined
      }
      return undefined
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))
    const kernel = usePyodideKernel({
      getWorkspaceUpdateMode: () => 'always-live',
      onWorkspaceSync,
    })
    await kernel.initialize()
    onWorkspaceSync.mockClear()

    await kernel.executeCell({
      source: 'for _ in range(2):\n    step_once()',
    })

    const executedSource = instance.runPythonAsync.mock.calls.at(-1)?.[0]
    expect(String(executedSource)).toContain('async def __vuepyter_live_yield__():')
    expect(String(executedSource)).toContain('await __vuepyter_live_yield__()')
    expect(String(executedSource)).toContain('step_once()')
    expect(onWorkspaceSync.mock.calls.length).toBeGreaterThan(0)
  })

  it('queues executions sequentially when multiple runs are requested', async () => {
    const instance = createMockPyodide()
    const first = deferred<unknown>()
    const second = deferred<unknown>()

    instance.runPythonAsync.mockImplementation((source: string) => {
      if (source === 'first') {
        return first.promise
      }
      if (source === 'second') {
        return second.promise
      }
      return Promise.resolve(undefined)
    })

    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))
    const kernel = usePyodideKernel()
    await kernel.initialize()

    const runFirst = kernel.executeCell({ source: 'first' })
    const runSecond = kernel.executeCell({ source: 'second' })

    let secondResolved = false
    void runSecond.then(() => {
      secondResolved = true
    })

    await vi.waitFor(() => {
      expect(instance.runPythonAsync).toHaveBeenCalledTimes(1)
    })
    expect(secondResolved).toBe(false)

    first.resolve(1)
    await runFirst
    await vi.waitFor(() => {
      expect(instance.runPythonAsync).toHaveBeenCalledTimes(2)
    })

    second.resolve(2)
    await runSecond
    expect(secondResolved).toBe(true)
  })

  it('restarts the kernel and resets execution state', async () => {
    const firstInstance = createMockPyodide()
    const secondInstance = createMockPyodide()
    const loadPyodide = vi
      .fn<() => Promise<PyodideInterface>>()
      .mockResolvedValueOnce(firstInstance)
      .mockResolvedValueOnce(secondInstance)

    vi.stubGlobal('loadPyodide', loadPyodide)
    const kernel = usePyodideKernel()

    await kernel.initialize()
    await kernel.executeCell({ source: '1 + 1' })
    expect(kernel.executionCount.value).toBe(1)

    await kernel.restart()

    expect(firstInstance.destroy).toHaveBeenCalledTimes(1)
    expect(firstInstance.close).toHaveBeenCalledTimes(1)
    expect(firstInstance.terminate).toHaveBeenCalledTimes(1)
    expect(loadPyodide).toHaveBeenCalledTimes(2)
    expect(kernel.executionCount.value).toBe(0)
    expect(kernel.status.value).toBe('ready')
    expect(kernel.pyodide.value).toBe(secondInstance)
  })

  it('sets workspace variables and supports interrupt success/failure paths', async () => {
    const instance = createMockPyodide()
    const onError = vi.fn()
    vi.stubGlobal('loadPyodide', vi.fn(async () => instance))

    const kernel = usePyodideKernel({ onError })
    await kernel.initialize()
    await kernel.setWorkspaceVariable('alpha', 99)

    expect(instance.globals.set).toHaveBeenCalledWith('alpha', 99)
    expect(kernel.workspace.value.alpha).toBe(99)

    expect(kernel.interrupt()).toBe(true)
    expect(instance.interruptExecution).toHaveBeenCalledTimes(1)

    instance.interruptExecution = vi.fn(() => {
      throw new Error('interrupt failed')
    })

    expect(kernel.interrupt()).toBe(false)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'kernel:interrupt',
        message: 'interrupt failed',
      }),
    )
  })
})
