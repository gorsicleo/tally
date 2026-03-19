import type { FinanceState } from '../domain/models'
import { parsePersistedFinanceState } from '../domain/validation'
import { readIndexedDbValue, writeIndexedDbValue } from './indexeddb'

const STORAGE_KEY = 'tally.finance.v2'

export async function loadFinanceState(): Promise<FinanceState | null> {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    if ('indexedDB' in window) {
      const storedState = await readIndexedDbValue<unknown>(STORAGE_KEY)
      const parsedState = parsePersistedFinanceState(storedState)

      if (parsedState) {
        return parsedState
      }
    }
  } catch {
    // Fall through to localStorage fallback.
  }

  try {
    const fallbackState = window.localStorage.getItem(STORAGE_KEY)

    if (!fallbackState) {
      return null
    }

    const parsedState: unknown = JSON.parse(fallbackState)

    return parsePersistedFinanceState(parsedState)
  } catch {
    return null
  }
}

export async function saveFinanceState(state: FinanceState): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  let hasSavedState = false

  try {
    if ('indexedDB' in window) {
      await writeIndexedDbValue(STORAGE_KEY, state)
      hasSavedState = true
    }
  } catch {
    // Continue into fallback persistence.
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    hasSavedState = true
  } catch {
    // Ignore fallback write failures caused by quota limits.
  }

  if (!hasSavedState) {
    throw new Error('Unable to save local data on this device.')
  }
}
