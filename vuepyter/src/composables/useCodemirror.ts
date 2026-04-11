import { Compartment, EditorState, type Extension, Prec } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentUnit as cmIndentUnit, bracketMatching, syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { EditorView, keymap as cmKeymap, lineNumbers as cmLineNumbers, placeholder as cmPlaceholder } from '@codemirror/view'
import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { vuepyterDarkTheme } from '../themes/codemirrorDark'
import { vuepyterLightTheme } from '../themes/codemirrorLight'
import { vuepyterHighlightStyle } from '../themes/highlightStyle'

interface CodemirrorOptions {
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
  onUpdate: (value: string) => void
  onExecute?: (advance: boolean) => void
  onSplitCell?: (cursorOffset: number) => void
  onFocus?: () => void
  onBlur?: () => void
  onCursor?: (cursor: { line: number; col: number }) => void
  onNavigateUp?: () => void
  onNavigateDown?: () => void
}

function languageExtension(language: 'python' | 'markdown' | 'raw'): Extension {
  if (language === 'python') {
    return python()
  }
  if (language === 'markdown') {
    return markdown()
  }
  return []
}

function atStart(view: EditorView): boolean {
  const main = view.state.selection.main
  return main.from === 0 && main.to === 0
}

function atEnd(view: EditorView): boolean {
  const main = view.state.selection.main
  return main.from === view.state.doc.length && main.to === view.state.doc.length
}

export function useCodemirror(containerRef: Ref<HTMLElement | null>, options: CodemirrorOptions) {
  const view = shallowRef<EditorView | null>(null)

  const languageCompartment = new Compartment()
  const readOnlyCompartment = new Compartment()
  const lineNumbersCompartment = new Compartment()
  const lineWrappingCompartment = new Compartment()
  const indentCompartment = new Compartment()
  const tabSizeCompartment = new Compartment()
  const placeholderCompartment = new Compartment()
  const customExtensionsCompartment = new Compartment()
  const themeCompartment = new Compartment()

  const sharedKeymap = Prec.highest(
    cmKeymap.of([
      {
        key: 'Shift-Enter',
        run: () => {
          options.onExecute?.(true)
          return true
        },
      },
      {
        key: 'Mod-Enter',
        run: () => {
          options.onExecute?.(false)
          return true
        },
      },
      {
        key: 'Mod-Shift--',
        run: (editorView) => {
          options.onSplitCell?.(editorView.state.selection.main.head)
          return true
        },
      },
      {
        key: 'Escape',
        run: (editorView) => {
          ;(editorView.contentDOM as HTMLElement).blur()
          return true
        },
      },
      {
        key: 'ArrowUp',
        run: (editorView) => {
          if (atStart(editorView)) {
            options.onNavigateUp?.()
            return true
          }
          return false
        },
      },
      {
        key: 'ArrowDown',
        run: (editorView) => {
          if (atEnd(editorView)) {
            options.onNavigateDown?.()
            return true
          }
          return false
        },
      },
    ]),
  )

  const baseExtensions: Extension[] = [
    history(),
    cmKeymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...closeBracketsKeymap]),
    closeBrackets(),
    bracketMatching(),
    syntaxHighlighting(vuepyterHighlightStyle),
    sharedKeymap,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onUpdate(update.state.doc.toString())
      }
      if (update.selectionSet) {
        const main = update.state.selection.main
        const line = update.state.doc.lineAt(main.head)
        options.onCursor?.({
          line: line.number,
          col: main.head - line.from,
        })
      }
    }),
    EditorView.domEventHandlers({
      focus: () => {
        options.onFocus?.()
      },
      blur: () => {
        options.onBlur?.()
      },
    }),
    languageCompartment.of(languageExtension(options.language.value)),
    readOnlyCompartment.of([EditorState.readOnly.of(options.readOnly.value), EditorView.editable.of(!options.readOnly.value)]),
    lineNumbersCompartment.of(options.lineNumbers.value ? cmLineNumbers() : []),
    lineWrappingCompartment.of(options.lineWrapping.value ? EditorView.lineWrapping : []),
    indentCompartment.of(cmIndentUnit.of(' '.repeat(Math.max(1, options.indentUnit.value)))),
    tabSizeCompartment.of(EditorState.tabSize.of(Math.max(1, options.tabSize.value))),
    placeholderCompartment.of(options.placeholder.value ? cmPlaceholder(options.placeholder.value) : []),
    customExtensionsCompartment.of(options.extensions.value),
    themeCompartment.of(options.dark.value ? vuepyterDarkTheme : vuepyterLightTheme),
  ]

  const createView = (element: HTMLElement) => {
    if (view.value) {
      return
    }
    const state = EditorState.create({
      doc: options.modelValue.value,
      extensions: baseExtensions,
    })
    view.value = new EditorView({
      state,
      parent: element,
    })
    if (options.autofocus.value) {
      view.value.focus()
    }
  }

  const destroy = () => {
    view.value?.destroy()
    view.value = null
  }

  watch(
    containerRef,
    (element) => {
      if (element) {
        createView(element)
      } else {
        destroy()
      }
    },
    { immediate: true },
  )

  watch(
    () => options.modelValue.value,
    (nextValue) => {
      if (!view.value) {
        return
      }
      const current = view.value.state.doc.toString()
      if (current === nextValue) {
        return
      }
      view.value.dispatch({
        changes: {
          from: 0,
          to: view.value.state.doc.length,
          insert: nextValue,
        },
      })
    },
  )

  watch(
    () => options.language.value,
    (value) => {
      view.value?.dispatch({
        effects: languageCompartment.reconfigure(languageExtension(value)),
      })
    },
  )

  watch(
    () => options.readOnly.value,
    (value) => {
      view.value?.dispatch({
        effects: readOnlyCompartment.reconfigure([
          EditorState.readOnly.of(value),
          EditorView.editable.of(!value),
        ]),
      })
    },
  )

  watch(
    () => options.lineNumbers.value,
    (value) => {
      view.value?.dispatch({
        effects: lineNumbersCompartment.reconfigure(value ? cmLineNumbers() : []),
      })
    },
  )

  watch(
    () => options.lineWrapping.value,
    (value) => {
      view.value?.dispatch({
        effects: lineWrappingCompartment.reconfigure(value ? EditorView.lineWrapping : []),
      })
    },
  )

  watch(
    () => options.indentUnit.value,
    (value) => {
      view.value?.dispatch({
        effects: indentCompartment.reconfigure(cmIndentUnit.of(' '.repeat(Math.max(1, value)))),
      })
    },
  )

  watch(
    () => options.tabSize.value,
    (value) => {
      view.value?.dispatch({
        effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(Math.max(1, value))),
      })
    },
  )

  watch(
    () => options.placeholder.value,
    (value) => {
      view.value?.dispatch({
        effects: placeholderCompartment.reconfigure(value ? cmPlaceholder(value) : []),
      })
    },
  )

  watch(
    () => options.extensions.value,
    (value) => {
      view.value?.dispatch({
        effects: customExtensionsCompartment.reconfigure(value),
      })
    },
    { deep: true },
  )

  watch(
    () => options.dark.value,
    (value) => {
      view.value?.dispatch({
        effects: themeCompartment.reconfigure(value ? vuepyterDarkTheme : vuepyterLightTheme),
      })
    },
  )

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    view,
    focus: () => view.value?.focus(),
    blur: () => (view.value?.contentDOM as HTMLElement | undefined)?.blur(),
    destroy,
  }
}
