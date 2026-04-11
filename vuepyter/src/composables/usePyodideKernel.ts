import { computed, ref, shallowRef } from 'vue'
import { DEFAULT_PYODIDE_URL } from '@/constants'
import type {
  CellOutput,
  ErrorOutput,
  KernelErrorPayload,
  KernelExecuteRequest,
  KernelExecuteResult,
  KernelReadyPayload,
  KernelStatus,
  LoadPyodide,
  PyodideInterface,
  UsePyodideKernelOptions,
  WorkspaceState,
} from '@/types'

interface PyProxyLike {
  destroy?: () => void
  toJs?: (options?: Record<string, unknown>) => unknown
}

const scriptLoaders = new Map<string, Promise<void>>()

function asError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }
  return new Error(typeof value === 'string' ? value : 'Unknown kernel error')
}

function emitError(
  callback: ((payload: KernelErrorPayload) => void) | undefined,
  payload: KernelErrorPayload,
): void {
  callback?.(payload)
}

function getGlobalLoadPyodide(): LoadPyodide | null {
  const candidate = (globalThis as { loadPyodide?: unknown }).loadPyodide
  return typeof candidate === 'function' ? (candidate as LoadPyodide) : null
}

function deriveIndexUrl(pyodideUrl: string): string {
  const noQuery = pyodideUrl.split('?')[0]?.split('#')[0] ?? pyodideUrl
  if (noQuery.endsWith('/')) {
    return noQuery
  }

  const lastSlash = noQuery.lastIndexOf('/')
  if (lastSlash === -1) {
    return noQuery
  }
  return `${noQuery.slice(0, lastSlash + 1)}`
}

async function loadScript(pyodideUrl: string): Promise<void> {
  const existing = scriptLoaders.get(pyodideUrl)
  if (existing) {
    await existing
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Pyodide script loading requires a browser document')
  }

  const loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = pyodideUrl
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load Pyodide script: ${pyodideUrl}`))
    document.head.appendChild(script)
  })

  scriptLoaders.set(pyodideUrl, loader)
  await loader
}

async function resolveLoadPyodide(pyodideUrl: string): Promise<LoadPyodide> {
  try {
    const moduleValue = (await import(/* @vite-ignore */ pyodideUrl)) as {
      loadPyodide?: unknown
    }
    if (typeof moduleValue.loadPyodide === 'function') {
      return moduleValue.loadPyodide as LoadPyodide
    }
  } catch {
    // Ignore module import errors and fallback to script/global resolution.
  }

  const globalLoader = getGlobalLoadPyodide()
  if (globalLoader) {
    return globalLoader
  }

  await loadScript(pyodideUrl)
  const scriptLoader = getGlobalLoadPyodide()
  if (!scriptLoader) {
    throw new Error(`Unable to resolve loadPyodide from ${pyodideUrl}`)
  }

  return scriptLoader
}

function maybeDestroy(value: unknown): void {
  const proxy = value as PyProxyLike | null
  if (proxy && typeof proxy.destroy === 'function') {
    proxy.destroy()
  }
}

function normalizeWorkspaceValue(value: unknown): WorkspaceState {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return Object.fromEntries(
    Object.entries(raw).filter(([key, entry]) => !key.startsWith('_') && typeof entry !== 'function'),
  )
}

function toPlainExecutionValue(value: unknown): unknown {
  const proxy = value as PyProxyLike | null
  if (proxy && typeof proxy.toJs === 'function') {
    try {
      return proxy.toJs()
    } catch {
      return value
    }
  }
  return value
}

function stringifyExecutionValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value == null) {
    return 'None'
  }

  try {
    return String(value)
  } catch {
    return '[unprintable]'
  }
}

function formatErrorOutput(error: unknown): ErrorOutput {
  const resolved = asError(error)
  const anyError = error as Record<string, unknown>
  const traceback =
    Array.isArray(anyError?.traceback) && anyError.traceback.length > 0
      ? anyError.traceback.map((entry) => String(entry))
      : (resolved.stack?.split('\n') ?? [resolved.message])

  return {
    output_type: 'error',
    ename:
      typeof anyError?.name === 'string' && anyError.name
        ? anyError.name
        : resolved.name || 'Error',
    evalue: resolved.message,
    traceback,
    data: {},
  }
}

async function installPyodidePackages(
  pyodide: PyodideInterface,
  packages: string[],
): Promise<void> {
  if (packages.length === 0) {
    return
  }

  if (typeof pyodide.loadPackage === 'function') {
    await pyodide.loadPackage('micropip')
  }

  const encodedPackages = JSON.stringify(packages)
  await pyodide.runPythonAsync(
    `import micropip\nawait micropip.install(${encodedPackages})`,
  )
}

function noop(): void {}

function cleanupKernelInstance(instance: PyodideInterface | null): void {
  if (!instance) {
    return
  }

  for (const methodName of ['destroy', 'close', 'terminate']) {
    const method = instance[methodName]
    if (typeof method === 'function') {
      try {
        ;(method as () => void).call(instance)
      } catch {
        // Ignore teardown errors.
      }
    }
  }
}

function normalizeExecuteRequest(
  requestOrCellId: KernelExecuteRequest | string,
  source?: string,
): KernelExecuteRequest {
  if (typeof requestOrCellId === 'string') {
    return {
      cellId: requestOrCellId,
      source: source ?? '',
    }
  }

  return requestOrCellId
}

export function usePyodideKernel(options: UsePyodideKernelOptions = {}) {
  const pyodide = shallowRef<PyodideInterface | null>(null)
  const status = ref<KernelStatus>('loading')
  const workspace = ref<WorkspaceState>({})
  const executionCount = ref(0)

  let initializePromise: Promise<PyodideInterface> | null = null
  let executionQueue: Promise<unknown> = Promise.resolve()

  function syncWorkspace(): WorkspaceState {
    const instance = pyodide.value
    if (!instance) {
      workspace.value = {}
      return workspace.value
    }

    try {
      const globalsRaw = instance.globals.toJs({
        dict_converter: Object.fromEntries,
      })
      workspace.value = normalizeWorkspaceValue(globalsRaw)
      maybeDestroy(globalsRaw)
    } catch (error) {
      emitError(options.onError, {
        type: 'workspace:sync',
        message: asError(error).message,
        detail: error,
      })
    }

    return workspace.value
  }

  async function initialize(force = false): Promise<PyodideInterface> {
    if (pyodide.value && !force) {
      return pyodide.value
    }

    if (initializePromise && !force) {
      return initializePromise
    }

    initializePromise = (async () => {
      status.value = 'loading'
      const pyodideUrl = options.pyodideUrl ?? DEFAULT_PYODIDE_URL

      try {
        const loadPyodide = await resolveLoadPyodide(pyodideUrl)
        const instance = await loadPyodide({
          indexURL: deriveIndexUrl(pyodideUrl),
        })

        await installPyodidePackages(instance, options.pyodidePackages ?? [])
        if (options.pyodideInitCode?.trim()) {
          await instance.runPythonAsync(options.pyodideInitCode)
        }

        pyodide.value = instance
        syncWorkspace()
        status.value = 'ready'

        const payload: KernelReadyPayload = {
          pyodide: instance,
          workspace,
        }
        options.onReady?.(payload)

        return instance
      } catch (error) {
        status.value = 'error'
        const resolved = asError(error)
        emitError(options.onError, {
          type: 'kernel:init',
          message: resolved.message,
          detail: error,
        })
        throw resolved
      }
    })()

    try {
      return await initializePromise
    } finally {
      initializePromise = null
    }
  }

  function enqueueExecution<T>(task: () => Promise<T>): Promise<T> {
    const queued = executionQueue.then(task, task)
    executionQueue = queued.then(noop, noop)
    return queued
  }

  async function executeCell(
    requestOrCellId: KernelExecuteRequest | string,
    source?: string,
  ): Promise<KernelExecuteResult> {
    const request = normalizeExecuteRequest(requestOrCellId, source)
    if (request.cellId) {
      options.onExecute?.({
        cellId: request.cellId,
        source: request.source,
      })
    }

    return enqueueExecution(async () => {
      const instance = await initialize()
      status.value = 'busy'
      executionCount.value += 1
      const currentExecutionCount = executionCount.value

      const outputs: CellOutput[] = []
      let stdout = ''
      let stderr = ''

      const pushStreams = (): void => {
        if (stdout) {
          outputs.push({
            output_type: 'stream',
            name: 'stdout',
            text: stdout,
            data: {},
          })
        }
        if (stderr) {
          outputs.push({
            output_type: 'stream',
            name: 'stderr',
            text: stderr,
            data: {},
          })
        }
      }

      if (typeof instance.setStdout === 'function') {
        instance.setStdout({
          batched: (value: string) => {
            stdout += value
          },
        })
      }
      if (typeof instance.setStderr === 'function') {
        instance.setStderr({
          batched: (value: string) => {
            stderr += value
          },
        })
      }

      try {
        const result = await instance.runPythonAsync(request.source)
        const plainResult = toPlainExecutionValue(result)
        pushStreams()

        if (result !== undefined) {
          outputs.push({
            output_type: 'execute_result',
            execution_count: currentExecutionCount,
            data: {
              'text/plain': stringifyExecutionValue(result),
            },
            metadata: {},
          })
        }

        const response: KernelExecuteResult = {
          outputs,
          executionCount: currentExecutionCount,
          result: plainResult,
        }
        if (request.cellId) {
          response.cellId = request.cellId
        }
        if (request.cellId) {
          options.onComplete?.({
            cellId: request.cellId,
            outputs,
          })
        }

        maybeDestroy(result)
        return response
      } catch (error) {
        pushStreams()
        const errorOutput = formatErrorOutput(error)
        outputs.push(errorOutput)
        const resolved = asError(error)

        const response: KernelExecuteResult = {
          outputs,
          executionCount: currentExecutionCount,
          error: resolved,
        }
        if (request.cellId) {
          response.cellId = request.cellId
        }
        if (request.cellId) {
          options.onComplete?.({
            cellId: request.cellId,
            outputs,
            error: resolved,
          })
        }
        return response
      } finally {
        if (typeof instance.setStdout === 'function') {
          instance.setStdout({ batched: noop })
        }
        if (typeof instance.setStderr === 'function') {
          instance.setStderr({ batched: noop })
        }
        syncWorkspace()
        status.value = pyodide.value ? 'ready' : 'error'
      }
    })
  }

  async function restart(): Promise<void> {
    await executionQueue
    if (initializePromise) {
      await initializePromise.catch(noop)
    }

    cleanupKernelInstance(pyodide.value)
    pyodide.value = null
    workspace.value = {}
    executionCount.value = 0

    await initialize(true)
  }

  function interrupt(): boolean {
    const instance = pyodide.value
    if (!instance || typeof instance.interruptExecution !== 'function') {
      return false
    }

    try {
      instance.interruptExecution()
      return true
    } catch (error) {
      const resolved = asError(error)
      emitError(options.onError, {
        type: 'kernel:interrupt',
        message: resolved.message,
        detail: error,
      })
      return false
    }
  }

  async function setWorkspaceVariable(name: string, value: unknown): Promise<void> {
    const instance = await initialize()
    instance.globals.set(name, value)
    syncWorkspace()
  }

  function destroy(): void {
    cleanupKernelInstance(pyodide.value)
    pyodide.value = null
    workspace.value = {}
    executionCount.value = 0
    status.value = 'loading'
  }

  const isReady = computed(() => status.value === 'ready')
  const isBusy = computed(() => status.value === 'busy')

  return {
    pyodide,
    status,
    statusRef: status,
    workspace,
    executionCount,
    isReady,
    isBusy,
    initialize,
    executeCell,
    restart,
    restartKernel: restart,
    interrupt,
    interruptExecution: interrupt,
    syncWorkspace,
    setWorkspaceVariable,
    destroy,
  }
}
