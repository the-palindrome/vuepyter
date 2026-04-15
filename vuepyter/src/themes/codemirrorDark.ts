import { EditorView } from '@codemirror/view'

export const vuepyterDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--vuepyter-cell-bg)',
      color: 'var(--vuepyter-text)',
      fontSize: 'var(--vuepyter-font-size)',
      fontFamily: 'var(--vuepyter-font-mono)',
    },
    '.cm-content': {
      caretColor: 'var(--vuepyter-cursor-color)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--vuepyter-cell-bg)',
      color: 'var(--vuepyter-text-secondary)',
      borderRight: 'none',
    },
    '.cm-activeLineGutter, .cm-activeLine': {
      backgroundColor: 'var(--vuepyter-cell-active-line-bg, transparent)',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--vuepyter-cursor-color, #f8fafc)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--vuepyter-selection-bg, #334155)',
    },
  },
  { dark: true },
)
