import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { FinanceContext } from './finance-store'
import { useFinance } from './use-finance'
import { initialFinanceState } from '../domain/default-data'
import { createFinanceContextValue } from '../test/finance-test-utils'

describe('useFinance', () => {
  it('throws when used outside FinanceProvider', () => {
    expect(() => renderHook(() => useFinance())).toThrow(
      'useFinance must be used inside FinanceProvider.',
    )
  })

  it('returns context value when provider is present', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <FinanceContext.Provider
        value={createFinanceContextValue({
          state: initialFinanceState,
          isLoaded: true,
        })}
      >
        {children}
      </FinanceContext.Provider>
    )

    const { result } = renderHook(() => useFinance(), { wrapper })

    expect(result.current.state).toBe(initialFinanceState)
    expect(result.current.isLoaded).toBe(true)
  })
})