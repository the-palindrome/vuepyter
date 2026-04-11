import { DEFAULT_NBFORMAT, DEFAULT_NBFORMAT_MINOR } from '@/constants'
import type {
  CellOutput,
  CodeCell,
  DisplayDataOutput,
  ErrorOutput,
  ExecuteResultOutput,
  NotebookCell,
  NotebookCellType,
  NotebookDocument,
  NotebookMetadata,
  RawCell,
  SerializedNotebookDocument,
  StreamOutput,
} from '@/types'

const NOTEBOOK_ROOT_KEYS = new Set(['nbformat', 'nbformat_minor', 'metadata', 'cells'])
const CELL_ROOT_KEYS = new Set(['id', 'cell_type', 'source', 'metadata', 'execution_count', 'outputs'])
const OUTPUT_ROOT_KEYS = new Set([
  'output_type',
  'name',
  'text',
  'data',
  'metadata',
  'execution_count',
  'ename',
  'evalue',
  'traceback',
])

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T
  }
  if (value && typeof value === 'object') {
    const cloned: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = deepClone(nested)
    }
    return cloned as T
  }
  return value
}

function normalizeMetadata(value: unknown): NotebookMetadata {
  return deepClone(asRecord(value))
}

function normalizeMultiline(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((part) => String(part ?? '')).join('')
  }
  if (typeof value === 'string') {
    return value
  }
  if (value == null) {
    return ''
  }
  return String(value)
}

function splitMultiline(value: string): string[] {
  if (!value) {
    return []
  }
  return value.match(/[^\n]*\n|[^\n]+$/gu) ?? [value]
}

function generateCellId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cell-${Math.random().toString(36).slice(2, 10)}`
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stripKnownKeys(record: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const extras: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!keys.has(key)) {
      extras[key] = deepClone(value)
    }
  }
  return extras
}

function normalizeMimeBundle(value: unknown): Record<string, unknown> {
  return deepClone(asRecord(value))
}

function normalizeTraceback(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }
  if (typeof value === 'string' && value) {
    return splitMultiline(value)
  }
  return []
}

function normalizeOutput(value: unknown): CellOutput {
  const raw = asRecord(value)
  const outputType = typeof raw.output_type === 'string' ? raw.output_type : 'display_data'
  const extras = stripKnownKeys(raw, OUTPUT_ROOT_KEYS)

  if (outputType === 'stream') {
    const output: StreamOutput = {
      ...extras,
      output_type: 'stream',
      name: typeof raw.name === 'string' ? raw.name : 'stdout',
      text: normalizeMultiline(raw.text),
      data: normalizeMimeBundle(raw.data),
    }
    return output
  }

  if (outputType === 'execute_result') {
    const output: ExecuteResultOutput = {
      ...extras,
      output_type: 'execute_result',
      execution_count: numberOrNull(raw.execution_count),
      data: normalizeMimeBundle(raw.data),
      metadata: normalizeMetadata(raw.metadata),
    }
    return output
  }

  if (outputType === 'display_data') {
    const output: DisplayDataOutput = {
      ...extras,
      output_type: 'display_data',
      data: normalizeMimeBundle(raw.data),
      metadata: normalizeMetadata(raw.metadata),
    }
    return output
  }

  if (outputType === 'error') {
    const output: ErrorOutput = {
      ...extras,
      output_type: 'error',
      ename: typeof raw.ename === 'string' ? raw.ename : 'Error',
      evalue: typeof raw.evalue === 'string' ? raw.evalue : '',
      traceback: normalizeTraceback(raw.traceback),
      data: normalizeMimeBundle(raw.data),
    }
    return output
  }

  const fallbackData =
    typeof raw.text === 'string'
      ? raw.text
      : (() => {
          try {
            return JSON.stringify(raw)
          } catch {
            return String(raw)
          }
        })()

  const output: DisplayDataOutput = {
    ...extras,
    output_type: 'display_data',
    data: {
      ...normalizeMimeBundle(raw.data),
      'text/plain': fallbackData,
    },
    metadata: {
      ...normalizeMetadata(raw.metadata),
      __vuepyter_original_output_type: outputType,
    },
  }
  return output
}

function normalizeCell(value: unknown): NotebookCell {
  const raw = asRecord(value)
  const cellType = raw.cell_type === 'markdown' || raw.cell_type === 'raw' ? raw.cell_type : 'code'
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateCellId()
  const source = normalizeMultiline(raw.source)
  const metadata = normalizeMetadata(raw.metadata)
  const extras = stripKnownKeys(raw, CELL_ROOT_KEYS)

  if (cellType === 'markdown') {
    return {
      ...extras,
      id,
      cell_type: 'markdown',
      source,
      metadata,
    }
  }

  if (cellType === 'raw') {
    const rawCell: RawCell = {
      ...extras,
      id,
      cell_type: 'raw',
      source,
      metadata,
    }
    return rawCell
  }

  const outputs = Array.isArray(raw.outputs) ? raw.outputs.map((output) => normalizeOutput(output)) : []
  const codeCell: CodeCell = {
    ...extras,
    id,
    cell_type: 'code',
    source,
    metadata,
    execution_count: numberOrNull(raw.execution_count),
    outputs,
  }
  return codeCell
}

export function createNotebookCell(
  cellType: NotebookCellType = 'code',
  overrides: Partial<NotebookCell> = {},
): NotebookCell {
  const id = typeof overrides.id === 'string' && overrides.id.trim() ? overrides.id : generateCellId()
  const metadata = normalizeMetadata(overrides.metadata)
  const source = typeof overrides.source === 'string' ? overrides.source : ''
  const extra = stripKnownKeys(asRecord(overrides), CELL_ROOT_KEYS)

  if (cellType === 'markdown') {
    return {
      ...extra,
      id,
      cell_type: 'markdown',
      source,
      metadata,
    }
  }

  if (cellType === 'raw') {
    return {
      ...extra,
      id,
      cell_type: 'raw',
      source,
      metadata,
    }
  }

  return {
    ...extra,
    id,
    cell_type: 'code',
    source,
    metadata,
    execution_count: numberOrNull(overrides.execution_count),
    outputs: Array.isArray(overrides.outputs)
      ? overrides.outputs.map((output) => normalizeOutput(output))
      : [],
  }
}

export function createNotebookDocument(
  overrides: Partial<NotebookDocument> = {},
  options: { defaultCellType?: NotebookCellType; withStarterCell?: boolean } = {},
): NotebookDocument {
  const extras = stripKnownKeys(asRecord(overrides), NOTEBOOK_ROOT_KEYS)
  const normalizedCells = Array.isArray(overrides.cells)
    ? overrides.cells.map((cell) => normalizeCell(cell))
    : []

  const cells =
    normalizedCells.length > 0 || options.withStarterCell === false
      ? normalizedCells
      : [createNotebookCell(options.defaultCellType ?? 'code')]

  return {
    ...extras,
    nbformat:
      typeof overrides.nbformat === 'number' && Number.isFinite(overrides.nbformat)
        ? overrides.nbformat
        : DEFAULT_NBFORMAT,
    nbformat_minor:
      typeof overrides.nbformat_minor === 'number' && Number.isFinite(overrides.nbformat_minor)
        ? overrides.nbformat_minor
        : DEFAULT_NBFORMAT_MINOR,
    metadata: normalizeMetadata(overrides.metadata),
    cells,
  }
}

export function normalizeNotebookDocument(value: unknown): NotebookDocument {
  return createNotebookDocument(asRecord(value))
}

export function cloneNotebookDocument(document: NotebookDocument): NotebookDocument {
  return normalizeNotebookDocument(document)
}

function serializeOutput(output: CellOutput): Record<string, unknown> {
  const raw = asRecord(output)
  const outputType = typeof raw.output_type === 'string' ? raw.output_type : 'display_data'
  const extras = stripKnownKeys(raw, OUTPUT_ROOT_KEYS)

  if (outputType === 'stream') {
    return {
      ...extras,
      output_type: 'stream',
      name: typeof raw.name === 'string' ? raw.name : 'stdout',
      text: splitMultiline(normalizeMultiline(raw.text)),
    }
  }

  if (outputType === 'execute_result') {
    return {
      ...extras,
      output_type: 'execute_result',
      execution_count: numberOrNull(raw.execution_count),
      data: deepClone(normalizeMimeBundle(raw.data)),
      metadata: deepClone(normalizeMetadata(raw.metadata)),
    }
  }

  if (outputType === 'display_data') {
    return {
      ...extras,
      output_type: 'display_data',
      data: deepClone(normalizeMimeBundle(raw.data)),
      metadata: deepClone(normalizeMetadata(raw.metadata)),
    }
  }

  if (outputType === 'error') {
    return {
      ...extras,
      output_type: 'error',
      ename: typeof raw.ename === 'string' ? raw.ename : 'Error',
      evalue: typeof raw.evalue === 'string' ? raw.evalue : '',
      traceback: normalizeTraceback(raw.traceback),
    }
  }

  return {
    ...deepClone(raw),
    output_type: outputType,
  }
}

function serializeCell(cell: NotebookCell): Record<string, unknown> {
  const raw = asRecord(cell)
  const common = {
    ...stripKnownKeys(raw, CELL_ROOT_KEYS),
    id: typeof raw.id === 'string' ? raw.id : generateCellId(),
    cell_type: raw.cell_type,
    source: splitMultiline(normalizeMultiline(raw.source)),
    metadata: deepClone(normalizeMetadata(raw.metadata)),
  }

  if (raw.cell_type === 'code') {
    return {
      ...common,
      execution_count: numberOrNull(raw.execution_count),
      outputs: Array.isArray(raw.outputs) ? raw.outputs.map((output) => serializeOutput(output)) : [],
    }
  }

  return common
}

export function serializeNotebookDocument(document: NotebookDocument): SerializedNotebookDocument {
  const raw = asRecord(document)
  const cells = Array.isArray(raw.cells) ? raw.cells.map((cell) => serializeCell(normalizeCell(cell))) : []

  return {
    ...stripKnownKeys(raw, NOTEBOOK_ROOT_KEYS),
    nbformat:
      typeof raw.nbformat === 'number' && Number.isFinite(raw.nbformat)
        ? raw.nbformat
        : DEFAULT_NBFORMAT,
    nbformat_minor:
      typeof raw.nbformat_minor === 'number' && Number.isFinite(raw.nbformat_minor)
        ? raw.nbformat_minor
        : DEFAULT_NBFORMAT_MINOR,
    metadata: deepClone(normalizeMetadata(raw.metadata)),
    cells: cells as SerializedNotebookDocument['cells'],
  }
}

export function parseNotebookJson(value: string): NotebookDocument {
  const parsed = JSON.parse(value) as unknown
  return normalizeNotebookDocument(parsed)
}

export function stringifyNotebookJson(document: NotebookDocument, space = 2): string {
  return JSON.stringify(serializeNotebookDocument(document), null, space)
}

export function isNotebookDocument(value: unknown): value is NotebookDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const raw = value as Record<string, unknown>
  return (
    typeof raw.nbformat === 'number' &&
    typeof raw.nbformat_minor === 'number' &&
    Array.isArray(raw.cells) &&
    typeof raw.metadata === 'object' &&
    raw.metadata !== null &&
    !Array.isArray(raw.metadata)
  )
}
