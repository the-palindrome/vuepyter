import { escapeHtml, sanitizeHtml } from './htmlSanitize'

export interface MarkdownRenderOptions {
  sanitize?: boolean
}

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

function renderInline(input: string): string {
  let html = escapeHtml(input)

  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/gu,
    (_match: string, alt: string, src: string) =>
      `<img src="${safeHref(src)}" alt="${escapeAttribute(alt)}" />`,
  )

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/gu,
    (_match: string, label: string, href: string) => `<a href="${safeHref(href)}">${label}</a>`,
  )

  html = html.replace(/`([^`]+)`/gu, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/gu, '<strong>$1</strong>')
  html = html.replace(/(^|[^\*])\*([^*]+)\*(?!\*)/gu, '$1<em>$2</em>')
  html = html.replace(/(^|[^_])_([^_]+)_(?!_)/gu, '$1<em>$2</em>')

  return html
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
      /^```/u.test(trimmed)
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
