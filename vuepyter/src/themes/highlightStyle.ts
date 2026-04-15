import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const vuepyterHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--vuepyter-syntax-keyword, #7c3aed)' },
  { tag: tags.string, color: 'var(--vuepyter-syntax-string, #16a34a)' },
  { tag: tags.number, color: 'var(--vuepyter-syntax-number, #2563eb)' },
  { tag: tags.comment, color: 'var(--vuepyter-syntax-comment, #9ca3af)', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: 'var(--vuepyter-syntax-function, #d97706)' },
  { tag: tags.variableName, color: 'var(--vuepyter-syntax-variable, inherit)' },
  { tag: tags.operator, color: 'var(--vuepyter-syntax-operator, #e11d48)' },
])
