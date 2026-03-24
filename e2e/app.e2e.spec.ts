import { expect, test } from '@playwright/test'
import { createSeedState } from './test-data'
import { freezeTime, seedAppState, waitForAppReady } from './test-helpers'

test('adds a transaction from the sheet and shows it in records', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ withTransactions: false }))

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Add' }).click()

  const dialog = page.getByRole('dialog', { name: 'Add transaction' })
  await dialog.getByLabel('Amount').fill('19.99')
  await dialog.getByRole('button', { name: '+ Add note' }).click()
  await dialog.getByRole('textbox', { name: 'Note (optional)' }).fill('E2E lunch')
  await dialog.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByText('Saved')).toBeVisible()

  await page.getByRole('button', { name: 'Records', exact: true }).click()
  await expect(page.getByText('E2E lunch')).toBeVisible()
})

test('deletes a category from settings after confirmation', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Manage categories' }).click()

  await page.getByRole('button', { name: /Food/i }).click()
  await expect(page.getByRole('dialog', { name: 'Update category' })).toBeVisible()

  page.once('dialog', (dialog) => {
    void dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete category' }).click()

  const categoryList = page.locator('.settings-category-list-panel')
  await expect(categoryList.getByText('Food')).toHaveCount(0)
})

test('creates a budget from the budgets screen', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Budgets', exact: true }).click()
  await page.getByRole('button', { name: '+ Add budget' }).click()

  const dialog = page.getByRole('dialog', { name: 'Create budget' })
  await dialog.getByRole('textbox', { name: 'Budget name' }).fill('Groceries')
  await dialog.getByRole('checkbox', { name: /Food/i }).check()
  await dialog.getByRole('button', { name: '$100.00' }).click()
  await dialog.getByRole('button', { name: 'Save budget' }).click()

  await expect(page.getByText('Groceries')).toBeVisible()
})

test('switches insights into charts view', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await page.getByRole('button', { name: 'Charts' }).click()

  await expect(page.getByRole('img', { name: 'Monthly spending trend chart' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Top spending categories donut chart' })).toBeVisible()
})
