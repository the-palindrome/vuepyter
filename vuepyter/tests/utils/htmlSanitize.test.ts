import { describe, expect, it, vi } from 'vitest'
import { escapeHtml, sanitizeHtml } from '@/utils/htmlSanitize'

describe('utils/htmlSanitize', () => {
  it('escapes unsafe html characters', () => {
    expect(escapeHtml('<div>& hello ></div>')).toBe('&lt;div&gt;&amp; hello &gt;&lt;/div&gt;')
  })

  it('removes disallowed tags and strips unsafe attributes/urls', () => {
    const html = sanitizeHtml(
      [
        '<p onclick="boom()">hello',
        '<script>alert(1)</script>',
        '<a href="javascript:alert(1)" target="_blank" title="x">link</a>',
        '<img src="data:image/png;base64,abc123" onerror="oops()" />',
        '<img src="data:text/html;base64,bad" />',
        '</p>',
      ].join(''),
    )

    expect(html).toContain('<p>hello')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('onclick=')
    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('javascript:alert')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('src="data:image/png;base64,abc123"')
    expect(html).not.toContain('data:text/html')
  })

  it('preserves allowed tags and attributes', () => {
    const html = sanitizeHtml(
      '<div class="shell" title="ok"><span class="x">text</span><a href="/docs">docs</a></div>',
    )

    expect(html).toBe(
      '<div class="shell" title="ok"><span class="x">text</span><a href="/docs">docs</a></div>',
    )
  })

  it('keeps span style and aria-hidden attributes for KaTeX markup', () => {
    const html = sanitizeHtml('<span class="katex-html" aria-hidden="true"><span style="top:-3em">x</span></span>')

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('style="top:-3em"')
  })

  it('falls back to escaped text when document is unavailable', () => {
    const original = globalThis.document
    vi.stubGlobal('document', undefined)
    try {
      expect(sanitizeHtml('<p>unsafe</p>')).toBe('&lt;p&gt;unsafe&lt;/p&gt;')
    } finally {
      vi.stubGlobal('document', original)
    }
  })
})
