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
  KernelUpdateMode,
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

function isModuleNotFoundError(error: unknown, moduleName: string): boolean {
  const message = asError(error).message
  return message.includes(`No module named '${moduleName}'`) || message.includes(`No module named "${moduleName}"`)
}

async function loadMicropip(pyodide: PyodideInterface): Promise<void> {
  try {
    await pyodide.runPythonAsync('import micropip')
    return
  } catch (error) {
    if (!isModuleNotFoundError(error, 'micropip')) {
      throw error
    }
  }

  if (typeof pyodide.loadPackage === 'function') {
    await pyodide.loadPackage('micropip')
  } else {
    await pyodide.runPythonAsync(
      'import pyodide_js\nawait pyodide_js.loadPackage("micropip")',
    )
  }

  try {
    await pyodide.runPythonAsync('import micropip')
  } catch (error) {
    if (!isModuleNotFoundError(error, 'micropip')) {
      throw error
    }

    await pyodide.runPythonAsync(
      'import pyodide_js\nawait pyodide_js.loadPackage("micropip")\nimport micropip',
    )
  }
}

async function installPyodidePackages(
  pyodide: PyodideInterface,
  packages: string[],
): Promise<void> {
  if (packages.length === 0) {
    return
  }

  const encodedPackages = JSON.stringify(packages)
  await pyodide.runPythonAsync(`await micropip.install(${encodedPackages})`)
}

const MATPLOTLIB_BOOTSTRAP_SOURCE = `
import os as __vuepyter_os__

__vuepyter_os__.environ.setdefault("MPLBACKEND", "Agg")
`.trim()

const MATPLOTLIB_EXECUTION_PREFIX = `
import os as __vuepyter_os__

__vuepyter_os__.environ["MPLBACKEND"] = "Agg"

try:
    import matplotlib as __vuepyter_matplotlib__
    __vuepyter_matplotlib__.use("Agg", force=True)
except Exception:
    pass

try:
    import matplotlib.pyplot as __vuepyter_plt__
    __vuepyter_plt__.switch_backend("Agg")
    __vuepyter_plt__.close("all")

    def __vuepyter_matplotlib_show__(*args, **kwargs):
        return None

    __vuepyter_plt__.show = __vuepyter_matplotlib_show__
except Exception:
    pass
`.trim()

const MATPLOTLIB_CAPTURE_SOURCE = `
def __vuepyter_capture_matplotlib__():
    try:
        import base64 as __vuepyter_base64__
        import io as __vuepyter_io__
        import matplotlib.pyplot as __vuepyter_plt__
    except Exception:
        return []

    __vuepyter_outputs__ = []

    for __vuepyter_figure_number__ in list(__vuepyter_plt__.get_fignums()):
        __vuepyter_figure__ = __vuepyter_plt__.figure(__vuepyter_figure_number__)
        __vuepyter_buffer__ = __vuepyter_io__.BytesIO()
        __vuepyter_figure__.savefig(
            __vuepyter_buffer__,
            format="png",
            facecolor=__vuepyter_figure__.get_facecolor(),
            edgecolor=__vuepyter_figure__.get_edgecolor(),
        )
        __vuepyter_outputs__.append({
            "output_type": "display_data",
            "data": {
                "image/png": __vuepyter_base64__.b64encode(__vuepyter_buffer__.getvalue()).decode("ascii"),
            },
            "metadata": {},
        })
        __vuepyter_buffer__.close()

    if __vuepyter_outputs__:
        __vuepyter_plt__.close("all")

    return __vuepyter_outputs__

__vuepyter_capture_matplotlib__()
`.trim()

const MATPLOTLIB_SOURCE_HINT = /\bmatplotlib\b|\bpyplot\b|\bplt\./i
const MATPLOTLIB_WORKSPACE_HINT_KEYS = ['plt', 'matplotlib', 'pyplot']

function noop(): void {}

const LIVE_WORKSPACE_SYNC_INTERVAL_MS = 48

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function shouldCaptureMatplotlibOutput(source: string, currentWorkspace: WorkspaceState): boolean {
  if (MATPLOTLIB_SOURCE_HINT.test(source)) {
    return true
  }

  return MATPLOTLIB_WORKSPACE_HINT_KEYS.some((key) => key in currentWorkspace)
}

function wrapMatplotlibSource(source: string): string {
  return `${MATPLOTLIB_EXECUTION_PREFIX}\n\n${source}`
}

function normalizeDisplayOutputs(value: unknown): CellOutput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const outputs: CellOutput[] = []
  for (const entry of value) {
    const raw = asRecord(entry)
    if (!raw || raw.output_type !== 'display_data') {
      continue
    }

    const data = asRecord(raw.data) ?? {}
    const metadata = asRecord(raw.metadata) ?? {}
    outputs.push({
      output_type: 'display_data',
      data,
      metadata,
    })
  }

  return outputs
}

async function captureMatplotlibOutputs(
  pyodide: PyodideInterface,
  onError?: (payload: KernelErrorPayload) => void,
): Promise<CellOutput[]> {
  try {
    const rawOutputs = await pyodide.runPythonAsync(MATPLOTLIB_CAPTURE_SOURCE)
    const plainOutputs = toPlainExecutionValue(rawOutputs)
    maybeDestroy(rawOutputs)
    return normalizeDisplayOutputs(plainOutputs)
  } catch (error) {
    emitError(onError, {
      type: 'cell:display',
      message: asError(error).message,
      detail: error,
    })
    return []
  }
}

function countLeadingIndent(line: string): number {
  let indent = 0
  for (const char of line) {
    if (char === ' ') {
      indent += 1
      continue
    }
    if (char === '\t') {
      indent += 4
      continue
    }
    break
  }
  return indent
}

function createIndent(length: number): string {
  return ' '.repeat(Math.max(0, length))
}

function instrumentAlwaysLiveSource(source: string): string {
  if (!source.trim()) {
    return source
  }

  const lines = source.split('\n')
  const helperLine = 'await __vuepyter_live_yield__()'
  const insertionMap = new Map<number, string[]>()
  const loopStack: Array<{ indent: number; bodyIndent: number }> = []

  const addInsertion = (lineIndex: number, line: string) => {
    const bucket = insertionMap.get(lineIndex)
    if (bucket) {
      bucket.push(line)
      return
    }
    insertionMap.set(lineIndex, [line])
  }

  const closeLoops = (lineIndex: number, nextIndent: number) => {
    while (loopStack.length > 0) {
      const top = loopStack[loopStack.length - 1]
      if (!top || nextIndent > top.indent) {
        break
      }
      addInsertion(lineIndex, `${createIndent(top.bodyIndent)}${helperLine}`)
      loopStack.pop()
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const indent = countLeadingIndent(line)
    closeLoops(index, indent)

    const isTopLevelLoop =
      indent === 0
      && /^(for|while)\b/.test(trimmed)
      && trimmed.endsWith(':')

    if (!isTopLevelLoop) {
      continue
    }

    loopStack.push({ indent, bodyIndent: indent + 4 })
  }

  closeLoops(lines.length, -1)

  if (insertionMap.size === 0) {
    return source
  }

  const prefixLines = [
    'import asyncio as __vuepyter_asyncio__',
    '',
    'async def __vuepyter_live_yield__():',
    '    try:',
    '        _vuepyter_live_sync_workspace()',
    '    except Exception:',
    '        pass',
    '    await __vuepyter_asyncio__.sleep(0)',
    '',
  ]

  const output: string[] = [...prefixLines]
  for (let index = 0; index < lines.length; index += 1) {
    const pending = insertionMap.get(index)
    if (pending) {
      output.push(...pending)
    }
    output.push(lines[index] ?? '')
  }

  const tail = insertionMap.get(lines.length)
  if (tail) {
    output.push(...tail)
  }

  return output.join('\n')
}

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

  const resolveWorkspaceUpdateMode = (): KernelUpdateMode =>
    options.getWorkspaceUpdateMode?.() === 'always-live' ? 'always-live' : 'after-execution'

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
      options.onWorkspaceSync?.({ workspace: workspace.value })
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
          packages: ['micropip'],
        })

        await loadMicropip(instance)
        await instance.runPythonAsync(MATPLOTLIB_BOOTSTRAP_SOURCE)
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
      const updateMode = resolveWorkspaceUpdateMode()
      const liveMode = updateMode === 'always-live'
      let liveSyncRequested = false
      let liveSyncTimer: ReturnType<typeof setInterval> | null = null

      const outputs: CellOutput[] = []
      let stdout = ''
      let stderr = ''
      const needsMatplotlibCapture = shouldCaptureMatplotlibOutput(request.source, workspace.value)
      const preparedSource = needsMatplotlibCapture ? wrapMatplotlibSource(request.source) : request.source
      const executionSource = liveMode ? instrumentAlwaysLiveSource(preparedSource) : preparedSource

      const maybeSyncWorkspaceLive = (): void => {
        liveSyncRequested = true
      }

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
            if (liveMode) {
              maybeSyncWorkspaceLive()
            }
          },
        })
      }
      if (typeof instance.setStderr === 'function') {
        instance.setStderr({
          batched: (value: string) => {
            stderr += value
            if (liveMode) {
              maybeSyncWorkspaceLive()
            }
          },
        })
      }

      if (liveMode) {
        try {
          instance.globals.set('_vuepyter_live_sync_workspace', maybeSyncWorkspaceLive)
        } catch {
          // If callback injection fails, continue without in-cell live requests.
        }

        liveSyncRequested = true
        liveSyncTimer = setInterval(() => {
          if (!liveSyncRequested) {
            return
          }
          liveSyncRequested = false
          syncWorkspace()
        }, LIVE_WORKSPACE_SYNC_INTERVAL_MS)

        try {
          if (typeof (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame === 'function') {
            ;(globalThis as { requestAnimationFrame: (callback: () => void) => number }).requestAnimationFrame(() => {
              if (!liveSyncRequested) {
                return
              }
              liveSyncRequested = false
              syncWorkspace()
            })
          }
        } catch {
          // Ignore optional frame-sync setup errors.
        }
      }

      try {
        const result = await instance.runPythonAsync(executionSource)
        const plainResult = toPlainExecutionValue(result)
        pushStreams()

        if (needsMatplotlibCapture) {
          outputs.push(...(await captureMatplotlibOutputs(instance, options.onError)))
        }

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
        if (liveMode) {
          try {
            instance.globals.set('_vuepyter_live_sync_workspace', null)
          } catch {
            // Ignore cleanup callback errors.
          }
          if (liveSyncTimer) {
            clearInterval(liveSyncTimer)
            liveSyncTimer = null
          }
        }
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
