import { describe, expect, it } from 'vitest'
import {
  cloneNotebookDocument,
  createNotebookCell,
  createNotebookDocument,
  isNotebookDocument,
  normalizeNotebookDocument,
  parseNotebookJson,
  serializeNotebookDocument,
  stringifyNotebookJson,
} from '@/utils/nbformat'

describe('utils/nbformat', () => {
  it('creates a default nbformat v4.5 notebook with a starter code cell', () => {
    const notebook = createNotebookDocument()

    expect(notebook.nbformat).toBe(4)
    expect(notebook.nbformat_minor).toBe(5)
    expect(notebook.cells).toHaveLength(1)
    expect(notebook.cells[0]?.cell_type).toBe('code')
    expect((notebook.cells[0] as { execution_count?: number | null }).execution_count).toBeNull()
  })

  it('normalizes mixed multiline fields and preserves unknown keys', () => {
    const normalized = normalizeNotebookDocument({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: { kernelspec: { name: 'python3' }, customRoot: true },
      customNotebookKey: 'keep-me',
      cells: [
        {
          cell_type: 'code',
          source: ['print("hi")\n', 'x = 1'],
          metadata: { tags: ['demo'] },
          execution_count: 7,
          customCellKey: 'cell-extra',
          outputs: [
            {
              output_type: 'stream',
              name: 'stdout',
              text: ['hello\n', 'world\n'],
              extraOutputKey: 123,
            },
            {
              output_type: 'mystery_type',
              text: 'unknown payload',
            },
          ],
        },
      ],
    })

    const cell = normalized.cells[0]
    expect(normalized.customNotebookKey).toBe('keep-me')
    expect(cell?.source).toBe('print("hi")\nx = 1')
    expect(cell?.customCellKey).toBe('cell-extra')

    const stream = (cell as { outputs: Array<Record<string, unknown>> }).outputs[0]
    expect(stream?.text).toBe('hello\nworld\n')
    expect(stream?.extraOutputKey).toBe(123)

    const fallback = (cell as { outputs: Array<Record<string, unknown>> }).outputs[1]
    expect(fallback?.output_type).toBe('display_data')
    expect((fallback?.data as Record<string, unknown>)['text/plain']).toBe('unknown payload')
    expect((fallback?.metadata as Record<string, unknown>).__vuepyter_original_output_type).toBe(
      'mystery_type',
    )
  })

  it('serializes back to nbformat multiline arrays', () => {
    const notebook = normalizeNotebookDocument({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          id: 'cell-1',
          cell_type: 'code',
          source: 'a = 1\nprint(a)\n',
          metadata: {},
          execution_count: 1,
          outputs: [
            {
              output_type: 'stream',
              name: 'stdout',
              text: '1\n',
            },
          ],
        },
      ],
    })

    const serialized = serializeNotebookDocument(notebook)
    const serializedCell = serialized.cells[0] as {
      source: string[]
      outputs: Array<Record<string, unknown>>
    }
    const serializedOutput = serializedCell.outputs[0] as { text: string[] }

    expect(serializedCell.source).toEqual(['a = 1\n', 'print(a)\n'])
    expect(serializedOutput.text).toEqual(['1\n'])
  })

  it('parses and stringifies notebooks while preserving metadata structure', () => {
    const notebook = createNotebookDocument(
      {
        metadata: { kernelspec: { name: 'python3' }, nested: { keep: true } },
        customRoot: { keep: 'root' },
      },
      { withStarterCell: false },
    )
    notebook.cells.push(
      createNotebookCell('markdown', {
        id: 'md-1',
        source: '# Title\nBody',
        metadata: { section: 1 },
      }),
    )

    const json = stringifyNotebookJson(notebook, 2)
    const parsed = parseNotebookJson(json)

    expect(parsed.metadata).toEqual(notebook.metadata)
    expect(parsed.customRoot).toEqual({ keep: 'root' })
    expect(parsed.cells[0]?.source).toBe('# Title\nBody')
  })

  it('clones notebooks deeply', () => {
    const original = createNotebookDocument()
    const cloned = cloneNotebookDocument(original)

    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    expect(cloned.cells).not.toBe(original.cells)
  })

  it('validates notebook document shape', () => {
    expect(
      isNotebookDocument({
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {},
        cells: [],
      }),
    ).toBe(true)

    expect(isNotebookDocument({ nbformat: 4, nbformat_minor: 5, metadata: null, cells: [] })).toBe(
      false,
    )
    expect(isNotebookDocument({})).toBe(false)
  })
})
