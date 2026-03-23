import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

// jsdom does not provide matchMedia by default; app theme logic depends on it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {
        // Legacy API no-op for compatibility.
      },
      removeListener: () => {
        // Legacy API no-op for compatibility.
      },
      addEventListener: () => {
        // Modern API no-op for compatibility.
      },
      removeEventListener: () => {
        // Modern API no-op for compatibility.
      },
      dispatchEvent: () => false,
    }),
  })
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    window.setTimeout(() => callback(performance.now()), 16)
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle: number) => {
    window.clearTimeout(handle)
  }
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {
    // No-op in jsdom.
  }
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {
    // No-op in jsdom.
  }
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
