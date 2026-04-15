import { describe, expect, it } from 'vitest'
import { useNotebookModel } from '@/composables/useNotebookModel'
import { createNotebookCell, createNotebookDocument } from '@/utils/nbformat'

describe('composables/useNotebookModel edge cases', () => {
  it('falls back to allowed cell types and clamps active selection changes', () => {
    const model = useNotebookModel({
      allowedCellTypes: ['markdown'],
      modelValue: createNotebookDocument({
        cells: [
          createNotebookCell('markdown', { id: 'md-1', source: '# heading' }),
          createNotebookCell('markdown', { id: 'md-2', source: 'body' }),
        ],
      }),
    })

    const created = model.createCell('raw')
    const added = model.addCell(99, 'code')
    const selectedId = model.activeCellId.value

    model.setActiveCellId('missing-id')
    expect(model.activeCellId.value).toBe(selectedId)

    model.setActiveCellIndex(99)

    expect(created.cell_type).toBe('markdown')
    expect(added.cell_type).toBe('markdown')
    expect(model.activeCellIndex.value).toBe(model.cells.value.length - 1)
  })

  it('normalizes inserted cells, clamps movement, and serializes through nbformat helpers', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({}, { withStarterCell: false }),
    })

    model.insertCell({
      id: 'raw-source',
      cell_type: 'raw',
      source: ['alpha\n', 'beta'] as unknown as string,
      metadata: null as unknown as Record<string, unknown>,
    }, -10)

    model.addCell(1, 'code')
    const previousLastId = model.cells.value.at(-1)?.id ?? null
    model.moveCell(99, -1)

    expect(model.cells.value).toHaveLength(3)
    expect(model.cells.value[0]?.id).toBe(previousLastId)
    expect(model.cells.value.some((cell) => cell.id === 'raw-source')).toBe(true)
    expect(model.getCellById('raw-source')).toMatchObject({
      source: 'alpha\nbeta',
      metadata: {},
    })
    expect(model.activeCellId.value).toBe(previousLastId)
    expect(model.toNbformatDocument()).toEqual(model.serialize())
  })

  it('resets outputs across code cells and ignores invalid updates/deletes', () => {
    const model = useNotebookModel({
      modelValue: createNotebookDocument({
        cells: [
          createNotebookCell('code', {
            id: 'code-a',
            source: 'a = 1',
            execution_count: 2,
            outputs: [{ output_type: 'stream', name: 'stdout', text: 'a\n' }],
          }),
          createNotebookCell('markdown', { id: 'md-1', source: 'note' }),
          createNotebookCell('code', {
            id: 'code-b',
            source: 'b = 2',
            execution_count: 3,
            outputs: [{ output_type: 'display_data', data: { 'text/plain': 'b' }, metadata: {} }],
          }),
        ],
      }),
    })

    expect(model.updateCell('missing', { source: 'noop' })).toBeNull()
    expect(model.setCellOutputs('missing', [{ output_type: 'stream', name: 'stdout', text: 'noop' }])).toBeNull()
    expect(model.deleteCell(99)).toBeNull()

    model.resetExecutionState()

    expect(model.getCellById('code-a')).toMatchObject({
      execution_count: null,
      outputs: [],
    })
    expect(model.getCellById('code-b')).toMatchObject({
      execution_count: null,
      outputs: [],
    })
    expect(model.getCellById('md-1')).toMatchObject({
      cell_type: 'markdown',
      source: 'note',
    })
  })
})
