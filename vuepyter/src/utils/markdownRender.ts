import katex from 'katex'
import { escapeHtml, sanitizeHtml } from './htmlSanitize'

export interface MarkdownRenderOptions {
  sanitize?: boolean
}

type PlaceholderMap = Map<string, string>

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;')
}

function safeHref(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return '#'
  }
  return escapeAttribute(trimmed)
}

function renderMathExpression(expression: string, displayMode: boolean): string {
  const trimmed = expression.trim()
  if (!trimmed) {
    return ''
  }

  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    })
  } catch {
    return `<code>${escapeHtml(trimmed)}</code>`
  }
}

function replaceInlineCodeWithPlaceholders(input: string): { content: string; placeholders: PlaceholderMap } {
  const placeholders: PlaceholderMap = new Map()
  let counter = 0
  const content = input.replace(/`([^`]+)`/gu, (_match: string, code: string) => {
    const token = `ZZVUEPYTERCODE${counter}ZZ`
    counter += 1
    placeholders.set(token, `<code>${escapeHtml(code)}</code>`)
    return token
  })

  return { content, placeholders }
}

function replaceInlineMathWithPlaceholders(input: string): { content: string; placeholders: PlaceholderMap } {
  const placeholders: PlaceholderMap = new Map()
  let counter = 0
  let index = 0
  let output = ''

  while (index < input.length) {
    const character = input[index]
    const previousCharacter = index > 0 ? input[index - 1] : ''
    const nextCharacter = index + 1 < input.length ? input[index + 1] : ''

    if (character !== '$' || previousCharacter === '\\' || nextCharacter === '$') {
      output += character
      index += 1
      continue
    }

    let cursor = index + 1
    let content = ''
    let foundTerminator = false

    while (cursor < input.length) {
      const next = input[cursor]
      const previous = cursor > index + 1 ? input[cursor - 1] : ''
      const after = cursor + 1 < input.length ? input[cursor + 1] : ''
      if (next === '$' && previous !== '\\' && after !== '$') {
        foundTerminator = true
        break
      }
      content += next
      cursor += 1
    }

    if (!foundTerminator) {
      output += character
      index += 1
      continue
    }

    const rendered = renderMathExpression(content, false)
    if (rendered) {
      const token = `ZZVUEPYTERMATH${counter}ZZ`
      counter += 1
      placeholders.set(token, rendered)
      output += token
    } else {
      output += `$${content}$`
    }

    index = cursor + 1
  }

  return { content: output, placeholders }
}

function restorePlaceholders(input: string, placeholders: PlaceholderMap[]): string {
  let output = input
  for (const group of placeholders) {
    for (const [token, replacement] of group.entries()) {
      output = output.replaceAll(token, replacement)
    }
  }
  return output
}

function renderInline(input: string): string {
  const codePass = replaceInlineCodeWithPlaceholders(input)
  const mathPass = replaceInlineMathWithPlaceholders(codePass.content)
  let html = escapeHtml(mathPass.content)

  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/gu,
    (_match: string, alt: string, src: string) =>
      `<img src="${safeHref(src)}" alt="${escapeAttribute(alt)}" />`,
  )

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/gu,
    (_match: string, label: string, href: string) => `<a href="${safeHref(href)}">${label}</a>`,
  )

  html = html.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/gu, '<strong>$1</strong>')
  html = html.replace(/(^|[^\*])\*([^*]+)\*(?!\*)/gu, '$1<em>$2</em>')
  html = html.replace(/(^|[^_])_([^_]+)_(?!_)/gu, '$1<em>$2</em>')

  return restorePlaceholders(html, [mathPass.placeholders, codePass.placeholders])
}

function consumeList(
  lines: string[],
  startIndex: number,
  kind: 'ul' | 'ol',
): { html: string; nextIndex: number } {
  let index = startIndex
  const items: string[] = []
  const unordered = /^[-*+]\s+(.+)$/u
  const ordered = /^\d+\.\s+(.+)$/u
  const matcher = kind === 'ul' ? unordered : ordered

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? ''
    const match = line.match(matcher)
    if (!match) {
      break
    }
    items.push(`<li>${renderInline(match[1] ?? '')}</li>`)
    index += 1
  }

  return {
    html: `<${kind}>${items.join('')}</${kind}>`,
    nextIndex: index,
  }
}

function consumeParagraph(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  let index = startIndex
  const chunk: string[] = []

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      break
    }

    if (
      /^#{1,6}\s+/u.test(trimmed) ||
      /^[-*+]\s+/u.test(trimmed) ||
      /^\d+\.\s+/u.test(trimmed) ||
      /^```/u.test(trimmed) ||
      /^\$\$/u.test(trimmed)
    ) {
      break
    }

    chunk.push(renderInline(line))
    index += 1
  }

  return {
    html: `<p>${chunk.join('<br />')}</p>`,
    nextIndex: index,
  }
}

function consumeCodeFence(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  let index = startIndex + 1
  const body: string[] = []

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (/^```/u.test(line.trim())) {
      index += 1
      break
    }
    body.push(line)
    index += 1
  }

  return {
    html: `<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`,
    nextIndex: index,
  }
}

function consumeMathBlock(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const startLine = lines[startIndex] ?? ''
  const openIndex = startLine.indexOf('$$')
  const remainder = openIndex >= 0 ? startLine.slice(openIndex + 2) : ''

  const closeOnStart = remainder.indexOf('$$')
  if (closeOnStart >= 0) {
    const expression = remainder.slice(0, closeOnStart)
    return {
      html: renderMathExpression(expression, true),
      nextIndex: startIndex + 1,
    }
  }

  const chunks: string[] = []
  if (remainder.trim()) {
    chunks.push(remainder)
  }

  let index = startIndex + 1
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const closeIndex = line.indexOf('$$')
    if (closeIndex >= 0) {
      const beforeClose = line.slice(0, closeIndex)
      if (beforeClose.trim()) {
        chunks.push(beforeClose)
      }
      index += 1
      break
    }
    chunks.push(line)
    index += 1
  }

  return {
    html: renderMathExpression(chunks.join('\n'), true),
    nextIndex: index,
  }
}

export function renderMarkdownToHtml(source: string, options: MarkdownRenderOptions = {}): string {
  if (!source.trim()) {
    return ''
  }

  const lines = source.replace(/\r\n?/gu, '\n').split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (/^```/u.test(trimmed)) {
      const code = consumeCodeFence(lines, index)
      blocks.push(code.html)
      index = code.nextIndex
      continue
    }

    if (/^\$\$/u.test(trimmed)) {
      const mathBlock = consumeMathBlock(lines, index)
      if (mathBlock.html) {
        blocks.push(mathBlock.html)
      }
      index = mathBlock.nextIndex
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/u)
    if (heading) {
      const level = (heading[1] ?? '#').length
      const headingText = heading[2] ?? ''
      blocks.push(`<h${level}>${renderInline(headingText)}</h${level}>`)
      index += 1
      continue
    }

    if (/^[-*+]\s+/u.test(trimmed)) {
      const list = consumeList(lines, index, 'ul')
      blocks.push(list.html)
      index = list.nextIndex
      continue
    }

    if (/^\d+\.\s+/u.test(trimmed)) {
      const list = consumeList(lines, index, 'ol')
      blocks.push(list.html)
      index = list.nextIndex
      continue
    }

    const paragraph = consumeParagraph(lines, index)
    blocks.push(paragraph.html)
    index = paragraph.nextIndex
  }

  const html = blocks.join('\n')
  if (options.sanitize === false) {
    return html
  }

  return sanitizeHtml(html)
}

export const renderMarkdown = renderMarkdownToHtml
