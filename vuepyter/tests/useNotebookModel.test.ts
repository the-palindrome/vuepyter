import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNotebookModel } from '@/composables/useNotebookModel'
import { createNotebookDocument } from '@/utils/nbformat'

describe('useNotebookModel', () => {
  it('initializes from model and supports CRUD operations by index/id', () => {
    const model = ref(
      createNotebookDocument({
        cells: [
          {
            id: 'a',
            cell_type: 'code',
            source: 'x = 1',
            metadata: {},
            execution_count: null,
            outputs: [],
          },
        ],
      }),
    )

    const notebook = useNotebookModel({ modelValue: model })
    expect(notebook.cells.value).toHaveLength(1)
    expect(notebook.activeCellIndex.value).toBe(0)

    notebook.addCell(1, 'markdown')
    expect(notebook.cells.value).toHaveLength(2)
    expect(notebook.cells.value[1]?.cell_type).toBe('markdown')

    notebook.setCellSource(1, '# Header')
    expect(notebook.cells.value[1]?.source).toBe('# Header')

    notebook.setCellType(1, 'code')
    const changed = notebook.cells.value[1]
    expect(changed?.cell_type).toBe('code')
    if (changed?.cell_type === 'code') {
      expect(changed.outputs).toEqual([])
    }

    notebook.moveCell(1, 0)
    expect(notebook.cells.value[0]?.id).toBe(changed?.id)

    notebook.deleteCell(0)
    expect(notebook.cells.value).toHaveLength(1)
  })

  it('sets outputs and resets execution state', () => {
    const notebook = useNotebookModel({
      modelValue: createNotebookDocument(),
    })
    const first = notebook.cells.value[0]
    expect(first?.cell_type).toBe('code')
    if (!first || first.cell_type !== 'code') {
      return
    }

    notebook.setCellOutputs(first.id, [
      {
        output_type: 'stream',
        name: 'stdout',
        text: 'hello',
      },
    ], 3)

    const updated = notebook.cells.value[0]
    expect(updated?.cell_type).toBe('code')
    if (updated?.cell_type === 'code') {
      expect(updated.execution_count).toBe(3)
      expect(updated.outputs).toHaveLength(1)
    }

    notebook.resetExecutionState()
    const reset = notebook.cells.value[0]
    expect(reset?.cell_type).toBe('code')
    if (reset?.cell_type === 'code') {
      expect(reset.execution_count).toBeNull()
      expect(reset.outputs).toEqual([])
    }
  })

  it('serializes to nbformat multiline arrays', () => {
    const notebook = useNotebookModel({
      modelValue: createNotebookDocument({
        cells: [
          {
            id: 'x',
            cell_type: 'code',
            source: 'line1\nline2',
            metadata: {},
            execution_count: null,
            outputs: [],
          },
        ],
      }),
    })

    const serialized = notebook.serialize()
    expect(serialized.cells[0]?.source).toEqual(['line1\n', 'line2'])
  })
})
