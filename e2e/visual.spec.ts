import { expect, test } from '@playwright/test'
import { createSeedState } from './test-data'
import {
  disableAnimations,
  freezeTime,
  seedAppState,
  waitForAppReady,
} from './test-helpers'

test.beforeEach(async ({ page }) => {
  await freezeTime(page)
  await seedAppState(
    page,
    createSeedState({ includeFoodTransaction: true, withRecurringDue: true }),
  )
  await page.goto('/')
  await waitForAppReady(page)
  await disableAnimations(page)
})

test('home screen desktop @visual', async ({ page }) => {
  await expect(page).toHaveScreenshot('home-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('records screen desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Records', exact: true }).click()
  await expect(page).toHaveScreenshot('records-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('insights screen desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(page).toHaveScreenshot('insights-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('budgets screen desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Budgets', exact: true }).click()
  await expect(page).toHaveScreenshot('budgets-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('settings main desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveScreenshot('settings-main-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('add transaction modal desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page).toHaveScreenshot('transaction-modal-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('category management and delete dialog desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Manage categories' }).click()
  await page.getByRole('button', { name: /Food/i }).click()

  await expect(page).toHaveScreenshot('settings-categories-delete-dialog-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('recurring review desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Review' }).click()
  await expect(page).toHaveScreenshot('recurring-review-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('home screen mobile layout @visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await waitForAppReady(page)
  await disableAnimations(page)

  await expect(page).toHaveScreenshot('home-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('dark mode home screen desktop @visual', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByRole('button', { name: 'Home', exact: true }).click()

  await expect(page).toHaveScreenshot('home-dark-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
