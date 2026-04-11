import { beforeEach, vi } from 'vitest'

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}`,
    },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})
