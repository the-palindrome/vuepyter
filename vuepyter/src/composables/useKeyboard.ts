import { computed, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'
import { DEFAULT_KEYMAP } from '@/constants'
import type {
  KeymapConfig,
  NotebookMode,
  UseKeyboardOptions,
  UseKeyboardReturn,
} from '@/types'

interface SequenceState {
  index: number
  stamp: number
}

/**
 * Normalizes shortcut descriptors to a canonical format so user overrides and
 * default keymap entries are matched consistently.
 */
function normalizeShortcut(value: string): string {
  return value
    .trim()
    .split('+')
    .map((segment) => {
      const normalized = segment.trim().toLowerCase()
      if (!normalized) {
        return normalized
      }
      if (
        normalized === 'cmd'
        || normalized === 'meta'
        || normalized === 'control'
        || normalized === 'mod'
        || normalized === 'commandorcontrol'
      ) {
        return 'ctrl'
      }
      if (normalized === 'option') {
        return 'alt'
      }
      if (normalized === 'esc') {
        return 'escape'
      }
      if (normalized === ' ') {
        return 'space'
      }
      return normalized
    })
    .filter(Boolean)
    .join('+')
}

function splitSequence(shortcut: string): string[] {
  return shortcut
    .trim()
    .split(/\s+/u)
    .map((part) => normalizeShortcut(part))
    .filter(Boolean)
}

function eventToShortcut(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) {
    parts.push('ctrl')
  }
  if (event.altKey) {
    parts.push('alt')
  }
  if (event.shiftKey) {
    parts.push('shift')
  }

  const rawKey = event.key.toLowerCase()
  const key = rawKey === ' ' ? 'space' : rawKey
  parts.push(key)
  return parts.join('+')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }

  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

function keyMatches(event: KeyboardEvent, shortcut: string): boolean {
  return eventToShortcut(event) === normalizeShortcut(shortcut)
}

function keyMatchesAny(event: KeyboardEvent, shortcuts: Array<string | undefined>): boolean {
  return shortcuts.some((shortcut) => typeof shortcut === 'string' && shortcut.trim() && keyMatches(event, shortcut))
}

/**
 * Global keyboard controller for notebook command mode/edit mode behavior.
 */
export function useKeyboard(options: UseKeyboardOptions = {}): UseKeyboardReturn {
  const mode = options.mode ?? ref<NotebookMode>('command')
  const resolvedKeymap = computed<KeymapConfig>(() => ({
    ...DEFAULT_KEYMAP,
    ...(toValue(options.keymap) ?? {}),
  }))

  const isCommandMode = computed(() => mode.value === 'command')
  const isEditMode = computed(() => mode.value === 'edit')

  const sequenceTimeout = options.deleteSequenceTimeout ?? 450
  const deleteState: SequenceState = { index: 0, stamp: 0 }
  const interruptState: SequenceState = { index: 0, stamp: 0 }
  const restartState: SequenceState = { index: 0, stamp: 0 }

  function currentCellIndex(): number {
    return options.activeCellIndex?.value ?? 0
  }

  function currentCellCount(): number {
    const value = toValue(options.cellCount ?? 0)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
  }

  function isReadOnly(): boolean {
    return Boolean(toValue(options.readOnly ?? false))
  }

  function resetSequence(state: SequenceState): void {
    state.index = 0
    state.stamp = 0
  }

  function resetSequences(): void {
    resetSequence(deleteState)
    resetSequence(interruptState)
    resetSequence(restartState)
  }

  function setMode(nextMode: NotebookMode): void {
    mode.value = nextMode
    resetSequences()
  }

  function handleSequence(
    event: KeyboardEvent,
    sequenceShortcut: string,
    state: SequenceState,
    onComplete: () => void,
  ): boolean {
    const sequence = splitSequence(sequenceShortcut)
    if (sequence.length === 0) {
      return false
    }

    const expected = sequence[state.index]
    if (!expected || !keyMatches(event, expected)) {
      if (state.index > 0) {
        resetSequence(state)
      }
      return false
    }

    const now = Date.now()
    if (state.index > 0 && now - state.stamp > sequenceTimeout) {
      resetSequence(state)
      const first = sequence[0]
      if (!first || !keyMatches(event, first)) {
        return false
      }
    }

    state.stamp = now
    state.index += 1
    event.preventDefault()

    if (state.index >= sequence.length) {
      resetSequence(state)
      onComplete()
    }

    return true
  }

  /**
   * Commands that should work regardless of notebook mode (for example save).
   */
  function handleGlobalShortcuts(event: KeyboardEvent): boolean {
    if (keyMatches(event, resolvedKeymap.value.save)) {
      event.preventDefault()
      options.onSave?.()
      return true
    }
    return false
  }

  function handleRunCellAndAdvanceShortcut(
    event: KeyboardEvent,
    keymap: KeymapConfig,
  ): boolean {
    if (!keyMatchesAny(event, [keymap.runCellAndAdvance])) {
      return false
    }

    event.preventDefault()
    options.onRunCell?.(true)
    options.onRunCellAndAdvance?.()
    return true
  }

  function handleRunCellStayShortcut(
    event: KeyboardEvent,
    keymap: KeymapConfig,
  ): boolean {
    if (!keyMatchesAny(event, [keymap.runCellStay ?? keymap.runCellAndStay])) {
      return false
    }

    event.preventDefault()
    options.onRunCell?.(false)
    options.onRunCellStay?.()
    return true
  }

  function handleRunCellAndInsertBelowShortcut(
    event: KeyboardEvent,
    keymap: KeymapConfig,
  ): boolean {
    if (!keyMatchesAny(event, [keymap.runCellAndInsertBelow])) {
      return false
    }

    event.preventDefault()
    if (options.onRunCellAndInsertBelow) {
      options.onRunCellAndInsertBelow()
    } else {
      options.onRunCell?.(true)
    }
    return true
  }

  function handleEditMode(event: KeyboardEvent): boolean {
    const keymap = resolvedKeymap.value

    if (handleRunCellAndAdvanceShortcut(event, keymap)) {
      return true
    }

    if (handleRunCellStayShortcut(event, keymap)) {
      return true
    }

    if (handleRunCellAndInsertBelowShortcut(event, keymap)) {
      return true
    }

    if (keyMatchesAny(event, [keymap.historyPrevious])) {
      event.preventDefault()
      options.onHistoryPrevious?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.historyNext])) {
      event.preventDefault()
      options.onHistoryNext?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.showTooltip])) {
      event.preventDefault()
      options.onShowTooltip?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.invokeCompleter])) {
      options.onInvokeCompleter?.()
      return false
    }

    if (keyMatchesAny(event, [keymap.dismissTooltip])) {
      options.onDismissTooltip?.()
    }

    const exitShortcut = keymap.toggleMarkdownCommand ?? keymap.exitEditMode
    if (keyMatchesAny(event, [exitShortcut, keymap.enterCommandModeSecondary])) {
      event.preventDefault()
      setMode('command')
      options.onExitEditMode?.()
      options.onToggleMarkdownCommand?.()
      return true
    }

    return false
  }

  /**
   * Command mode is notebook-level navigation/edit orchestration.
   */
  function handleCommandMode(event: KeyboardEvent): boolean {
    const keymap = resolvedKeymap.value

    if (handleSequence(event, keymap.interruptKernel, interruptState, () => options.onInterruptKernel?.())) {
      return true
    }

    if (handleSequence(event, keymap.restartKernel, restartState, () => options.onRestartKernel?.())) {
      return true
    }

    if (
      handleSequence(event, keymap.deleteCell, deleteState, () => {
        if (!isReadOnly()) {
          options.onDeleteCell?.(currentCellIndex())
        }
      })
    ) {
      return true
    }

    if (handleRunCellAndAdvanceShortcut(event, keymap)) {
      return true
    }

    if (handleRunCellStayShortcut(event, keymap)) {
      return true
    }

    if (handleRunCellAndInsertBelowShortcut(event, keymap)) {
      return true
    }

    if (keyMatchesAny(event, [keymap.saveCommand])) {
      event.preventDefault()
      options.onSaveCommand?.()
      options.onSave?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.enterEditMode, keymap.toggleMarkdownEdit])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      setMode('edit')
      options.onEnterEditMode?.()
      options.onToggleMarkdownEdit?.()
      return true
    }

    const moveUpShortcut = keymap.moveCellUp
    if (keyMatchesAny(event, [moveUpShortcut, keymap.moveCellAbove, keymap.moveCellUpSecondary])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        const nextIndex = Math.max(0, currentCellIndex() - 1)
        options.onMoveCellSelection?.(nextIndex)
      }
      options.onMoveCellAbove?.()
      return true
    }

    const moveDownShortcut = keymap.moveCellDown
    if (keyMatchesAny(event, [moveDownShortcut, keymap.moveCellBelow, keymap.moveCellDownSecondary])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        const nextIndex = Math.min(currentCellCount() - 1, currentCellIndex() + 1)
        options.onMoveCellSelection?.(nextIndex)
      }
      options.onMoveCellBelow?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.extendSelectionUp])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        const nextIndex = Math.max(0, currentCellIndex() - 1)
        options.onMoveCellSelection?.(nextIndex)
      }
      options.onExtendSelectionUp?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.extendSelectionDown])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        const nextIndex = Math.min(currentCellCount() - 1, currentCellIndex() + 1)
        options.onMoveCellSelection?.(nextIndex)
      }
      options.onExtendSelectionDown?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.extendSelectionTop])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        options.onMoveCellSelection?.(0)
      }
      options.onMoveToTop?.()
      options.onExtendSelectionTop?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.extendSelectionBottom])) {
      event.preventDefault()
      if (currentCellCount() > 0) {
        options.onMoveCellSelection?.(currentCellCount() - 1)
      }
      options.onMoveToBottom?.()
      options.onExtendSelectionBottom?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.moveCellUpPosition])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      const from = currentCellIndex()
      const to = Math.max(0, from - 1)
      options.onMoveCellUpPosition?.({ from, to })
      return true
    }

    if (keyMatchesAny(event, [keymap.moveCellDownPosition])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      const from = currentCellIndex()
      const to = Math.min(Math.max(0, currentCellCount() - 1), from + 1)
      options.onMoveCellDownPosition?.({ from, to })
      return true
    }

    if (keyMatchesAny(event, [keymap.addCellBelow])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onAddCell?.(currentCellIndex() + 1)
      options.onAddCellBelow?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.addCellAbove])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onAddCell?.(currentCellIndex())
      options.onAddCellAbove?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.insertHeadingAbove])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onInsertHeadingAbove?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.insertHeadingBelow])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onInsertHeadingBelow?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.copyCell])) {
      event.preventDefault()
      options.onCopyCell?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.cutCell])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onCutCell?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.pasteCellBelow])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onPasteCellBelow?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.pasteCellAbove])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onPasteCellAbove?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.undoCellAction])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onUndoCellAction?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.redoCellAction])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onRedoCellAction?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.mergeCells])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onMergeCells?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.mergeCellAbove])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onMergeCellAbove?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.mergeCellBelow])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onMergeCellBelow?.(currentCellIndex())
      return true
    }

    if (keyMatchesAny(event, [keymap.changeCellToCode])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onChangeCellType?.({ index: currentCellIndex(), type: 'code' })
      return true
    }

    if (keyMatchesAny(event, [keymap.changeCellToMarkdown])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onChangeCellType?.({ index: currentCellIndex(), type: 'markdown' })
      return true
    }

    if (keyMatchesAny(event, [keymap.changeCellToRaw])) {
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onChangeCellType?.({ index: currentCellIndex(), type: 'raw' })
      return true
    }

    const headingShortcuts: Array<{ shortcut: string; level: 1 | 2 | 3 | 4 | 5 | 6 }> = [
      { shortcut: keymap.changeCellToHeading1, level: 1 },
      { shortcut: keymap.changeCellToHeading2, level: 2 },
      { shortcut: keymap.changeCellToHeading3, level: 3 },
      { shortcut: keymap.changeCellToHeading4, level: 4 },
      { shortcut: keymap.changeCellToHeading5, level: 5 },
      { shortcut: keymap.changeCellToHeading6, level: 6 },
    ]

    for (const heading of headingShortcuts) {
      if (!keyMatches(event, heading.shortcut)) {
        continue
      }
      if (isReadOnly()) {
        return false
      }
      event.preventDefault()
      options.onSetHeadingLevel?.({ index: currentCellIndex(), level: heading.level })
      return true
    }

    if (keyMatchesAny(event, [keymap.collapseHeading])) {
      event.preventDefault()
      options.onCollapseHeading?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.expandHeading])) {
      event.preventDefault()
      options.onExpandHeading?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.collapseAllHeadings])) {
      event.preventDefault()
      options.onCollapseAllHeadings?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.expandAllHeadings])) {
      event.preventDefault()
      options.onExpandAllHeadings?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.selectAllCells])) {
      event.preventDefault()
      options.onSelectAllCells?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.toggleLineNumbers])) {
      event.preventDefault()
      options.onToggleLineNumbers?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.toggleAllLineNumbers])) {
      event.preventDefault()
      options.onToggleAllLineNumbers?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.toggleOutput])) {
      event.preventDefault()
      options.onToggleOutput?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.toggleOutputScrolling])) {
      event.preventDefault()
      options.onToggleOutputScrolling?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.toggleRenderSideBySide])) {
      event.preventDefault()
      options.onToggleRenderSideBySide?.()
      return true
    }

    if (keyMatchesAny(event, [keymap.showShortcuts])) {
      event.preventDefault()
      options.onShowShortcuts?.()
      return true
    }

    return false
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return
    }
    if (!toValue(options.enabled ?? true)) {
      return
    }

    if (handleGlobalShortcuts(event)) {
      return
    }

    if (isCommandMode.value && isEditableTarget(event.target)) {
      return
    }

    if (mode.value === 'edit') {
      handleEditMode(event)
      return
    }

    handleCommandMode(event)
  }

  function getEventTarget(): EventTarget | null {
    const target = toValue(options.target)
    return (target ?? null) as EventTarget | null
  }

  const keydownListener = handleKeydown as EventListener
  let activeTarget: EventTarget | null = null
  let stopTargetWatch: (() => void) | null = null

  function syncEventTarget(target = getEventTarget()): void {
    if (target === activeTarget) {
      return
    }

    activeTarget?.removeEventListener('keydown', keydownListener)
    target?.addEventListener('keydown', keydownListener)
    activeTarget = target
  }

  onMounted(() => {
    stopTargetWatch = watch(
      () => toValue(options.target),
      () => {
        syncEventTarget()
      },
      { immediate: true },
    )
  })

  onBeforeUnmount(() => {
    stopTargetWatch?.()
    stopTargetWatch = null
    syncEventTarget(null)
  })

  return {
    mode,
    isCommandMode,
    isEditMode,
    setMode,
    handleKeydown,
    onKeydown: handleKeydown,
  }
}
