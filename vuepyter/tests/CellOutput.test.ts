import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CellOutput from '@/components/CellOutput.vue'

describe('CellOutput', () => {
  it('renders stream output text', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [
          {
            output_type: 'stream',
            name: 'stdout',
            text: 'hello world',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('hello world')
  })

  it('renders and sanitizes html output', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [
          {
            output_type: 'display_data',
            data: {
              'text/html': '<div><script>alert(1)</script><strong>safe</strong></div>',
            },
            metadata: {},
          },
        ],
      },
    })

    const html = wrapper.html()
    expect(html).toContain('<strong>safe</strong>')
    expect(html).not.toContain('<script>')
  })

  it('renders png image output with data url prefix', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [
          {
            output_type: 'execute_result',
            execution_count: 1,
            data: {
              'image/png': 'abc123',
            },
            metadata: {},
          },
        ],
      },
    })

    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('data:image/png;base64,abc123')
    expect(wrapper.get('.vuepyter-output-wrap').attributes('style')).toContain('max-height: none;')
    expect(wrapper.get('.vuepyter-output-wrap').attributes('style')).toContain('overflow: visible;')
  })

  it('renders error traceback', () => {
    const wrapper = mount(CellOutput, {
      props: {
        outputs: [
          {
            output_type: 'error',
            ename: 'ValueError',
            evalue: 'bad value',
            traceback: ['Traceback...', 'ValueError: bad value'],
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('ValueError: bad value')
    expect(wrapper.find('.vuepyter-output-error').exists()).toBe(true)
  })
})
