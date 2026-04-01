import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportBugDialog } from './report-bug-dialog'

describe('ReportBugDialog', () => {
  it('ignores escape and backdrop dismissal while copy is in progress', async () => {
    const copyDeferred: { resolve: (() => void) | null } = { resolve: null }
    const onCancel = vi.fn()
    const onCopyAppInfo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          copyDeferred.resolve = resolve
        }),
    )
    const onOpenGithubIssue = vi.fn(async () => undefined)
    const user = userEvent.setup()

    render(
      <ReportBugDialog
        appVersion="0.0.0-test"
        onCancel={onCancel}
        onCopyAppInfo={onCopyAppInfo}
        onOpenGithubIssue={onOpenGithubIssue}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Report a bug' })
    await user.click(screen.getByRole('button', { name: 'Copy app info' }))

    expect(await screen.findByRole('button', { name: 'Copying...' })).toBeDisabled()

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(dialog.parentElement as Element)

    expect(onCancel).not.toHaveBeenCalled()

    if (copyDeferred.resolve) {
      copyDeferred.resolve()
    }
  })

  it('ignores escape and backdrop dismissal while github issue action is in progress', async () => {
    const openDeferred: { resolve: (() => void) | null } = { resolve: null }
    const onCancel = vi.fn()
    const onCopyAppInfo = vi.fn(async () => undefined)
    const onOpenGithubIssue = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          openDeferred.resolve = resolve
        }),
    )
    const user = userEvent.setup()

    render(
      <ReportBugDialog
        appVersion="0.0.0-test"
        onCancel={onCancel}
        onCopyAppInfo={onCopyAppInfo}
        onOpenGithubIssue={onOpenGithubIssue}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Report a bug' })
    await user.click(screen.getByRole('button', { name: 'Open GitHub issue' }))

    expect(await screen.findByRole('button', { name: 'Opening...' })).toBeDisabled()

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(dialog.parentElement as Element)

    expect(onCancel).not.toHaveBeenCalled()

    if (openDeferred.resolve) {
      openDeferred.resolve()
    }
  })
})
