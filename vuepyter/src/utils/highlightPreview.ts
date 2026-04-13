import { markdownLanguage } from '@codemirror/lang-markdown'
import { pythonLanguage } from '@codemirror/lang-python'
import type { Parser } from '@lezer/common'
import { highlightCode } from '@lezer/highlight'
import { StyleModule } from 'style-mod'
import { vuepyterHighlightStyle } from '../themes/highlightStyle'

type PreviewLanguage = 'python' | 'markdown' | 'raw'

let highlightModuleMounted = false

function ensureHighlightModuleMounted(): void {
  if (highlightModuleMounted || typeof document === 'undefined' || !vuepyterHighlightStyle.module) {
    return
  }
  StyleModule.mount(document, vuepyterHighlightStyle.module)
  highlightModuleMounted = true
}

function parserForLanguage(language: PreviewLanguage): Parser | null {
  if (language === 'python') {
    return pythonLanguage.parser
  }
  if (language === 'markdown') {
    return markdownLanguage.parser
  }
  return null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return value.replaceAll('"', '&quot;')
}

export function highlightPreviewLine(source: string, language: PreviewLanguage): string {
  const [firstLine = ''] = source.split(/\r?\n/u)
  const line = firstLine || '...'
  const parser = parserForLanguage(language)
  if (!parser) {
    return escapeHtml(line)
  }

  ensureHighlightModuleMounted()
  const tree = parser.parse(line)
  let html = ''

  highlightCode(
    line,
    tree,
    vuepyterHighlightStyle,
    (chunk, classes) => {
      const escapedChunk = escapeHtml(chunk)
      if (!escapedChunk) {
        return
      }
      if (!classes) {
        html += escapedChunk
        return
      }
      html += `<span class="${escapeAttribute(classes)}">${escapedChunk}</span>`
    },
    () => {
      html += '\n'
    },
  )

  return html || escapeHtml(line)
}

