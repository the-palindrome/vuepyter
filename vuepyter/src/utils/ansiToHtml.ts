import { escapeHtml } from './htmlSanitize'

const FOREGROUND: Record<number, string> = {
  30: '#000000',
  31: '#b91c1c',
  32: '#15803d',
  33: '#a16207',
  34: '#1d4ed8',
  35: '#7c3aed',
  36: '#0f766e',
  37: '#334155',
  90: '#475569',
  91: '#ef4444',
  92: '#22c55e',
  93: '#f59e0b',
  94: '#60a5fa',
  95: '#a78bfa',
  96: '#2dd4bf',
  97: '#e2e8f0',
}

const BACKGROUND: Record<number, string> = {
  40: '#000000',
  41: '#b91c1c',
  42: '#15803d',
  43: '#a16207',
  44: '#1d4ed8',
  45: '#7c3aed',
  46: '#0f766e',
  47: '#334155',
  100: '#475569',
  101: '#ef4444',
  102: '#22c55e',
  103: '#f59e0b',
  104: '#60a5fa',
  105: '#a78bfa',
  106: '#2dd4bf',
  107: '#e2e8f0',
}

interface AnsiState {
  bold: boolean
  italic: boolean
  underline: boolean
  fg: string | null
  bg: string | null
}

const INITIAL_STATE: AnsiState = {
  bold: false,
  italic: false,
  underline: false,
  fg: null,
  bg: null,
}

function stateToStyle(state: AnsiState): string {
  const style: string[] = []

  if (state.bold) {
    style.push('font-weight: 700')
  }
  if (state.italic) {
    style.push('font-style: italic')
  }
  if (state.underline) {
    style.push('text-decoration: underline')
  }
  if (state.fg) {
    style.push(`color: ${state.fg}`)
  }
  if (state.bg) {
    style.push(`background-color: ${state.bg}`)
  }

  return style.join('; ')
}

function applyAnsiCode(state: AnsiState, code: number): void {
  if (code === 0) {
    state.bold = false
    state.italic = false
    state.underline = false
    state.fg = null
    state.bg = null
    return
  }

  if (code === 1) {
    state.bold = true
    return
  }
  if (code === 3) {
    state.italic = true
    return
  }
  if (code === 4) {
    state.underline = true
    return
  }
  if (code === 22) {
    state.bold = false
    return
  }
  if (code === 23) {
    state.italic = false
    return
  }
  if (code === 24) {
    state.underline = false
    return
  }
  if (code === 39) {
    state.fg = null
    return
  }
  if (code === 49) {
    state.bg = null
    return
  }

  if (code in FOREGROUND) {
    state.fg = FOREGROUND[code] ?? null
  } else if (code in BACKGROUND) {
    state.bg = BACKGROUND[code] ?? null
  }
}

function renderChunk(text: string, state: AnsiState): string {
  if (!text) {
    return ''
  }

  const escaped = escapeHtml(text)
  const style = stateToStyle(state)
  if (!style) {
    return escaped
  }

  return `<span style="${style}">${escaped}</span>`
}

export interface AnsiToHtmlOptions {
  newlineToBr?: boolean
}

export function ansiToHtml(input: string, options: AnsiToHtmlOptions = {}): string {
  const text = input ?? ''
  if (!text) {
    return ''
  }

  const state: AnsiState = { ...INITIAL_STATE }
  const ansiRegex = /\u001b\[([0-9;]*)m/gu
  const chunks: string[] = []
  let cursor = 0

  for (const match of text.matchAll(ansiRegex)) {
    const full = match[0]
    const codes = match[1]
    const start = match.index ?? 0

    if (start > cursor) {
      chunks.push(renderChunk(text.slice(cursor, start), state))
    }

    const values = (codes ? codes.split(';') : ['0'])
      .map((part) => Number.parseInt(part || '0', 10))
      .filter((value) => Number.isFinite(value))

    for (const code of values) {
      applyAnsiCode(state, code)
    }

    cursor = start + full.length
  }

  if (cursor < text.length) {
    chunks.push(renderChunk(text.slice(cursor), state))
  }

  const html = chunks.join('')
  if (options.newlineToBr) {
    return html.replaceAll('\n', '<br />')
  }

  return html
}
