import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
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

function keydownEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    cancelable: true,
    bubbles: true,
    ...init,
  })
}

describe('composables/useKeyboard', () => {
  it('handles global save shortcut regardless of mode', () => {
    const onSave = vi.fn()
    const { api } = mountKeyboard({ onSave })

    const event = keydownEvent('s', { ctrlKey: true })
    api.handleKeydown(event)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores command-mode shortcuts when an editable element is targeted', () => {
    const onAddCell = vi.fn()
    const { api } = mountKeyboard({ onAddCell })

    const input = document.createElement('input')
    const event = keydownEvent('b')
    Object.defineProperty(event, 'target', { value: input })

    api.handleKeydown(event)
    expect(onAddCell).not.toHaveBeenCalled()
  })

  it('triggers run/move/add shortcuts in command mode', () => {
    const onRunCell = vi.fn()
    const onRunCellAndAdvance = vi.fn()
    const onRunCellStay = vi.fn()
    const onMoveCellSelection = vi.fn()
    const onMoveCellAbove = vi.fn()
    const onMoveCellBelow = vi.fn()
    const onAddCell = vi.fn()

    const activeCellIndex = ref(1)
    const cellCount = ref(3)
    const { api } = mountKeyboard({
      activeCellIndex,
      cellCount,
      onRunCell,
      onRunCellAndAdvance,
      onRunCellStay,
      onMoveCellSelection,
      onMoveCellAbove,
      onMoveCellBelow,
      onAddCell,
    })

    api.handleKeydown(keydownEvent('Enter', { shiftKey: true }))
    api.handleKeydown(keydownEvent('Enter', { ctrlKey: true }))
    api.handleKeydown(keydownEvent('ArrowUp'))
    api.handleKeydown(keydownEvent('ArrowDown'))
    api.handleKeydown(keydownEvent('b'))

    expect(onRunCell).toHaveBeenNthCalledWith(1, true)
    expect(onRunCell).toHaveBeenNthCalledWith(2, false)
    expect(onRunCellAndAdvance).toHaveBeenCalledTimes(1)
    expect(onRunCellStay).toHaveBeenCalledTimes(1)
    expect(onMoveCellSelection).toHaveBeenNthCalledWith(1, 0)
    expect(onMoveCellSelection).toHaveBeenNthCalledWith(2, 2)
    expect(onMoveCellAbove).toHaveBeenCalledTimes(1)
    expect(onMoveCellBelow).toHaveBeenCalledTimes(1)
    expect(onAddCell).toHaveBeenCalledWith(2)
  })

  it('respects readOnly for add/delete/edit actions', () => {
    const onAddCell = vi.fn()
    const onDeleteCell = vi.fn()
    const onToggleMarkdownEdit = vi.fn()
    const { api } = mountKeyboard({
      readOnly: true,
      onAddCell,
      onDeleteCell,
      onToggleMarkdownEdit,
    })

    api.handleKeydown(keydownEvent('b'))
    api.handleKeydown(keydownEvent('d'))
    api.handleKeydown(keydownEvent('d'))
    api.handleKeydown(keydownEvent('Enter'))

    expect(onAddCell).not.toHaveBeenCalled()
    expect(onDeleteCell).not.toHaveBeenCalled()
    expect(onToggleMarkdownEdit).not.toHaveBeenCalled()
  })

  it('requires complete delete sequence within timeout', () => {
    const onDeleteCell = vi.fn()
    const activeCellIndex = ref(2)
    const { api } = mountKeyboard({
      activeCellIndex,
      onDeleteCell,
      deleteSequenceTimeout: 100,
    })

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(50)

    const first = keydownEvent('d')
    const second = keydownEvent('d')
    api.handleKeydown(first)
    api.handleKeydown(second)

    expect(first.defaultPrevented).toBe(true)
    expect(second.defaultPrevented).toBe(true)
    expect(onDeleteCell).toHaveBeenCalledWith(2)
  })

  it('resets delete sequence after timeout', () => {
    const onDeleteCell = vi.fn()
    const { api } = mountKeyboard({
      onDeleteCell,
      deleteSequenceTimeout: 100,
    })

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(500).mockReturnValueOnce(510)

    api.handleKeydown(keydownEvent('d'))
    api.handleKeydown(keydownEvent('d'))
    expect(onDeleteCell).not.toHaveBeenCalled()

    api.handleKeydown(keydownEvent('d'))
    expect(onDeleteCell).toHaveBeenCalledTimes(1)
  })

  it('toggles between command and edit mode shortcuts', () => {
    const onToggleMarkdownEdit = vi.fn()
    const onExitEditMode = vi.fn()
    const onToggleMarkdownCommand = vi.fn()
    const { api } = mountKeyboard({
      onToggleMarkdownEdit,
      onExitEditMode,
      onToggleMarkdownCommand,
    })

    expect(api.mode.value).toBe('command')
    api.handleKeydown(keydownEvent('Enter'))
    expect(api.mode.value).toBe('edit')
    expect(onToggleMarkdownEdit).toHaveBeenCalledTimes(1)

    api.handleKeydown(keydownEvent('Escape'))
    expect(api.mode.value).toBe('command')
    expect(onExitEditMode).toHaveBeenCalledTimes(1)
    expect(onToggleMarkdownCommand).toHaveBeenCalledTimes(1)
  })

  it('attaches and detaches keydown listeners for configured targets', () => {
    const onSave = vi.fn()
    const target = document.createElement('div')
    const { wrapper } = mountKeyboard({
      target,
      onSave,
    })

    const event = keydownEvent('s', { ctrlKey: true })
    target.dispatchEvent(event)
    expect(onSave).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    target.dispatchEvent(keydownEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('moves keydown listener when target ref changes', async () => {
    const onSave = vi.fn()
    const firstTarget = document.createElement('div')
    const secondTarget = document.createElement('div')
    const target = ref<EventTarget | null>(firstTarget)
    const { wrapper } = mountKeyboard({
      target,
      onSave,
    })

    firstTarget.dispatchEvent(keydownEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(1)

    target.value = secondTarget
    await nextTick()

    firstTarget.dispatchEvent(keydownEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(1)

    secondTarget.dispatchEvent(keydownEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    secondTarget.dispatchEvent(keydownEvent('s', { ctrlKey: true }))
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('supports command-mode run/sequence/save shortcuts from Jupyter defaults', () => {
    const onRunCell = vi.fn()
    const onRunCellAndInsertBelow = vi.fn()
    const onSave = vi.fn()
    const onSaveCommand = vi.fn()
    const onInterruptKernel = vi.fn()
    const onRestartKernel = vi.fn()
    const { api } = mountKeyboard({
      onRunCell,
      onRunCellAndInsertBelow,
      onSave,
      onSaveCommand,
      onInterruptKernel,
      onRestartKernel,
    })

    api.handleKeydown(keydownEvent('Enter', { altKey: true }))
    api.handleKeydown(keydownEvent('s'))
    api.handleKeydown(keydownEvent('s', { ctrlKey: true }))

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(40).mockReturnValueOnce(60).mockReturnValueOnce(90)
    api.handleKeydown(keydownEvent('i'))
    api.handleKeydown(keydownEvent('i'))
    api.handleKeydown(keydownEvent('0'))
    api.handleKeydown(keydownEvent('0'))

    expect(onRunCell).not.toHaveBeenCalled()
    expect(onRunCellAndInsertBelow).toHaveBeenCalledTimes(1)
    expect(onSaveCommand).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onInterruptKernel).toHaveBeenCalledTimes(1)
    expect(onRestartKernel).toHaveBeenCalledTimes(1)
  })

  it('supports clipboard, merge, move, and cell-type shortcuts', () => {
    const onCopyCell = vi.fn()
    const onCutCell = vi.fn()
    const onPasteCellBelow = vi.fn()
    const onPasteCellAbove = vi.fn()
    const onUndoCellAction = vi.fn()
    const onRedoCellAction = vi.fn()
    const onMergeCells = vi.fn()
    const onMoveCellUpPosition = vi.fn()
    const onMoveCellDownPosition = vi.fn()
    const onChangeCellType = vi.fn()
    const { api } = mountKeyboard({
      activeCellIndex: ref(2),
      cellCount: ref(5),
      onCopyCell,
      onCutCell,
      onPasteCellBelow,
      onPasteCellAbove,
      onUndoCellAction,
      onRedoCellAction,
      onMergeCells,
      onMoveCellUpPosition,
      onMoveCellDownPosition,
      onChangeCellType,
    })

    api.handleKeydown(keydownEvent('c'))
    api.handleKeydown(keydownEvent('x'))
    api.handleKeydown(keydownEvent('v'))
    api.handleKeydown(keydownEvent('v', { shiftKey: true }))
    api.handleKeydown(keydownEvent('z'))
    api.handleKeydown(keydownEvent('z', { shiftKey: true }))
    api.handleKeydown(keydownEvent('m', { shiftKey: true }))
    api.handleKeydown(keydownEvent('ArrowUp', { ctrlKey: true, shiftKey: true }))
    api.handleKeydown(keydownEvent('ArrowDown', { ctrlKey: true, shiftKey: true }))
    api.handleKeydown(keydownEvent('y'))
    api.handleKeydown(keydownEvent('m'))
    api.handleKeydown(keydownEvent('r'))

    expect(onCopyCell).toHaveBeenCalledWith(2)
    expect(onCutCell).toHaveBeenCalledWith(2)
    expect(onPasteCellBelow).toHaveBeenCalledWith(2)
    expect(onPasteCellAbove).toHaveBeenCalledWith(2)
    expect(onUndoCellAction).toHaveBeenCalledTimes(1)
    expect(onRedoCellAction).toHaveBeenCalledTimes(1)
    expect(onMergeCells).toHaveBeenCalledWith(2)
    expect(onMoveCellUpPosition).toHaveBeenCalledWith({ from: 2, to: 1 })
    expect(onMoveCellDownPosition).toHaveBeenCalledWith({ from: 2, to: 3 })
    expect(onChangeCellType).toHaveBeenNthCalledWith(1, { index: 2, type: 'code' })
    expect(onChangeCellType).toHaveBeenNthCalledWith(2, { index: 2, type: 'markdown' })
    expect(onChangeCellType).toHaveBeenNthCalledWith(3, { index: 2, type: 'raw' })
  })

  it('supports heading-level and output/line-number command shortcuts', () => {
    const onSetHeadingLevel = vi.fn()
    const onToggleLineNumbers = vi.fn()
    const onToggleAllLineNumbers = vi.fn()
    const onToggleOutput = vi.fn()
    const onToggleOutputScrolling = vi.fn()
    const onShowShortcuts = vi.fn()
    const { api } = mountKeyboard({
      onSetHeadingLevel,
      onToggleLineNumbers,
      onToggleAllLineNumbers,
      onToggleOutput,
      onToggleOutputScrolling,
      onShowShortcuts,
    })

    api.handleKeydown(keydownEvent('1'))
    api.handleKeydown(keydownEvent('2'))
    api.handleKeydown(keydownEvent('3'))
    api.handleKeydown(keydownEvent('4'))
    api.handleKeydown(keydownEvent('5'))
    api.handleKeydown(keydownEvent('6'))
    api.handleKeydown(keydownEvent('l'))
    api.handleKeydown(keydownEvent('l', { shiftKey: true }))
    api.handleKeydown(keydownEvent('o'))
    api.handleKeydown(keydownEvent('o', { shiftKey: true }))
    api.handleKeydown(keydownEvent('h'))

    expect(onSetHeadingLevel).toHaveBeenCalledTimes(6)
    expect(onSetHeadingLevel).toHaveBeenNthCalledWith(1, { index: 0, level: 1 })
    expect(onSetHeadingLevel).toHaveBeenNthCalledWith(6, { index: 0, level: 6 })
    expect(onToggleLineNumbers).toHaveBeenCalledTimes(1)
    expect(onToggleAllLineNumbers).toHaveBeenCalledTimes(1)
    expect(onToggleOutput).toHaveBeenCalledTimes(1)
    expect(onToggleOutputScrolling).toHaveBeenCalledTimes(1)
    expect(onShowShortcuts).toHaveBeenCalledTimes(1)
  })

  it('supports edit-mode history/help/run shortcuts and exit with Ctrl+M', () => {
    const onRunCell = vi.fn()
    const onRunCellAndInsertBelow = vi.fn()
    const onHistoryPrevious = vi.fn()
    const onHistoryNext = vi.fn()
    const onInvokeCompleter = vi.fn()
    const onShowTooltip = vi.fn()
    const onExitEditMode = vi.fn()
    const onToggleMarkdownCommand = vi.fn()
    const { api } = mountKeyboard({
      onRunCell,
      onRunCellAndInsertBelow,
      onHistoryPrevious,
      onHistoryNext,
      onInvokeCompleter,
      onShowTooltip,
      onExitEditMode,
      onToggleMarkdownCommand,
    })

    api.setMode('edit')
    api.handleKeydown(keydownEvent('ArrowUp', { altKey: true }))
    api.handleKeydown(keydownEvent('ArrowDown', { altKey: true }))
    api.handleKeydown(keydownEvent('Tab'))
    api.handleKeydown(keydownEvent('Tab', { shiftKey: true }))
    api.handleKeydown(keydownEvent('Enter', { altKey: true }))
    api.handleKeydown(keydownEvent('m', { ctrlKey: true }))

    expect(onHistoryPrevious).toHaveBeenCalledTimes(1)
    expect(onHistoryNext).toHaveBeenCalledTimes(1)
    expect(onInvokeCompleter).toHaveBeenCalledTimes(1)
    expect(onShowTooltip).toHaveBeenCalledTimes(1)
    expect(onRunCell).not.toHaveBeenCalled()
    expect(onRunCellAndInsertBelow).toHaveBeenCalledTimes(1)
    expect(onExitEditMode).toHaveBeenCalledTimes(1)
    expect(onToggleMarkdownCommand).toHaveBeenCalledTimes(1)
    expect(api.mode.value).toBe('command')
  })

  it('keeps mutating shortcuts disabled in readOnly mode', () => {
    const onCopyCell = vi.fn()
    const onCutCell = vi.fn()
    const onPasteCellBelow = vi.fn()
    const onUndoCellAction = vi.fn()
    const onMergeCells = vi.fn()
    const onChangeCellType = vi.fn()
    const onMoveCellUpPosition = vi.fn()
    const onInterruptKernel = vi.fn()
    const onRestartKernel = vi.fn()
    const { api } = mountKeyboard({
      readOnly: true,
      onCopyCell,
      onCutCell,
      onPasteCellBelow,
      onUndoCellAction,
      onMergeCells,
      onChangeCellType,
      onMoveCellUpPosition,
      onInterruptKernel,
      onRestartKernel,
    })

    api.handleKeydown(keydownEvent('c'))
    api.handleKeydown(keydownEvent('x'))
    api.handleKeydown(keydownEvent('v'))
    api.handleKeydown(keydownEvent('z'))
    api.handleKeydown(keydownEvent('m', { shiftKey: true }))
    api.handleKeydown(keydownEvent('y'))
    api.handleKeydown(keydownEvent('ArrowUp', { ctrlKey: true, shiftKey: true }))

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(20).mockReturnValueOnce(30).mockReturnValueOnce(40)
    api.handleKeydown(keydownEvent('i'))
    api.handleKeydown(keydownEvent('i'))
    api.handleKeydown(keydownEvent('0'))
    api.handleKeydown(keydownEvent('0'))

    expect(onCopyCell).toHaveBeenCalledTimes(1)
    expect(onCutCell).not.toHaveBeenCalled()
    expect(onPasteCellBelow).not.toHaveBeenCalled()
    expect(onUndoCellAction).not.toHaveBeenCalled()
    expect(onMergeCells).not.toHaveBeenCalled()
    expect(onChangeCellType).not.toHaveBeenCalled()
    expect(onMoveCellUpPosition).not.toHaveBeenCalled()
    expect(onInterruptKernel).toHaveBeenCalledTimes(1)
    expect(onRestartKernel).toHaveBeenCalledTimes(1)
  })
})
