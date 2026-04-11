import { describe, expect, it } from 'vitest'
import {
  createNotebookDocument,
  normalizeNotebookDocument,
  serializeNotebookDocument,
} from '@/utils/nbformat'

describe('nbformat utilities', () => {
  it('normalizes multiline sources and preserves unknown keys', () => {
    const input = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { name: 'python3' },
      },
      customRoot: { keep: true },
      cells: [
        {
          id: 'cell-1',
          cell_type: 'code',
          source: ['print("hello")\n', 'x = 1'],
          metadata: { trusted: true, customMeta: 42 },
          execution_count: 1,
          outputs: [
            {
              output_type: 'stream',
              name: 'stdout',
              text: ['hello\n'],
              extraStream: 'x',
            },
          ],
          extraCell: 'kept',
        },
      ],
    }

    const normalized = normalizeNotebookDocument(input)
    expect(normalized.customRoot).toEqual({ keep: true })
    expect(normalized.cells[0]?.source).toBe('print("hello")\nx = 1')
    expect(normalized.cells[0]?.metadata.customMeta).toBe(42)
    expect(normalized.cells[0]?.extraCell).toBe('kept')

    const serialized = serializeNotebookDocument(normalized)
    const serializedCell = serialized.cells[0]
    expect(serializedCell?.source).toEqual(['print("hello")\n', 'x = 1'])
    expect((serializedCell as { extraCell?: string }).extraCell).toBe('kept')
    expect(serialized.customRoot).toEqual({ keep: true })
  })

  it('creates default notebook with starter code cell', () => {
    const notebook = createNotebookDocument()
    expect(notebook.nbformat).toBe(4)
    expect(notebook.nbformat_minor).toBe(5)
    expect(notebook.cells).toHaveLength(1)
    expect(notebook.cells[0]?.cell_type).toBe('code')
    expect(notebook.cells[0]?.id).toBeTruthy()
  })

  it('falls back unknown output types to display_data', () => {
    const normalized = normalizeNotebookDocument({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'code',
          source: 'x',
          metadata: {},
          outputs: [
            {
              output_type: 'custom_output_type',
              text: 'value',
            },
          ],
        },
      ],
    })

    const output = normalized.cells[0]?.cell_type === 'code' ? normalized.cells[0].outputs[0] : null
    expect(output?.output_type).toBe('display_data')
    if (output?.output_type === 'display_data') {
      expect(output.data['text/plain']).toBe('value')
    }
  })
})
