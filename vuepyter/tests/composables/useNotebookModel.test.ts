import { describe, expect, it } from 'vitest'
import { useNotebookModel } from '@/composables/useNotebookModel'
import { createNotebookCell, createNotebookDocument } from '@/utils/nbformat'

describe('composables/useNotebookModel', () => {
  it('initializes with a starter code cell and active cell', () => {
    const model = useNotebookModel()

    expect(model.cells.value).toHaveLength(1)
    expect(model.cells.value[0]?.cell_type).toBe('code')
    expect(model.activeCellIndex.value).toBe(0)
    expect(model.activeCellId.value).toBe(model.cells.value[0]?.id ?? null)
  })

  it('inserts and adds cells at bounded indexes and updates active cell', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument(undefined, { withStarterCell: false }),
    })

    const first = createNotebookCell('code', { id: 'first', source: 'a = 1' })
    model.insertCell(first, 10)
    expect(model.cells.value.some((cell) => cell.id === 'first')).toBe(true)

    const added = model.addCell(0, 'markdown')
    expect(added.cell_type).toBe('markdown')
    expect(model.cells.value[0]?.cell_type).toBe('markdown')
    expect(model.activeCellId.value).toBe(added.id)
  })

  it('updates source and converts cell types with code defaults', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({
        cells: [createNotebookCell('markdown', { id: 'md-1', source: '# old' })],
      }),
    })

    model.setCellSource('md-1', '# new')
    expect(model.getCellById('md-1')?.source).toBe('# new')

    model.setCellType('md-1', 'code')
    const converted = model.getCellById('md-1') as { cell_type: string; outputs?: unknown[]; execution_count?: number | null }
    expect(converted.cell_type).toBe('code')
    expect(converted.execution_count).toBeNull()
    expect(converted.outputs).toEqual([])
  })

  it('sets and clears outputs for code cells only', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({
        cells: [
          createNotebookCell('code', { id: 'code-1', source: 'print(1)' }),
          createNotebookCell('markdown', { id: 'md-1', source: 'text' }),
        ],
      }),
    })

    const outputs = [{ output_type: 'stream' as const, name: 'stdout', text: '1\n' }]
    model.setCellOutputs('code-1', outputs, 1)
    model.setCellOutputs('md-1', outputs, 99)

    const code = model.getCellById('code-1') as { outputs: unknown[]; execution_count: number | null }
    const markdown = model.getCellById('md-1') as { cell_type: string; outputs?: unknown[] }
    expect(code.outputs[0]).toMatchObject(outputs[0] as Record<string, unknown>)
    expect(code.execution_count).toBe(1)
    expect(markdown.cell_type).toBe('markdown')
    expect(markdown.outputs).toBeUndefined()

    model.clearOutputs('code-1')
    expect((model.getCellById('code-1') as { outputs: unknown[]; execution_count: number | null }).outputs).toEqual([])
    expect((model.getCellById('code-1') as { outputs: unknown[]; execution_count: number | null }).execution_count).toBeNull()
  })

  it('moves and removes cells while maintaining valid active selection', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({
        cells: [
          createNotebookCell('code', { id: 'a' }),
          createNotebookCell('code', { id: 'b' }),
          createNotebookCell('code', { id: 'c' }),
        ],
      }),
    })

    model.setActiveCellId('b')
    model.moveCell(1, 0)
    expect(model.cells.value.map((cell) => cell.id)).toEqual(['b', 'a', 'c'])
    expect(model.activeCellId.value).toBe('b')

    model.removeCell('b')
    expect(model.cells.value.map((cell) => cell.id)).toEqual(['a', 'c'])
    expect(model.activeCellId.value).toBe('a')
    expect(model.activeCellIndex.value).toBe(0)
  })

  it('serializes to nbformat-compatible multiline source arrays', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({
        customRoot: 'keep',
        cells: [
          createNotebookCell('code', {
            id: 'code-1',
            source: 'line1\nline2\n',
            metadata: { tag: true },
          }),
        ],
      }),
    })

    const serialized = model.serialize()
    const cell = serialized.cells[0] as { source: string[]; metadata: Record<string, unknown> }

    expect(serialized.customRoot).toBe('keep')
    expect(cell.source).toEqual(['line1\n', 'line2\n'])
    expect(cell.metadata).toEqual({ tag: true })
  })
})
