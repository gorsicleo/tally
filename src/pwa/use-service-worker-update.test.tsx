import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppVersionInfo } from './app-version'
import { MockBroadcastChannel } from '../test/update-test-utils'
import { useServiceWorkerUpdate } from './use-service-worker-update'

const registerServiceWorkerState = vi.hoisted(() => ({
  snapshot: {
    updateAvailable: false,
    needsReload: false,
    isApplyingUpdate: false,
    currentVersionInfo: {
      version: '1.0.0',
      changelog: ['Current'],
      severity: 'minor' as const,
    },
    availableVersionInfo: null as AppVersionInfo | null,
  },
  applyUpdate: vi.fn(async () => undefined),
  getCurrentVersionInfo: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./register-service-worker', () => ({
  applyServiceWorkerUpdate: registerServiceWorkerState.applyUpdate,
  getCurrentVersionInfo: registerServiceWorkerState.getCurrentVersionInfo,
  getServiceWorkerUpdateSnapshot: () => registerServiceWorkerState.snapshot,
  subscribeToServiceWorkerUpdates: (listener: (snapshot: typeof registerServiceWorkerState.snapshot) => void) => {
    registerServiceWorkerState.subscribe(listener)
    listener(registerServiceWorkerState.snapshot)
    return registerServiceWorkerState.unsubscribe
  },
}))

describe('useServiceWorkerUpdate', () => {
  beforeEach(() => {
    window.localStorage.clear()
    MockBroadcastChannel.reset()
    registerServiceWorkerState.applyUpdate.mockClear()
    registerServiceWorkerState.subscribe.mockClear()
    registerServiceWorkerState.unsubscribe.mockClear()
    registerServiceWorkerState.snapshot = {
      updateAvailable: false,
      needsReload: false,
      isApplyingUpdate: false,
      currentVersionInfo: {
        version: '1.0.0',
        changelog: ['Current'],
        severity: 'minor',
      },
      availableVersionInfo: null,
    }
    registerServiceWorkerState.getCurrentVersionInfo.mockReturnValue({
      version: '1.0.0',
      changelog: ['Current'],
      severity: 'minor',
    })
    vi.stubGlobal('BroadcastChannel', undefined)
  })

  it('starts hidden when no update is available', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(false)
    expect(result.current.updateAvailable).toBe(false)
  })

  it('uses the current version info as a fallback when a waiting update has no metadata yet', () => {
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(true)
    expect(result.current.availableVersionInfo).toEqual({
      version: '1.0.0',
      changelog: ['Current'],
      severity: 'minor',
    })
  })

  it('dismisses the current version and stores the dismissal locally', async () => {
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.2.0',
        changelog: ['Update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    act(() => {
      result.current.dismiss()
    })

    await waitFor(() => {
      expect(result.current.promptVisible).toBe(false)
    })
    expect(
      JSON.parse(window.localStorage.getItem('tally:update-dismissed') ?? '{}'),
    ).toMatchObject({ version: '1.2.0' })
  })

  it('keeps the prompt hidden when the same version was dismissed earlier', () => {
    window.localStorage.setItem(
      'tally:update-dismissed',
      JSON.stringify({ version: '1.2.0', dismissedAt: Date.now() }),
    )
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.2.0',
        changelog: ['Update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(false)
  })

  it('clears expired dismissal records and keeps prompt visible', () => {
    window.localStorage.setItem(
      'tally:update-dismissed',
      JSON.stringify({
        version: '1.2.0',
        dismissedAt: Date.now() - 1000 * 60 * 60 * 7,
      }),
    )
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.2.0',
        changelog: ['Update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(true)
    expect(window.localStorage.getItem('tally:update-dismissed')).toBeNull()
  })

  it('shows the prompt again when a different version arrives after a dismissal', () => {
    window.localStorage.setItem(
      'tally:update-dismissed',
      JSON.stringify({ version: '1.2.0', dismissedAt: Date.now() }),
    )
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.3.0',
        changelog: ['New update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(true)
  })

  it('reacts to storage updates from another tab', async () => {
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.4.0',
        changelog: ['Cross-tab update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())

    expect(result.current.promptVisible).toBe(true)

    act(() => {
      window.localStorage.setItem(
        'tally:update-dismissed',
        JSON.stringify({ version: '1.4.0', dismissedAt: Date.now() }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'tally:update-dismissed',
        }),
      )
    })

    await waitFor(() => {
      expect(result.current.promptVisible).toBe(false)
    })
  })

  it('reacts to broadcast channel dismissal updates', async () => {
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    registerServiceWorkerState.snapshot = {
      ...registerServiceWorkerState.snapshot,
      updateAvailable: true,
      availableVersionInfo: {
        version: '1.5.0',
        changelog: ['Broadcast update'],
        severity: 'minor',
      },
    }

    const { result } = renderHook(() => useServiceWorkerUpdate())
    const remoteChannel = new MockBroadcastChannel('tally-update-prompts')

    act(() => {
      remoteChannel.postMessage({
        version: '1.5.0',
        dismissedAt: Date.now(),
      })
    })

    await waitFor(() => {
      expect(result.current.promptVisible).toBe(false)
    })
  })

  it('delegates update application to the service worker module', async () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())

    await act(async () => {
      await result.current.applyUpdate()
    })

    expect(registerServiceWorkerState.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('cleans up the subscription on unmount', () => {
    const { unmount } = renderHook(() => useServiceWorkerUpdate())

    unmount()

    expect(registerServiceWorkerState.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
