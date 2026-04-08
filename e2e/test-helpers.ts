import type { Page } from '@playwright/test'
import { createSeedState, STORAGE_KEY } from './test-data'

interface SimulatedUpdateInput {
  availableVersionInfo?: {
    version?: string
    changelog?: string[]
    severity?: 'minor' | 'recommended-backup' | 'backup-required'
  } | null
  updateAvailable?: boolean
  needsReload?: boolean
  isApplyingUpdate?: boolean
  withMockWaitingWorker?: boolean
}

export async function freezeTime(page: Page, timestamp = '2026-03-20T12:00:00.000Z') {
  const fixedTime = new Date(timestamp).valueOf()

  await page.addInitScript(({ time }) => {
    const NativeDate = Date

    class MockDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(time)
          return
        }

        super(...args)
      }

      static now() {
        return time
      }

      static parse(value: string) {
        return NativeDate.parse(value)
      }

      static UTC(...args: Parameters<typeof NativeDate.UTC>) {
        return NativeDate.UTC(...args)
      }
    }

    Object.setPrototypeOf(MockDate, NativeDate)
    ;(window as unknown as { Date: DateConstructor }).Date = MockDate as unknown as DateConstructor
  }, { time: fixedTime })
}

export async function seedAppState(
  page: Page,
  seed = createSeedState(),
) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: STORAGE_KEY, value: seed },
  )
}

export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
    `,
  })
}

export async function waitForAppReady(page: Page) {
  await page.getByRole('button', { name: 'Add', exact: true }).waitFor({ state: 'visible' })
}

export async function resetUpdateTestHooks(page: Page) {
  await page.waitForFunction(() => Boolean(window.__tallyUpdateTestHooks))
  await page.evaluate(() => {
    window.__tallyUpdateTestHooks?.setReloadSuppressed(true)
    window.localStorage.removeItem('tally:update-dismissed')
    window.__tallyUpdateTestHooks?.simulateUpdate({
      availableVersionInfo: null,
      updateAvailable: false,
      needsReload: false,
      isApplyingUpdate: false,
    })
  })
}

export async function simulateUpdateAvailable(
  page: Page,
  input: SimulatedUpdateInput,
) {
  await page.waitForFunction(() => Boolean(window.__tallyUpdateTestHooks))
  await page.evaluate((nextUpdate) => {
    window.__tallyUpdateTestHooks?.simulateUpdate(nextUpdate)
  }, input)
}

export async function dispatchUpdateControllerChange(page: Page) {
  await page.evaluate(() => {
    window.__tallyUpdateTestHooks?.dispatchControllerChange()
  })
}

export async function getUpdateTestState(page: Page) {
  return page.evaluate(() => {
    return window.__tallyUpdateTestHooks?.getState() ?? null
  })
}
