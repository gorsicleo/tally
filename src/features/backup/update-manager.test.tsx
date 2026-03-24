import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { UpdateManager } from './update-manager'
import { renderWithUser } from '../../test/render-utils'
import type { AppVersionInfo } from '../../pwa/app-version'

interface MockedUpdateHookValue {
  updateAvailable: boolean
  needsReload: boolean
  isApplyingUpdate: boolean
  currentVersionInfo: AppVersionInfo
  availableVersionInfo: AppVersionInfo | null
  promptVisible: boolean
  isIosStandalone: boolean
  dismiss: ReturnType<typeof vi.fn>
  applyUpdate: ReturnType<typeof vi.fn>
}

const hookState = vi.hoisted(() => ({
  value: {
    updateAvailable: true,
    needsReload: false,
    isApplyingUpdate: false,
    currentVersionInfo: {
      version: '1.0.0',
      changelog: [],
      severity: 'minor' as const,
    },
    availableVersionInfo: {
      version: '1.1.0',
      changelog: ['Improved charts', 'Safer backups', 'Update prompt', 'Ignored'],
      severity: 'minor' as const,
    },
    promptVisible: true,
    isIosStandalone: false,
    dismiss: vi.fn(),
    applyUpdate: vi.fn(async () => undefined),
  } as MockedUpdateHookValue,
}))

vi.mock('../../pwa/use-service-worker-update', () => ({
  useServiceWorkerUpdate: () => hookState.value,
}))

describe('UpdateManager', () => {
  beforeEach(() => {
    hookState.value.dismiss.mockClear()
    hookState.value.applyUpdate.mockClear()
    hookState.value = {
      ...hookState.value,
      promptVisible: true,
      needsReload: false,
      isApplyingUpdate: false,
      isIosStandalone: false,
      availableVersionInfo: {
        version: '1.1.0',
        changelog: ['Improved charts', 'Safer backups', 'Update prompt', 'Ignored'],
        severity: 'minor',
      },
    }
  })

  it('shows version metadata and updates immediately for minor releases', async () => {
    const { user } = renderWithUser(
      <UpdateManager onCreateBackup={vi.fn(async () => true)} />,
    )

    expect(screen.getByRole('dialog', { name: 'Update available' })).toBeInTheDocument()
    expect(screen.getByText('Version 1.1.0')).toBeInTheDocument()
    expect(screen.getByText('Improved charts')).toBeInTheDocument()
    expect(screen.getByText('Safer backups')).toBeInTheDocument()
    expect(screen.getByText('Update prompt')).toBeInTheDocument()
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(hookState.value.applyUpdate).toHaveBeenCalled()
  })

  it('does not render when no update is available', () => {
    hookState.value = {
      ...hookState.value,
      promptVisible: false,
    }

    renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.queryByRole('dialog', { name: 'Update available' })).not.toBeInTheDocument()
  })

  it('dismisses the prompt when Later is clicked', async () => {
    const { user } = renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    await user.click(screen.getByRole('button', { name: 'Later' }))

    expect(hookState.value.dismiss).toHaveBeenCalledTimes(1)
  })

  it('shows reload wording when a later tab activation already happened', async () => {
    hookState.value = {
      ...hookState.value,
      needsReload: true,
    }

    renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.getByText('A newer version is active and this tab can reload when you are ready.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('requires confirmation for recommended-backup releases', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '1.2.0',
        changelog: ['Migration hardening'],
        severity: 'recommended-backup',
      },
    }
    const onCreateBackup = vi.fn(async () => true)
    const { user } = renderWithUser(<UpdateManager onCreateBackup={onCreateBackup} />)

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(
      screen.getByText('We recommend backing up your data before updating.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create backup' }))

    expect(onCreateBackup).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Update now' }))

    expect(hookState.value.applyUpdate).toHaveBeenCalled()
  })

  it('lets users proceed without backup for recommended-backup releases', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '1.2.0',
        changelog: ['Migration hardening'],
        severity: 'recommended-backup',
      },
    }
    const onCreateBackup = vi.fn(async () => true)
    const { user } = renderWithUser(<UpdateManager onCreateBackup={onCreateBackup} />)

    await user.click(screen.getByRole('button', { name: 'Update' }))
    await user.click(screen.getByRole('button', { name: 'Update anyway' }))

    expect(onCreateBackup).not.toHaveBeenCalled()
    expect(hookState.value.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('blocks backup-required releases until a backup succeeds', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '2.0.0',
        changelog: ['Storage migration'],
        severity: 'backup-required',
      },
    }
    const onCreateBackup = vi.fn(async () => true)
    const { user } = renderWithUser(<UpdateManager onCreateBackup={onCreateBackup} />)

    await user.click(screen.getByRole('button', { name: 'Update' }))

    const updateButton = screen.getByRole('button', { name: 'Update' })
    expect(updateButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create backup' }))

    expect(onCreateBackup).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(hookState.value.applyUpdate).toHaveBeenCalled()
  })

  it('keeps backup-required updates blocked when backup creation fails', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '2.0.0',
        changelog: ['Storage migration'],
        severity: 'backup-required',
      },
    }
    const onCreateBackup = vi.fn(async () => false)
    const { user } = renderWithUser(<UpdateManager onCreateBackup={onCreateBackup} />)

    await user.click(screen.getByRole('button', { name: 'Update' }))
    await user.click(screen.getByRole('button', { name: 'Create backup' }))

    expect(onCreateBackup).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
    expect(hookState.value.applyUpdate).not.toHaveBeenCalled()
  })

  it('shows an iOS standalone hint when applicable', () => {
    hookState.value = {
      ...hookState.value,
      isIosStandalone: true,
    }

    renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.getByText(/Installed iPhone and iPad apps can apply updates later than Safari/)).toBeInTheDocument()
  })

  it('remains usable when the changelog is empty and version is missing', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '' as never,
        changelog: [],
        severity: 'minor',
      },
    }
    const { user } = renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(hookState.value.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('falls back to the safer warning flow for unknown severities', async () => {
    hookState.value = {
      ...hookState.value,
      availableVersionInfo: {
        version: '3.0.0',
        changelog: ['Unexpected metadata'],
        severity: 'unknown' as never,
      },
    }
    const { user } = renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(screen.getByText('We recommend backing up your data before updating.')).toBeInTheDocument()
  })

  it('disables update actions while an update is already applying', () => {
    hookState.value = {
      ...hookState.value,
      isApplyingUpdate: true,
    }

    renderWithUser(<UpdateManager onCreateBackup={vi.fn(async () => true)} />)

    expect(screen.getByRole('button', { name: 'Updating...' })).toBeDisabled()
  })
})

