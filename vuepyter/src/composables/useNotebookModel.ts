import { computed, ref, toValue, watch } from 'vue'
import type {
  CellOutput,
  NotebookCell,
  NotebookCellType,
  NotebookDocument,
  OutputMimeBundle,
  UseNotebookModelOptions,
  UseNotebookModelReturn,
  VuepyterModelValue,
} from '@/types'
import {
  createNotebookCell,
  createNotebookDocument,
  normalizeNotebookDocument,
  serializeNotebookDocument,
} from '@/utils/nbformat'

function clampIndex(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isIndex(value: string | number): value is number {
  return typeof value === 'number'
}

function toMimeBundle(value: unknown): OutputMimeBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return { ...(value as OutputMimeBundle) }
}

function normalizeOutput(output: Partial<CellOutput> & { output_type: string }): CellOutput {
  const raw = output as Record<string, unknown> & { output_type: string }

  if (raw.output_type === 'stream') {
    return {
      output_type: 'stream',
      name: typeof raw.name === 'string' ? raw.name : 'stdout',
      text: typeof raw.text === 'string' ? raw.text : '',
    }
  }

  if (raw.output_type === 'error') {
    return {
      output_type: 'error',
      ename: typeof raw.ename === 'string' ? raw.ename : 'Error',
      evalue: typeof raw.evalue === 'string' ? raw.evalue : '',
      traceback: Array.isArray(raw.traceback) ? raw.traceback.map((line: unknown) => String(line)) : [],
    }
  }

  if (raw.output_type === 'execute_result') {
    return {
      output_type: 'execute_result',
      execution_count: typeof raw.execution_count === 'number' && Number.isFinite(raw.execution_count)
        ? raw.execution_count
          : null,
      data: toMimeBundle(raw.data),
      metadata:
        raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
          ? { ...(raw.metadata as Record<string, unknown>) }
          : {},
    }
  }

  if (raw.output_type === 'display_data') {
    return {
      output_type: 'display_data',
      data: toMimeBundle(raw.data),
      metadata:
        raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
          ? { ...(raw.metadata as Record<string, unknown>) }
          : {},
    }
  }

  return {
    output_type: 'display_data',
    data: toMimeBundle(raw.data),
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? { ...(raw.metadata as Record<string, unknown>) }
        : {},
  }
}

function toCodeCell(sourceCell: NotebookCell, cellType: NotebookCellType): NotebookCell {
  if (cellType === 'code') {
    if (sourceCell.cell_type === 'code') {
      return sourceCell
    }
    return createNotebookCell('code', {
      ...sourceCell,
      cell_type: 'code',
      execution_count: null,
      outputs: [],
    })
  }

  return createNotebookCell(cellType, {
    ...sourceCell,
    cell_type: cellType,
  })
}

export function useNotebookModel(options: UseNotebookModelOptions = {}): UseNotebookModelReturn {
  const allowedCellTypes = computed<NotebookCellType[]>(() => {
    const provided = toValue(options.allowedCellTypes)
    if (!Array.isArray(provided) || provided.length === 0) {
      return ['code', 'markdown', 'raw']
    }
    return provided
  })

  const initialModel = toValue(options.modelValue)
  const notebook = ref<NotebookDocument>(
    normalizeNotebookDocument(initialModel ?? createNotebookDocument()),
  )
  const activeCellId = ref<string | null>(notebook.value.cells[0]?.id ?? null)

  const cells = computed(() => notebook.value.cells)

  const activeCellIndex = computed(() => {
    if (!activeCellId.value) {
      return -1
    }
    return notebook.value.cells.findIndex((cell) => cell.id === activeCellId.value)
  })

  function ensureActiveCell(): void {
    const current = activeCellId.value
    if (current && notebook.value.cells.some((cell) => cell.id === current)) {
      return
    }
    activeCellId.value = notebook.value.cells[0]?.id ?? null
  }

  function setNotebook(value: VuepyterModelValue | null | undefined): void {
    notebook.value = normalizeNotebookDocument(value ?? createNotebookDocument())
    ensureActiveCell()
  }

  watch(
    () => toValue(options.modelValue),
    (value) => {
      if (!value) {
        return
      }
      setNotebook(value)
    },
  )

  function setActiveCellId(cellId: string | null): void {
    if (!cellId) {
      activeCellId.value = notebook.value.cells[0]?.id ?? null
      return
    }

    if (notebook.value.cells.some((cell) => cell.id === cellId)) {
      activeCellId.value = cellId
    }
  }

  function setActiveCellIndex(index: number): void {
    if (notebook.value.cells.length === 0) {
      activeCellId.value = null
      return
    }
    const safeIndex = clampIndex(index, 0, notebook.value.cells.length - 1)
    activeCellId.value = notebook.value.cells[safeIndex]?.id ?? null
  }

  function createCell(cellType: NotebookCellType = 'code', overrides: Partial<NotebookCell> = {}): NotebookCell {
    const safeType = allowedCellTypes.value.includes(cellType)
      ? cellType
      : (allowedCellTypes.value[0] ?? 'code')
    return createNotebookCell(safeType, overrides)
  }

  function insertCell(cell: NotebookCell, index = notebook.value.cells.length): NotebookCell {
    const safeIndex = clampIndex(index, 0, notebook.value.cells.length)
    const next = [...notebook.value.cells]
    const normalizedCell = normalizeNotebookDocument({
      ...notebook.value,
      cells: [cell],
    }).cells[0]
    next.splice(safeIndex, 0, normalizedCell ?? createNotebookCell(cell.cell_type, cell))
    notebook.value = {
      ...notebook.value,
      cells: next,
    }
    activeCellId.value = (normalizedCell ?? cell).id
    return normalizedCell ?? cell
  }

  function addCell(index = activeCellIndex.value + 1, cellType: NotebookCellType = 'code'): NotebookCell {
    const safeType = allowedCellTypes.value.includes(cellType)
      ? cellType
      : (allowedCellTypes.value[0] ?? 'code')
    const cell = createNotebookCell(safeType)
    return insertCell(cell, Number.isFinite(index) ? index : notebook.value.cells.length)
  }

  function resolveCellId(cellIdOrIndex: string | number): string | null {
    if (isIndex(cellIdOrIndex)) {
      return notebook.value.cells[cellIdOrIndex]?.id ?? null
    }
    return cellIdOrIndex
  }

  function updateCell(
    cellIdOrIndex: string | number,
    patch: Partial<NotebookCell> | ((cell: NotebookCell) => NotebookCell),
  ): NotebookCell | null {
    const cellId = resolveCellId(cellIdOrIndex)
    if (!cellId) {
      return null
    }
    const index = notebook.value.cells.findIndex((cell) => cell.id === cellId)
    if (index < 0) {
      return null
    }

    const current = notebook.value.cells[index]
    if (!current) {
      return null
    }
    const nextCell =
      typeof patch === 'function'
        ? patch(current)
        : normalizeNotebookDocument({
            ...notebook.value,
            cells: [{ ...current, ...patch }],
          }).cells[0]

    if (!nextCell) {
      return null
    }

    const nextCells = [...notebook.value.cells]
    nextCells.splice(index, 1, nextCell)
    notebook.value = {
      ...notebook.value,
      cells: nextCells,
    }
    return nextCell
  }

  function setCellSource(cellIdOrIndex: string | number, source: string): NotebookCell | null {
    return updateCell(cellIdOrIndex, (cell) => ({
      ...cell,
      source,
    }))
  }

  function setCellType(cellIdOrIndex: string | number, cellType: NotebookCellType): NotebookCell | null {
    return updateCell(cellIdOrIndex, (cell) => toCodeCell(cell, cellType))
  }

  function setCellOutputs(
    cellIdOrIndex: string | number,
    outputs: Array<Partial<CellOutput> & { output_type: string }>,
    executionCount: number | null = null,
  ): NotebookCell | null {
    const normalized = outputs.map((output) => normalizeOutput(output))
    return updateCell(cellIdOrIndex, (cell) => {
      if (cell.cell_type !== 'code') {
        return cell
      }
      return {
        ...cell,
        outputs: normalized,
        execution_count: executionCount,
      }
    })
  }

  function clearOutputs(cellIdOrIndex?: string | number): void {
    const targetCellId = typeof cellIdOrIndex === 'undefined' ? null : resolveCellId(cellIdOrIndex)
    const next = notebook.value.cells.map((cell) => {
      if (cell.cell_type !== 'code') {
        return cell
      }
      if (targetCellId && cell.id !== targetCellId) {
        return cell
      }
      return {
        ...cell,
        outputs: [],
        execution_count: null,
      }
    })

    notebook.value = {
      ...notebook.value,
      cells: next,
    }
  }

  function resetExecutionState(): void {
    clearOutputs()
  }

  function removeCell(cellId: string): NotebookCell | null {
    const index = notebook.value.cells.findIndex((cell) => cell.id === cellId)
    if (index < 0) {
      return null
    }

    const removed = notebook.value.cells[index] ?? null
    const nextCells = notebook.value.cells.filter((cell) => cell.id !== cellId)
    notebook.value = {
      ...notebook.value,
      cells: nextCells,
    }

    if (activeCellId.value === cellId) {
      const fallbackIndex = clampIndex(index, 0, Math.max(0, nextCells.length - 1))
      activeCellId.value = nextCells[fallbackIndex]?.id ?? null
    }

    ensureActiveCell()
    return removed
  }

  function deleteCell(index: number): NotebookCell | null {
    const cell = notebook.value.cells[index]
    if (!cell) {
      return null
    }
    return removeCell(cell.id)
  }

  function moveCell(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || notebook.value.cells.length <= 1) {
      return
    }

    const safeFrom = clampIndex(fromIndex, 0, notebook.value.cells.length - 1)
    const safeTo = clampIndex(toIndex, 0, notebook.value.cells.length - 1)
    if (safeFrom === safeTo) {
      return
    }

    const nextCells = [...notebook.value.cells]
    const [moved] = nextCells.splice(safeFrom, 1)
    if (!moved) {
      return
    }
    nextCells.splice(safeTo, 0, moved)

    notebook.value = {
      ...notebook.value,
      cells: nextCells,
    }
    activeCellId.value = moved.id
  }

  function getCellById(cellId: string): NotebookCell | undefined {
    return notebook.value.cells.find((cell) => cell.id === cellId)
  }

  function serialize() {
    return serializeNotebookDocument(notebook.value)
  }

  function toNbformatDocument() {
    return serialize()
  }

  ensureActiveCell()

  return {
    notebook,
    cells,
    activeCellId,
    activeCellIndex,
    setNotebook,
    setActiveCellId,
    setActiveCellIndex,
    createCell,
    addCell,
    insertCell,
    updateCell,
    setCellSource,
    setCellType,
    setCellOutputs,
    clearOutputs,
    resetExecutionState,
    deleteCell,
    removeCell,
    moveCell,
    getCellById,
    serialize,
    toNbformatDocument,
  }
}
