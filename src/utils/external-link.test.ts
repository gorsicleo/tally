import { describe, expect, it, vi } from 'vitest'
import { openExternalUrl } from './external-link'

describe('openExternalUrl', () => {
  it('opens a new tab when popup is allowed', () => {
    const open = vi.fn(() => ({}) as Window)
    const assign = vi.fn()

    const didOpen = openExternalUrl('https://example.com', {
      open,
      location: { assign },
    })

    expect(didOpen).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    expect(assign).not.toHaveBeenCalled()
  })

  it('falls back to same-tab navigation when popup is blocked', () => {
    const open = vi.fn(() => null)
    const assign = vi.fn()

    const didOpen = openExternalUrl('https://example.com', {
      open,
      location: { assign },
    })

    expect(didOpen).toBe(true)
    expect(assign).toHaveBeenCalledWith('https://example.com')
  })

  it('returns false when navigation throws', () => {
    const open = vi.fn(() => {
      throw new Error('blocked')
    })
    const assign = vi.fn()

    const didOpen = openExternalUrl('https://example.com', {
      open,
      location: { assign },
    })

    expect(didOpen).toBe(false)
  })
})
