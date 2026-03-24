import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithUser } from '../../test/render-utils'
import { UpdateManager } from './update-manager'
import {
  dispatchControllerChangeForTests,
  getServiceWorkerUpdateSnapshot,
  resetServiceWorkerUpdateStateForTests,
  setReloadSuppressedForTests,
  simulateServiceWorkerUpdateForTests,
} from '../../pwa/register-service-worker'
import { createMockServiceWorker } from '../../test/update-test-utils'

describe('UpdateManager integration', () => {
  beforeEach(() => {
    resetServiceWorkerUpdateStateForTests()
    setReloadSuppressedForTests(true)
    window.localStorage.clear()
  })

  it('becomes visible when an update is announced after initial render', async () => {
    renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.queryByRole('dialog', { name: 'Update available' })).not.toBeInTheDocument()

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.1.0',
          changelog: ['Runtime update'],
          severity: 'minor',
        },
      })
    })

    expect(await screen.findByRole('dialog', { name: 'Update available' })).toBeInTheDocument()
  })

  it('sends skipWaiting to the waiting worker when the user updates', async () => {
    const worker = createMockServiceWorker()
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={vi.fn(async () => true)} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.2.0',
          changelog: ['Apply me'],
          severity: 'minor',
        },
        waitingWorkerOverride: worker as unknown as ServiceWorker,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Update' }))

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'TALLY_SKIP_WAITING',
    })
  })

  it('requests reload after controllerchange only once for the current app instance', async () => {
    const worker = createMockServiceWorker()
    const reloadEvents: CustomEvent[] = []
    window.addEventListener('tally:update-reload-requested', ((event: Event) => {
      reloadEvents.push(event as CustomEvent)
    }) as EventListener)

    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={vi.fn(async () => true)} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.2.0',
          changelog: ['Apply me'],
          severity: 'minor',
        },
        waitingWorkerOverride: worker as unknown as ServiceWorker,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Update' }))

    act(() => {
      dispatchControllerChangeForTests()
      dispatchControllerChangeForTests()
    })

    await waitFor(() => {
      expect(reloadEvents).toHaveLength(1)
    })
  })

  it('hides the prompt after Later and avoids reload requests', async () => {
    const reloadListener = vi.fn()
    window.addEventListener('tally:update-reload-requested', reloadListener as EventListener)
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={vi.fn(async () => true)} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.3.0',
          changelog: ['Dismiss me'],
          severity: 'minor',
        },
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Later' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Update available' })).not.toBeInTheDocument()
    })
    expect(reloadListener).not.toHaveBeenCalled()
  })

  it('keeps backup-required updates blocked until backup succeeds', async () => {
    const worker = createMockServiceWorker()
    const onCreateBackup = vi.fn(async () => true)
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={onCreateBackup} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '2.0.0',
          changelog: ['Migration'],
          severity: 'backup-required',
        },
        waitingWorkerOverride: worker as unknown as ServiceWorker,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Update' }))

    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create backup' }))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(onCreateBackup).toHaveBeenCalledTimes(1)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
  })

  it('keeps backup-required reloads blocked until backup succeeds', async () => {
    const worker = createMockServiceWorker()
    const onCreateBackup = vi.fn(async () => true)
    const reloadListener = vi.fn()
    window.addEventListener(
      'tally:update-reload-requested',
      reloadListener as EventListener,
    )
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={onCreateBackup} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '2.1.0',
          changelog: ['Reload required'],
          severity: 'backup-required',
        },
        needsReload: true,
        waitingWorkerOverride: worker as unknown as ServiceWorker,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Reload' }))

    expect(screen.getByText('Backup required before updating.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create backup' }))
    await user.click(screen.getByRole('button', { name: 'Reload' }))

    expect(onCreateBackup).toHaveBeenCalledTimes(1)
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(reloadListener).toHaveBeenCalledTimes(1)
  })

  it('keeps the same version hidden after dismissal and re-shows a newer version', async () => {
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={vi.fn(async () => true)} />,
    )

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.4.0',
          changelog: ['Dismissed'],
          severity: 'minor',
        },
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Later' }))
    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.4.0',
          changelog: ['Dismissed'],
          severity: 'minor',
        },
      })
    })

    expect(screen.queryByRole('dialog', { name: 'Update available' })).not.toBeInTheDocument()

    act(() => {
      simulateServiceWorkerUpdateForTests({
        availableVersionInfo: {
          version: '1.5.0',
          changelog: ['New version'],
          severity: 'minor',
        },
      })
    })

    expect(await screen.findByRole('dialog', { name: 'Update available' })).toBeInTheDocument()
    expect(getServiceWorkerUpdateSnapshot().availableVersionInfo?.version).toBe('1.5.0')
  })
})