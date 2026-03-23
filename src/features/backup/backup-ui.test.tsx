import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  BackupReminderCard,
  PrivacyFirstModal,
  RestoreBackupDialog,
} from './backup-ui'
import { renderWithUser } from '../../test/render-utils'

describe('PrivacyFirstModal', () => {
  it('submits the selected reminder preference', async () => {
    const onContinue = vi.fn(async () => undefined)
    const { user } = renderWithUser(
      <PrivacyFirstModal
        initialRemindersEnabled={false}
        onContinue={onContinue}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Remind me to create backups' }))
    await user.click(screen.getByRole('button', { name: 'I understand' }))

    expect(onContinue).toHaveBeenCalledWith(true)
  })
})

describe('BackupReminderCard', () => {
  it('runs backup creation and later action buttons', async () => {
    const onCreateBackup = vi.fn(async () => undefined)
    const onLater = vi.fn()
    const { user } = renderWithUser(
      <BackupReminderCard
        body="Test reminder body"
        onCreateBackup={onCreateBackup}
        onLater={onLater}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(onLater).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Create backup' }))
    expect(onCreateBackup).toHaveBeenCalled()
  })
})

describe('RestoreBackupDialog', () => {
  it('supports cancel and confirm actions', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn(async () => undefined)
    const { user } = renderWithUser(
      <RestoreBackupDialog
        fileName="backup.json"
        exportedAtLabel="Mar 20, 12:00 PM"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})