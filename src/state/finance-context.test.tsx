import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialFinanceState } from '../domain/default-data'
import type { FinanceState } from '../domain/models'
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
    syncQueue: [],
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
      <div data-testid="online">{String(finance.isOnline)}</div>
      <div data-testid="currency">{finance.state.settings.currency}</div>
      <div data-testid="categories">{finance.state.categories.length}</div>
      <div data-testid="queue">{finance.state.syncQueue.length}</div>
      <div data-testid="last-sync-attempt">{finance.state.lastSyncAttemptAt ?? 'none'}</div>
      <div data-testid="last-synced">{finance.state.lastSyncedAt ?? 'none'}</div>

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

  it('hydrates stored state, applies auto theme, and reacts to connectivity changes', async () => {
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

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('online')).toHaveTextContent('false')
    })

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('online')).toHaveTextContent('true')
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
          syncStatus: 'synced',
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

  it('auto-syncs queued operations after local mutations', async () => {
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
      expect(screen.getByTestId('queue')).toHaveTextContent('0')
      expect(screen.getByTestId('last-sync-attempt')).not.toHaveTextContent('none')
      expect(screen.getByTestId('last-synced')).not.toHaveTextContent('none')
    })
  })
})