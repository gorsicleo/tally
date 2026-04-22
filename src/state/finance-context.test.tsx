import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialFinanceState } from '../domain/default-data'
import type { FinanceState } from '../domain/models'
import { createAppLockPinVerifier } from '../features/privacy/app-lock'
import { createRecoveryCodeSet } from '../features/privacy/recovery-codes'
import { FinanceProvider } from './finance-context'
import { useFinance } from './use-finance'

const storageMocks = vi.hoisted(() => ({
  loadFinanceState: vi.fn(),
  saveFinanceState: vi.fn(),
}))

vi.mock('../persistence/finance-storage', () => ({
  loadFinanceState: storageMocks.loadFinanceState,
  saveFinanceState: storageMocks.saveFinanceState,
}))

function createState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions: [],
    budgets: [],
    recurringTemplates: [],
    settings: {
      ...initialFinanceState.settings,
      hasSeenPrivacyModal: true,
    },
    ...overrides,
  }
}

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQueryList = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as (event: MediaQueryListEvent) => void)
    }),
    removeEventListener: vi.fn(
      (_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener as (event: MediaQueryListEvent) => void)
      },
    ),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    dispatchEvent: vi.fn(() => true),
    dispatch(nextMatches: boolean) {
      mediaQueryList.matches = nextMatches
      const event = { matches: nextMatches } as MediaQueryListEvent

      listeners.forEach((listener) => {
        listener(event)
      })
    },
  } satisfies Partial<MediaQueryList> & { dispatch: (nextMatches: boolean) => void }

  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList as MediaQueryList))

  return mediaQueryList
}

function FinanceProbe({ replacementState }: { replacementState: FinanceState }) {
  const finance = useFinance()

  return (
    <>
      <div data-testid="loaded">{String(finance.isLoaded)}</div>
      <div data-testid="currency">{finance.state.settings.currency}</div>
      <div data-testid="categories">{finance.state.categories.length}</div>

      <button type="button" onClick={() => finance.setTheme('auto')}>
        Set auto theme
      </button>
      <button type="button" onClick={() => finance.setCurrency('eur')}>
        Set EUR
      </button>
      <button
        type="button"
        onClick={() =>
          finance.addCategory({
            name: 'Health',
            color: '#0f766e',
            kind: 'expense',
          })
        }
      >
        Add category
      </button>
      <button
        type="button"
        onClick={() => {
          void finance.replaceState(replacementState)
        }}
      >
        Replace state
      </button>
    </>
  )
}

function RecoveryUnlockProbe() {
  const finance = useFinance()
  const [message, setMessage] = useState('')

  return (
    <>
      <div data-testid="loaded">{String(finance.isLoaded)}</div>
      <div data-testid="unlock-message">{message}</div>
      <div data-testid="cooldown-status">
        {finance.appLockCooldownUntil === null ? 'none' : 'set'}
      </div>

      <button
        type="button"
        onClick={() => {
          void finance.unlockAppWithRecoveryCode('bad').then((result) => {
            setMessage(result ?? 'ok')
          })
        }}
      >
        Attempt bad recovery code
      </button>
    </>
  )
}

describe('FinanceProvider integration', () => {
  beforeEach(() => {
    storageMocks.loadFinanceState.mockResolvedValue(null)
    storageMocks.saveFinanceState.mockResolvedValue(undefined)
    document.documentElement.dataset.theme = ''
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('hydrates stored state and applies auto theme', async () => {
    const storedState = createState({
      settings: {
        ...initialFinanceState.settings,
        hasSeenPrivacyModal: true,
        currency: 'CZK',
        theme: 'auto',
      },
    })
    const mediaQueryList = installMatchMedia(true)
    storageMocks.loadFinanceState.mockResolvedValue(storedState)

    render(
      <FinanceProvider>
        <FinanceProbe replacementState={storedState} />
      </FinanceProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
      expect(screen.getByTestId('currency')).toHaveTextContent('CZK')
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    act(() => {
      mediaQueryList.dispatch(false)
    })

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light')
      expect(document.documentElement.style.colorScheme).toBe('light')
    })

  })

  it('persists state updates and replaceState writes the replacement snapshot', async () => {
    const replacementState = createState({
      settings: {
        ...initialFinanceState.settings,
        hasSeenPrivacyModal: true,
        currency: 'GBP',
      },
      transactions: [
        {
          id: 'txn-restored',
          type: 'expense',
          amount: 18,
          categoryId: 'cat-food',
          note: 'Restored lunch',
          occurredAt: '2026-03-22',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-22T08:00:00.000Z',
          updatedAt: '2026-03-22T08:00:00.000Z',
        },
      ],
    })
    const user = userEvent.setup()

    render(
      <FinanceProvider>
        <FinanceProbe replacementState={replacementState} />
      </FinanceProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
    })

    storageMocks.saveFinanceState.mockClear()

    await user.click(screen.getByRole('button', { name: 'Set EUR' }))

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('EUR')
      expect(storageMocks.saveFinanceState).toHaveBeenCalled()
    })

    expect(storageMocks.saveFinanceState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ currency: 'EUR' }),
      }),
    )

    storageMocks.saveFinanceState.mockClear()

    await user.click(screen.getByRole('button', { name: 'Replace state' }))

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent('GBP')
      expect(storageMocks.saveFinanceState).toHaveBeenCalledWith(replacementState)
    })
  })

  it('applies local mutations and persists changes', async () => {
    const user = userEvent.setup()
    const replacementState = createState()

    render(
      <FinanceProvider>
        <FinanceProbe replacementState={replacementState} />
      </FinanceProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'Add category' }))

    await waitFor(() => {
      expect(screen.getByTestId('categories')).toHaveTextContent(
        String(initialFinanceState.categories.length + 1),
      )
      expect(storageMocks.saveFinanceState).toHaveBeenCalled()
    })
  })

  it('applies cooldown after repeated failed recovery code attempts', async () => {
    const pinVerifier = await createAppLockPinVerifier('1234')
    const recovery = await createRecoveryCodeSet()
    const lockedState = createState({
      settings: {
        ...initialFinanceState.settings,
        hasSeenPrivacyModal: true,
        lockAppOnLaunch: true,
        appLockPinVerifier: pinVerifier,
        recoveryCodeSet: recovery.codeSet,
      },
    })
    storageMocks.loadFinanceState.mockResolvedValue(lockedState)
    const user = userEvent.setup()

    render(
      <FinanceProvider>
        <RecoveryUnlockProbe />
      </FinanceProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'Attempt bad recovery code' }))
    await waitFor(() => {
      expect(screen.getByTestId('unlock-message')).toHaveTextContent('Recovery code is invalid.')
      expect(screen.getByTestId('cooldown-status')).toHaveTextContent('none')
    })

    await user.click(screen.getByRole('button', { name: 'Attempt bad recovery code' }))
    await waitFor(() => {
      expect(screen.getByTestId('unlock-message')).toHaveTextContent('Recovery code is invalid.')
      expect(screen.getByTestId('cooldown-status')).toHaveTextContent('none')
    })

    await user.click(screen.getByRole('button', { name: 'Attempt bad recovery code' }))
    await waitFor(() => {
      expect(screen.getByTestId('unlock-message')).toHaveTextContent(
        'Too many incorrect attempts. Try again in a moment.',
      )
      expect(screen.getByTestId('cooldown-status')).toHaveTextContent('set')
    })

    await user.click(screen.getByRole('button', { name: 'Attempt bad recovery code' }))
    await waitFor(() => {
      expect(screen.getByTestId('unlock-message')).toHaveTextContent(
        'Too many incorrect attempts. Try again in a moment.',
      )
    })
  })
})