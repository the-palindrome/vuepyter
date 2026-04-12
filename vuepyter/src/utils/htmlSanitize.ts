const ALLOWED_TAGS = new Set([
  'a',
  'img',
  'p',
  'strong',
  'em',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class', 'title', 'aria-hidden']),
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title']),
  span: new Set(['style']),
}

function isSafeUrl(attribute: 'href' | 'src', value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  if (attribute === 'src' && trimmed.startsWith('data:image/png;base64,')) {
    return true
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return true
  }
  return /^(https?:|mailto:)/i.test(trimmed)
}

function shouldKeepAttribute(tagName: string, attributeName: string): boolean {
  const normalizedTag = tagName.toLowerCase()
  const normalizedAttr = attributeName.toLowerCase()
  const globalAttributes = ALLOWED_ATTRS['*'] ?? new Set<string>()
  if (globalAttributes.has(normalizedAttr)) {
    return true
  }
  return ALLOWED_ATTRS[normalizedTag]?.has(normalizedAttr) ?? false
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function sanitizeElement(element: Element): void {
  for (const child of [...element.children]) {
    sanitizeElement(child)
  }

  const tagName = element.tagName.toLowerCase()
  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes))
    return
  }

  for (const attr of [...element.attributes]) {
    const attrName = attr.name.toLowerCase()
    if (!shouldKeepAttribute(tagName, attrName)) {
      element.removeAttribute(attr.name)
      continue
    }

    if ((attrName === 'href' || attrName === 'src') && !isSafeUrl(attrName, attr.value)) {
      element.removeAttribute(attr.name)
    }
  }

  if (tagName === 'a' && element.getAttribute('target') === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer')
  }
}

export function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') {
    return escapeHtml(html)
  }

  const template = document.createElement('template')
  template.innerHTML = html

  for (const child of [...template.content.children]) {
    sanitizeElement(child)
  }

  return template.innerHTML
}
