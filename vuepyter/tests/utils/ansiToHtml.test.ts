import { describe, expect, it } from 'vitest'
import { ansiToHtml } from '@/utils/ansiToHtml'

describe('utils/ansiToHtml', () => {
  it('returns escaped plain text when there are no ANSI codes', () => {
    expect(ansiToHtml('<tag>plain</tag>')).toBe('&lt;tag&gt;plain&lt;/tag&gt;')
  })

  it('renders ANSI style sequences and supports reset', () => {
    const output = ansiToHtml('\u001b[1;31mError\u001b[0m done')

    expect(output).toContain('font-weight: 700')
    expect(output).toContain('color: #b91c1c')
    expect(output).toContain('Error')
    expect(output).toContain(' done')
  })

  it('supports combined foreground/background and selective resets', () => {
    const output = ansiToHtml('\u001b[32;44mtext\u001b[39m fg-reset \u001b[49m bg-reset')

    expect(output).toContain('color: #15803d')
    expect(output).toContain('background-color: #1d4ed8')
    expect(output).toContain('fg-reset')
    expect(output).toContain('bg-reset')
  })

  it('converts newlines to <br /> when requested', () => {
    const output = ansiToHtml('line1\nline2', { newlineToBr: true })
    expect(output).toBe('line1<br />line2')
  })

  it('returns an empty string for empty input', () => {
    expect(ansiToHtml('')).toBe('')
    expect(ansiToHtml('', { newlineToBr: true })).toBe('')
  })
})
