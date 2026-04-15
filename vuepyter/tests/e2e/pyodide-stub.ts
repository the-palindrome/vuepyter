type BatchedSink = {
  batched?: (value: string) => void
}

class StubGlobals {
  private readonly values = new Map<string, unknown>()

  set(name: string, value: unknown): void {
    if (value === null) {
      this.values.delete(name)
      return
    }
    this.values.set(name, value)
  }

  get(name: string): unknown {
    return this.values.get(name)
  }

  toJs(): Record<string, unknown> {
    return Object.fromEntries(this.values.entries())
  }
}

function splitTopLevelPlus(expression: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  let escaped = false

  for (const char of expression) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      if (quote) {
        escaped = true
      }
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      }
      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }

    if (char === '+') {
      if (current.trim()) {
        parts.push(current.trim())
      }
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts.length > 0 ? parts : [expression.trim()]
}

function evaluateExpression(expression: string, globals: StubGlobals): unknown {
  const trimmed = expression.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed === 'None') {
    return null
  }
  if (trimmed === 'True') {
    return true
  }
  if (trimmed === 'False') {
    return false
  }
  if (/^[+-]?\d+(?:\.\d+)?$/u.test(trimmed)) {
    return Number(trimmed)
  }

  const quoted = trimmed.match(/^(["'])([\s\S]*)\1$/u)
  if (quoted) {
    return quoted[2] ?? ''
  }

  const segments = splitTopLevelPlus(trimmed)
  if (segments.length > 1) {
    return segments
      .map((segment) => evaluateExpression(segment, globals))
      .reduce<unknown>((acc, value) => {
        if (typeof acc === 'number' && typeof value === 'number') {
          return acc + value
        }
        return `${String(acc)}${String(value)}`
      })
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(trimmed)) {
    return globals.get(trimmed)
  }

  return trimmed
}

function formatAssignment(line: string): { name: string; expression: string } | null {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/u)
  if (!match) {
    return null
  }
  return {
    name: match[1] ?? '',
    expression: match[2] ?? '',
  }
}

class StubPyodide {
  readonly globals = new StubGlobals()

  private stdout: BatchedSink | null = null
  private stderr: BatchedSink | null = null

  async loadPackage(_name: string): Promise<void> {
    return
  }

  setStdout(stream: BatchedSink): void {
    this.stdout = stream
  }

  setStderr(stream: BatchedSink): void {
    this.stderr = stream
  }

  async runPythonAsync(source: string): Promise<unknown> {
    const lines = source.split('\n')
    let lastResult: unknown = undefined

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        continue
      }

      if (
        line.startsWith('import ')
        || line.startsWith('from ')
        || line.startsWith('async def ')
        || line.startsWith('def ')
        || line.startsWith('await ')
        || line === 'pass'
        || line === 'try:'
        || line.startsWith('except ')
        || line.startsWith('finally:')
        || line.startsWith('_vuepyter_live_sync_workspace')
        || line.includes('__vuepyter_asyncio__')
      ) {
        continue
      }

      const printMatch = line.match(/^print\((.*)\)$/u)
      if (printMatch) {
        const value = evaluateExpression(printMatch[1] ?? '', this.globals)
        this.stdout?.batched?.(`${String(value)}\n`)
        continue
      }

      const assignment = formatAssignment(line)
      if (assignment) {
        const value = evaluateExpression(assignment.expression, this.globals)
        this.globals.set(assignment.name, value)
        lastResult = undefined
        continue
      }

      lastResult = evaluateExpression(line, this.globals)
    }

    return lastResult
  }

  destroy(): void {
    return
  }

  close(): void {
    return
  }

  terminate(): void {
    return
  }
}

export function installPyodideStub(): void {
  ;(globalThis as typeof globalThis & {
    loadPyodide?: (options: { indexURL: string }) => Promise<StubPyodide>
  }).loadPyodide = async () => new StubPyodide()
}
