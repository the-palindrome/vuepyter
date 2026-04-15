import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CellOutput from '@/components/CellOutput.vue'
import type { CellOutput as CellOutputType } from '@/types'

describe('components/CellOutput', () => {
  it('renders empty state label when no outputs exist', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [],
        emptyLabel: 'Nothing yet',
      },
    })

    expect(wrapper.text()).toContain('Nothing yet')
  })

  it('renders stream output inside a preformatted block', () => {
    const outputs: CellOutputType[] = [
      { output_type: 'stream', name: 'stdout', text: 'hello\nworld\n' },
    ]

    const wrapper = mount(CellOutput, { props: { outputs } })
    const pre = wrapper.find('.vuepyter-output-pre')
    expect(pre.exists()).toBe(true)
    expect(pre.element.textContent).toBe('hello\nworld\n')
  })

  it('renders text/html output and sanitizes dangerous markup', () => {
    const outputs: CellOutputType[] = [
      {
        output_type: 'display_data',
        data: {
          'text/html': '<div class="ok"><script>alert(1)</script><a href="javascript:alert(1)">x</a></div>',
        },
        metadata: {},
      },
    ]

    const wrapper = mount(CellOutput, { props: { outputs } })
    const htmlBlock = wrapper.find('.vuepyter-output-html')

    expect(htmlBlock.exists()).toBe(true)
    expect(htmlBlock.html()).toContain('<div class="ok">')
    expect(htmlBlock.html()).not.toContain('<script>')
    expect(htmlBlock.html()).toContain('<a>x</a>')
    expect(htmlBlock.html()).not.toContain('javascript:alert')
  })

  it('renders image/png output with normalized data URI', () => {
    const outputs: CellOutputType[] = [
      {
        output_type: 'display_data',
        data: {
          'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAUA',
        },
        metadata: {},
      },
    ]

    const wrapper = mount(CellOutput, { props: { outputs } })
    const img = wrapper.find('img.vuepyter-output-image')

    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')
    expect(img.attributes('alt')).toBe('cell output')
  })

  it('renders ANSI traceback HTML for error outputs', () => {
    const outputs: CellOutputType[] = [
      {
        output_type: 'error',
        ename: 'ValueError',
        evalue: 'bad value',
        traceback: ['\u001b[31mTraceback line\u001b[0m'],
      },
    ]

    const wrapper = mount(CellOutput, { props: { outputs } })
    const error = wrapper.find('.vuepyter-output-error')

    expect(error.exists()).toBe(true)
    expect(error.html()).toContain('color: #b91c1c')
    expect(error.text()).toContain('Traceback line')
  })

  it('applies max output height style', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [],
        maxOutputHeight: 240,
      },
    })

    expect(wrapper.get('.vuepyter-output-wrap').attributes('style')).toContain('max-height: 240px;')
  })

  it('can hide empty output container when hideEmpty is enabled', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [],
        hideEmpty: true,
      },
    })

    expect(wrapper.find('.vuepyter-output-wrap').exists()).toBe(false)
  })
})
