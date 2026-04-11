import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '@/utils/htmlSanitize'

describe('sanitizeHtml', () => {
  it('removes unsafe tags and event handler attributes', () => {
    const sanitized = sanitizeHtml(
      '<div><script>alert(1)</script><img src="/ok.png" onerror="alert(2)" /></div>',
    )
    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('onerror')
    expect(sanitized).toContain('<img src="/ok.png">')
  })

  it('drops unsafe link protocols', () => {
    const sanitized = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(sanitized).toContain('<a>x</a>')
    expect(sanitized).not.toContain('javascript:')
  })

  it('adds secure rel for target blank links', () => {
    const sanitized = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>')
    expect(sanitized).toContain('rel="noopener noreferrer"')
  })

  it('keeps png data urls for images', () => {
    const sanitized = sanitizeHtml('<img src="data:image/png;base64,abc123" alt="ok" />')
    expect(sanitized).toContain('data:image/png;base64,abc123')
  })
})
