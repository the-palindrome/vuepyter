import { describe, expect, it } from 'vitest'
import { renderMarkdownToHtml } from '@/utils/markdownRender'

describe('renderMarkdownToHtml', () => {
  it('renders headings, emphasis, links, and lists', () => {
    const html = renderMarkdownToHtml(`# Title

This is **bold** and *italic* with [a link](https://example.com).

- one
- two
`)

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<a href="https://example.com">a link</a>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
  })

  it('renders fenced code blocks as escaped html', () => {
    const html = renderMarkdownToHtml('```\nprint("<x>")\n```')
    expect(html).toContain('<pre><code>print("&lt;x&gt;")</code></pre>')
  })

  it('sanitizes injected html attributes by default', () => {
    const html = renderMarkdownToHtml('[bad](javascript:alert(1))')
    expect(html).toContain('<a>bad</a>')
    expect(html).not.toContain('javascript:')
  })

  it('can skip sanitization when requested', () => {
    const html = renderMarkdownToHtml('[x](https://safe.example)', { sanitize: false })
    expect(html).toContain('<a href="https://safe.example">x</a>')
  })

  it('renders KaTeX math in markdown output', () => {
    const html = renderMarkdownToHtml('Inline: $x^2$')

    expect(html).toContain('class="katex"')
    expect(html).toContain('class="katex-html"')
  })
})
