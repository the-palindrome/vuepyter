import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

describe('components/MarkdownRenderer', () => {
  it('renders inline and block latex with KaTeX', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        source: 'Inline $x^2$ equation\n\n$$\n\\int_0^1 x^2\\,dx\n$$',
      },
    })

    const html = wrapper.get('.vuepyter-markdown').html()
    expect(html).toContain('class="katex"')
    expect(html).toContain('class="katex-display"')
  })

  it('keeps code spans literal while rendering latex outside code', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        source: '`$literal$` then $x$',
      },
    })

    const html = wrapper.get('.vuepyter-markdown').html()
    expect(html).toContain('<code>$literal$</code>')
    expect(html).toContain('class="katex"')
  })
})
