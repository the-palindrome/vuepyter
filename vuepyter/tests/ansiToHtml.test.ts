import { describe, expect, it } from 'vitest'
import { ansiToHtml } from '@/utils/ansiToHtml'

describe('ansiToHtml', () => {
  it('renders ansi foreground color styles', () => {
    const html = ansiToHtml('\u001b[31mred\u001b[0m plain')
    expect(html).toContain('color: #b91c1c')
    expect(html).toContain('red')
    expect(html).toContain('plain')
  })

  it('supports style toggles and reset', () => {
    const html = ansiToHtml('\u001b[1;4mbold under\u001b[0m x')
    expect(html).toContain('font-weight: 700')
    expect(html).toContain('text-decoration: underline')
    expect(html).toContain('x')
  })

  it('optionally converts newlines to br tags', () => {
    const html = ansiToHtml('a\nb', { newlineToBr: true })
    expect(html).toContain('a<br />b')
  })
})
