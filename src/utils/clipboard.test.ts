import { describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from './clipboard'

describe('copyTextToClipboard', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn(async () => undefined)
    const didCopy = await copyTextToClipboard('hello', {
      navigatorObject: {
        clipboard: { writeText },
      },
    })

    expect(didCopy).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    const focus = vi.fn()
    const select = vi.fn()
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const execCommand = vi.fn(() => true)

    const didCopy = await copyTextToClipboard('fallback text', {
      navigatorObject: {
        clipboard: { writeText },
      },
      documentObject: {
        createElement: () => ({
          value: '',
          style: {
            position: '',
            top: '',
            left: '',
          },
          setAttribute: () => undefined,
          focus,
          select,
        }),
        body: {
          appendChild,
          removeChild,
        },
        execCommand,
      },
    })

    expect(didCopy).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('returns false when no clipboard strategy is available', async () => {
    const didCopy = await copyTextToClipboard('hello', {
      navigatorObject: {},
      documentObject: undefined,
    })

    expect(didCopy).toBe(false)
  })
})
