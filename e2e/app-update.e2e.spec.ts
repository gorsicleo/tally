import { expect, test } from '@playwright/test'
import { createSeedState } from './test-data'
import {
  dispatchUpdateControllerChange,
  freezeTime,
  getUpdateTestState,
  resetUpdateTestHooks,
  seedAppState,
  simulateUpdateAvailable,
  waitForAppReady,
} from './test-helpers'

test('update available flow applies a minor update and requests reload', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ withTransactions: false }))

  await page.goto('/')
  await waitForAppReady(page)
  await resetUpdateTestHooks(page)

  await simulateUpdateAvailable(page, {
    availableVersionInfo: {
      version: '1.1.0',
      changelog: ['Improved offline update reliability.', 'Safer cache cleanup.', 'Update prompt.'],
      severity: 'minor',
    },
    withMockWaitingWorker: true,
  })

  await expect(page.getByRole('dialog', { name: 'Update available' })).toBeVisible()
  await expect(page.getByText('Version 1.1.0')).toBeVisible()
  await expect(page.getByText('Improved offline update reliability.')).toBeVisible()

  await page.getByRole('button', { name: 'Update' }).click()

  await expect.poll(async () => {
    const state = await getUpdateTestState(page)
    return state?.workerMessages?.length ?? 0
  }).toBe(1)

  await dispatchUpdateControllerChange(page)

  await expect.poll(async () => {
    const state = await getUpdateTestState(page)
    return state?.reloadRequestCount ?? 0
  }).toBe(1)
})

test('backup-required update stays blocked until backup completes', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ withTransactions: true }))

  await page.goto('/')
  await waitForAppReady(page)
  await resetUpdateTestHooks(page)

  await simulateUpdateAvailable(page, {
    availableVersionInfo: {
      version: '2.0.0',
      changelog: ['Migration requires backup first.'],
      severity: 'backup-required',
    },
    withMockWaitingWorker: true,
  })

  await page.getByRole('button', { name: 'Update' }).click()

  await expect(page.getByText('Backup required before updating.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update' })).toBeDisabled()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Create backup' }).click()
  await downloadPromise

  await expect(page.getByRole('button', { name: 'Update' })).toBeEnabled()
  await page.getByRole('button', { name: 'Update' }).click()

  await expect.poll(async () => {
    const state = await getUpdateTestState(page)
    return state?.workerMessages?.length ?? 0
  }).toBe(1)
})

test('Later dismisses the update prompt and the app remains usable', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ withTransactions: false }))

  await page.goto('/')
  await waitForAppReady(page)
  await resetUpdateTestHooks(page)

  await simulateUpdateAvailable(page, {
    availableVersionInfo: {
      version: '1.1.0',
      changelog: ['Dismiss me later.'],
      severity: 'minor',
    },
  })

  await page.getByRole('button', { name: 'Later' }).click()

  await expect(page.getByRole('dialog', { name: 'Update available' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('dialog', { name: 'Add transaction' })).toBeVisible()
})

test('recommended-backup updates warn first but can proceed without backup', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ withTransactions: false }))

  await page.goto('/')
  await waitForAppReady(page)
  await resetUpdateTestHooks(page)

  await simulateUpdateAvailable(page, {
    availableVersionInfo: {
      version: '1.4.0',
      changelog: ['Backup is recommended for this release.'],
      severity: 'recommended-backup',
    },
    withMockWaitingWorker: true,
  })

  await page.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByText('We recommend backing up your data before updating.')).toBeVisible()

  await page.getByRole('button', { name: 'Update anyway' }).click()

  await expect.poll(async () => {
    const state = await getUpdateTestState(page)
    return state?.workerMessages?.length ?? 0
  }).toBe(1)
})