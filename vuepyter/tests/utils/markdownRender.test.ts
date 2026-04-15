import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderMarkdownToHtml } from '@/utils/markdownRender'

describe('utils/markdownRender', () => {
  it('renders headings, inline styles, lists, and fenced code blocks', () => {
    const html = renderMarkdownToHtml(
      '# Title\n\nSome **bold** and *italic* text with `code`.\n\n- one\n- two\n\n```py\nprint(1)\n```',
    )

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(html).toContain('<pre><code>print(1)</code></pre>')
  })

  it('renders links and images and sanitizes unsafe URLs by default', () => {
    const html = renderMarkdown('[safe](https://example.com) [x](javascript:alert(1)) ![alt](https://img.test/a.png)')

    expect(html).toContain('<a href="https://example.com">safe</a>')
    expect(html).toContain('<a>x</a>')
    expect(html).not.toContain('javascript:alert')
    expect(html).toContain('<img src="https://img.test/a.png" alt="alt">')
  })

  it('can bypass sanitization when sanitize=false', () => {
    const html = renderMarkdownToHtml('[x](javascript:alert(1))', { sanitize: false })
    expect(html).toContain('href="javascript:alert(1"')
    expect(html).toContain('>x</a>)')
  })

  it('escapes raw html in markdown content', () => {
    const html = renderMarkdown('<script>alert(1)</script> **ok**')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<strong>ok</strong>')
  })

  it('returns an empty string for blank markdown', () => {
    expect(renderMarkdownToHtml('   \n\n')).toBe('')
  })

  it('renders inline and block LaTeX with KaTeX', () => {
    const inlineHtml = renderMarkdown('Euler identity: $e^{i\\pi}+1=0$')
    const blockHtml = renderMarkdown('$$\n\\int_0^1 x^2\\,dx\n$$')

    expect(inlineHtml).toContain('class="katex"')
    expect(inlineHtml).toContain('class="katex-html"')
    expect(blockHtml).toContain('class="katex-display"')
    expect(blockHtml).toContain('class="katex"')
  })

  it('does not parse latex delimiters inside inline code spans', () => {
    const html = renderMarkdown('`$not-math$` and $x^2$')

    expect(html).toContain('<code>$not-math$</code>')
    expect(html).toContain('class="katex"')
  })
})
