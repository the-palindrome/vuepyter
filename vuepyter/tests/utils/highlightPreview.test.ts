import { describe, expect, it } from 'vitest'
import { highlightPreviewLine } from '@/utils/highlightPreview'

describe('utils/highlightPreview', () => {
  it('escapes raw previews when no syntax parser is available', () => {
    expect(highlightPreviewLine('<tag attr="1">', 'raw')).toBe('&lt;tag attr=&quot;1&quot;&gt;')
  })

  it('highlights python content and only renders the first line', () => {
    const html = highlightPreviewLine('print("hello")\nprint("second")', 'python')

    expect(html).toContain('print')
    expect(html).toContain('&quot;hello&quot;')
    expect(html).not.toContain('second')
    expect(html).toContain('<span class="')
  })

  it('falls back to an ellipsis preview for empty content', () => {
    expect(highlightPreviewLine('', 'markdown')).toContain('...')
  })
})
