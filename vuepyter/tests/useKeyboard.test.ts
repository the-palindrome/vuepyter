import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboard } from '@/composables/useKeyboard'
import type { UseKeyboardOptions, UseKeyboardReturn } from '@/types'

function mountKeyboard(options: UseKeyboardOptions = {}) {
  const api = {} as UseKeyboardReturn

  const Harness = defineComponent({
    setup() {
      Object.assign(api, useKeyboard(options))
      return () => h('div')
    },
  })

  const wrapper = mount(Harness)
  return { wrapper, api }
}

function keyEvent(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  })
}

describe('useKeyboard', () => {
  it('handles run shortcuts in command mode', () => {
    const onRunCell = vi.fn()
    const { api } = mountKeyboard({
      onRunCell,
      activeCellIndex: ref(0),
      cellCount: ref(3),
    })

    api.handleKeydown(keyEvent('Enter', { shiftKey: true }))
    api.handleKeydown(keyEvent('Enter', { ctrlKey: true }))

    expect(onRunCell).toHaveBeenNthCalledWith(1, true)
    expect(onRunCell).toHaveBeenNthCalledWith(2, false)
  })

  it('handles add/delete command shortcuts with sequence logic', () => {
    const onAddCell = vi.fn()
    const onDeleteCell = vi.fn()
    const { api } = mountKeyboard({
      onAddCell,
      onDeleteCell,
      activeCellIndex: ref(2),
      cellCount: ref(5),
      deleteSequenceTimeout: 1000,
    })

    api.handleKeydown(keyEvent('b'))
    api.handleKeydown(keyEvent('d'))
    api.handleKeydown(keyEvent('d'))

    expect(onAddCell).toHaveBeenCalledWith(3)
    expect(onDeleteCell).toHaveBeenCalledWith(2)
  })

  it('fires save in both command and edit mode', () => {
    const onSave = vi.fn()
    const { api } = mountKeyboard({
      onSave,
      activeCellIndex: ref(0),
      cellCount: ref(1),
    })

    api.handleKeydown(keyEvent('s', { ctrlKey: true }))
    api.setMode('edit')
    api.handleKeydown(keyEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('does not mutate cells in read-only mode', () => {
    const onAddCell = vi.fn()
    const onDeleteCell = vi.fn()
    const { api } = mountKeyboard({
      onAddCell,
      onDeleteCell,
      readOnly: ref(true),
      activeCellIndex: ref(0),
      cellCount: ref(1),
    })

    api.handleKeydown(keyEvent('b'))
    api.handleKeydown(keyEvent('d'))
    api.handleKeydown(keyEvent('d'))

    expect(onAddCell).not.toHaveBeenCalled()
    expect(onDeleteCell).not.toHaveBeenCalled()
  })
})
