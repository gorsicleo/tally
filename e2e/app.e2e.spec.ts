import { expect, test, type Page } from '@playwright/test'
import { createSeedState } from './test-data'
import { freezeTime, seedAppState, waitForAppReady } from './test-helpers'

async function stubClipboard(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __tallyCopiedText?: string }).__tallyCopiedText = ''

    const clipboard = {
      writeText: async (value: string) => {
        ;(window as unknown as { __tallyCopiedText?: string }).__tallyCopiedText = value
      },
    }

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    })
  })
}

async function stubExternalNavigation(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __tallyOpenedUrls?: string[] }).__tallyOpenedUrls = []

    const openStub: Window['open'] = ((url?: string | URL) => {
      const store = window as unknown as { __tallyOpenedUrls?: string[] }
      store.__tallyOpenedUrls?.push(String(url ?? ''))

      return {
        closed: false,
        close: () => {
          // No-op for test stub.
        },
      } as unknown as Window
    }) as Window['open']

    window.open = openStub
  })
}

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

test('shows report a bug entry and opens report bug dialog from settings', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Report a bug' })).toBeVisible()

  await page.getByRole('button', { name: 'Report a bug' }).click()

  const dialog = page.getByRole('dialog', { name: 'Report a bug' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/Bug reports are filed on GitHub/i)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Copy app info' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Open GitHub issue' })).toBeVisible()
})

test('copies app info from report bug dialog and shows feedback', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))
  await stubClipboard(page)

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Report a bug' }).click()

  const dialog = page.getByRole('dialog', { name: 'Report a bug' })
  await dialog.getByRole('button', { name: 'Copy app info' }).click()

  await expect(page.getByText('App info copied.')).toBeVisible()

  const copiedText = await page.evaluate(() => {
    return (window as unknown as { __tallyCopiedText?: string }).__tallyCopiedText ?? ''
  })
  expect(copiedText).toContain('App: Tally')
  expect(copiedText).toContain('Installed PWA:')
})

test('opens github issue with correct URL intent from report bug dialog', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))
  await stubExternalNavigation(page)

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Report a bug' }).click()

  const dialog = page.getByRole('dialog', { name: 'Report a bug' })
  await dialog.getByRole('button', { name: 'Open GitHub issue' }).click()

  const openedUrls = await page.evaluate(() => {
    return (window as unknown as { __tallyOpenedUrls?: string[] }).__tallyOpenedUrls ?? []
  })
  expect(openedUrls).toContain('https://github.com/gorsicleo/tally/issues/new/choose')
})

test('keeps report bug flow usable on mobile viewport', async ({ page }) => {
  await freezeTime(page)
  await seedAppState(page, createSeedState({ includeFoodTransaction: true }))
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/')
  await waitForAppReady(page)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Report a bug' }).click()

  const dialog = page.getByRole('dialog', { name: 'Report a bug' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Open GitHub issue' })).toBeVisible()
})
