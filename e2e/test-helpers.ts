import type { Page } from '@playwright/test'
import { createSeedState, STORAGE_KEY } from './test-data'

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
