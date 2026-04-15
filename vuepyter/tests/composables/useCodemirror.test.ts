import { mount } from '@vue/test-utils'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { indentUnit as cmIndentUnit } from '@codemirror/language'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCodemirror } from '@/composables/useCodemirror'

if (globalThis.Range) {
  const rangePrototype = globalThis.Range.prototype as Range & {
    getClientRects?: () => DOMRectList
    getBoundingClientRect?: () => DOMRect
  }

  if (!rangePrototype.getClientRects) {
    Object.defineProperty(rangePrototype, 'getClientRects', {
      value: () => [] as unknown as DOMRectList,
    })
  }

  if (!rangePrototype.getBoundingClientRect) {
    Object.defineProperty(rangePrototype, 'getBoundingClientRect', {
      value: () => new DOMRect(0, 0, 0, 0),
    })
  }
}

interface CodemirrorCallbacks {
  onUpdate: ReturnType<typeof vi.fn>
  onExecute: ReturnType<typeof vi.fn>
  onSplitCell: ReturnType<typeof vi.fn>
  onExitEditMode?: ReturnType<typeof vi.fn>
  onFocus: ReturnType<typeof vi.fn>
  onBlur: ReturnType<typeof vi.fn>
  onCursor: ReturnType<typeof vi.fn>
  onNavigateUp: ReturnType<typeof vi.fn>
  onNavigateDown: ReturnType<typeof vi.fn>
}

interface CodemirrorMount {
  wrapper: ReturnType<typeof mount>
  api: ReturnType<typeof useCodemirror>
  refs: {
    modelValue: Ref<string>
    language: Ref<'python' | 'markdown' | 'raw'>
    readOnly: Ref<boolean>
    lineNumbers: Ref<boolean>
    lineWrapping: Ref<boolean>
    indentUnit: Ref<number>
    tabSize: Ref<number>
    placeholder: Ref<string>
    autofocus: Ref<boolean>
    extensions: Ref<Extension[]>
    dark: Ref<boolean>
  }
  callbacks: CodemirrorCallbacks
}

const mountedWrappers: Array<{ unmount: () => void }> = []

afterEach(() => {
  while (mountedWrappers.length > 0) {
    mountedWrappers.pop()?.unmount()
  }
})

async function flush(): Promise<void> {
  await nextTick()
  await Promise.resolve()
}

function mountCodemirror(options: {
  modelValue?: string
  language?: 'python' | 'markdown' | 'raw'
  readOnly?: boolean
  lineNumbers?: boolean
  lineWrapping?: boolean
  indentUnit?: number
  tabSize?: number
  placeholder?: string
  autofocus?: boolean
  extensions?: Extension[]
  dark?: boolean
  withExitEditModeCallback?: boolean
} = {}): CodemirrorMount {
  const refs = {
    modelValue: ref(options.modelValue ?? ''),
    language: ref<'python' | 'markdown' | 'raw'>(options.language ?? 'python'),
    readOnly: ref(options.readOnly ?? false),
    lineNumbers: ref(options.lineNumbers ?? true),
    lineWrapping: ref(options.lineWrapping ?? true),
    indentUnit: ref(options.indentUnit ?? 4),
    tabSize: ref(options.tabSize ?? 4),
    placeholder: ref(options.placeholder ?? ''),
    autofocus: ref(options.autofocus ?? false),
    extensions: ref(options.extensions ?? ([] as Extension[])),
    dark: ref(options.dark ?? false),
  }

  const callbacks: CodemirrorCallbacks = {
    onUpdate: vi.fn(),
    onExecute: vi.fn(),
    onSplitCell: vi.fn(),
    onExitEditMode: options.withExitEditModeCallback === false ? undefined : vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onCursor: vi.fn(),
    onNavigateUp: vi.fn(),
    onNavigateDown: vi.fn(),
  }

  let api!: ReturnType<typeof useCodemirror>

  const Harness = defineComponent({
    name: 'CodemirrorHarness',
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      api = useCodemirror(containerRef, {
        modelValue: refs.modelValue,
        language: refs.language,
        readOnly: refs.readOnly,
        lineNumbers: refs.lineNumbers,
        lineWrapping: refs.lineWrapping,
        indentUnit: refs.indentUnit,
        tabSize: refs.tabSize,
        placeholder: refs.placeholder,
        autofocus: refs.autofocus,
        extensions: refs.extensions,
        dark: refs.dark,
        onUpdate: callbacks.onUpdate,
        onExecute: callbacks.onExecute,
        onSplitCell: callbacks.onSplitCell,
        onExitEditMode: callbacks.onExitEditMode,
        onFocus: callbacks.onFocus,
        onBlur: callbacks.onBlur,
        onCursor: callbacks.onCursor,
        onNavigateUp: callbacks.onNavigateUp,
        onNavigateDown: callbacks.onNavigateDown,
      })

      return { containerRef }
    },
    template: '<div ref="containerRef" class="codemirror-host" />',
  })

  const wrapper = mount(Harness)
  mountedWrappers.push(wrapper)
  return { wrapper, api, refs, callbacks }
}

describe('composables/useCodemirror', () => {
  it('creates the editor, autofocuses it, and tears it down on unmount', async () => {
    const focusSpy = vi.spyOn(EditorView.prototype, 'focus')
    const { wrapper, api, callbacks } = mountCodemirror({
      autofocus: true,
      placeholder: 'Write something',
    })

    await flush()

    expect(api.view.value).not.toBeNull()
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(api.view.value?.contentDOM.getAttribute('contenteditable')).toBe('true')
    expect(api.view.value?.dom.querySelector('.cm-gutters')).not.toBeNull()
    expect(api.view.value?.dom.querySelector('.cm-placeholder')).not.toBeNull()

    api.view.value?.contentDOM.dispatchEvent(new Event('focus'))
    api.view.value?.contentDOM.dispatchEvent(new Event('blur'))

    expect(callbacks.onFocus).toHaveBeenCalledTimes(1)
    expect(callbacks.onBlur).toHaveBeenCalledTimes(1)

    const destroySpy = vi.spyOn(api.view.value!, 'destroy')
    wrapper.unmount()

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(api.view.value).toBeNull()
  })

  it('syncs model values and reconfigures compartments when refs change', async () => {
    const { api, refs } = mountCodemirror({
      modelValue: '',
      placeholder: 'Write something',
    })

    await flush()

    const dispatchSpy = vi.spyOn(api.view.value!, 'dispatch')
    expect(api.view.value?.dom.querySelector('.cm-placeholder')).not.toBeNull()

    refs.placeholder.value = ''
    await flush()
    expect(api.view.value?.dom.querySelector('.cm-placeholder')).toBeNull()

    dispatchSpy.mockClear()
    refs.modelValue.value = 'gamma'
    await flush()
    expect(dispatchSpy).toHaveBeenCalled()
    expect(api.view.value?.state.doc.toString()).toBe('gamma')

    dispatchSpy.mockClear()
    api.view.value?.dispatch({
      changes: {
        from: 0,
        to: api.view.value.state.doc.length,
        insert: 'beta',
      },
    })
    dispatchSpy.mockClear()
    refs.modelValue.value = 'beta'
    await flush()
    expect(dispatchSpy).not.toHaveBeenCalled()

    refs.language.value = 'markdown'
    await flush()
    refs.language.value = 'raw'
    await flush()

    refs.readOnly.value = true
    await flush()
    expect(api.view.value?.contentDOM.getAttribute('contenteditable')).toBe('false')
    refs.readOnly.value = false
    await flush()
    expect(api.view.value?.contentDOM.getAttribute('contenteditable')).toBe('true')

    refs.lineNumbers.value = false
    await flush()
    expect(api.view.value?.dom.querySelector('.cm-gutters')).toBeNull()
    refs.lineNumbers.value = true
    await flush()
    expect(api.view.value?.dom.querySelector('.cm-gutters')).not.toBeNull()

    refs.lineWrapping.value = false
    await flush()
    refs.lineWrapping.value = true
    await flush()

    refs.indentUnit.value = 0
    await flush()
    expect(api.view.value?.state.facet(cmIndentUnit)).toBe(' ')

    refs.tabSize.value = 0
    await flush()
    expect(api.view.value?.state.facet(EditorState.tabSize)).toBe(1)

    refs.extensions.value = [EditorView.editorAttributes.of({ 'data-codemirror-extension': 'enabled' })]
    await flush()
    expect(api.view.value?.dom.getAttribute('data-codemirror-extension')).toBe('enabled')

    refs.dark.value = true
    await flush()

    expect(dispatchSpy).toHaveBeenCalled()
  })

  it('emits document and cursor updates and handles keyboard shortcuts', async () => {
    const { api, callbacks } = mountCodemirror({
      modelValue: 'alpha\nbeta',
      placeholder: '',
    })

    await flush()

    api.view.value?.dispatch({
      changes: {
        from: 0,
        to: 0,
        insert: '!',
      },
    })
    expect(callbacks.onUpdate).toHaveBeenCalledWith('!alpha\nbeta')

    api.view.value?.dispatch({
      selection: { anchor: 7 },
    })
    expect(callbacks.onCursor).toHaveBeenCalledWith({ line: 2, col: 0 })

    api.view.value?.dispatch({ selection: { anchor: 0 } })
    const upAtStart = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
    api.view.value?.contentDOM.dispatchEvent(upAtStart)
    expect(callbacks.onNavigateUp).toHaveBeenCalledTimes(1)

    api.view.value?.dispatch({ selection: { anchor: api.view.value.state.doc.length } })
    const downAtEnd = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
    api.view.value?.contentDOM.dispatchEvent(downAtEnd)
    expect(callbacks.onNavigateDown).toHaveBeenCalledTimes(1)

    api.view.value?.dispatch({ selection: { anchor: 3 } })
    const upMiddle = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
    const downMiddle = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
    api.view.value?.contentDOM.dispatchEvent(upMiddle)
    api.view.value?.contentDOM.dispatchEvent(downMiddle)
    expect(callbacks.onNavigateUp).toHaveBeenCalledTimes(1)
    expect(callbacks.onNavigateDown).toHaveBeenCalledTimes(1)

    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    const modEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    const splitCell = new KeyboardEvent('keydown', {
      key: '-',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })

    api.view.value?.contentDOM.dispatchEvent(shiftEnter)
    api.view.value?.contentDOM.dispatchEvent(modEnter)
    api.view.value?.dispatch({ selection: { anchor: 3 } })
    api.view.value?.contentDOM.dispatchEvent(splitCell)
    api.view.value?.contentDOM.dispatchEvent(escape)

    expect(callbacks.onExecute).toHaveBeenNthCalledWith(1, true)
    expect(callbacks.onExecute).toHaveBeenNthCalledWith(2, false)
    expect(callbacks.onSplitCell).toHaveBeenCalledWith(expect.any(Number))
    expect(callbacks.onExitEditMode).toHaveBeenCalledTimes(1)
  })

  it('falls back to blurring the editor on Escape when no exit callback is provided', async () => {
    const { api, callbacks } = mountCodemirror({
      withExitEditModeCallback: false,
    })

    await flush()

    const blurSpy = vi.spyOn(api.view.value!.contentDOM, 'blur')
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })

    api.view.value?.contentDOM.dispatchEvent(escape)

    expect(blurSpy).toHaveBeenCalledTimes(1)
    expect(callbacks.onExitEditMode).toBeUndefined()
  })
})
