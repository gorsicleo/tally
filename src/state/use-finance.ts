import { useContext } from 'react'
import { FinanceContext, type FinanceContextValue } from './finance-store'

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext)

  if (!context) {
    throw new Error('useFinance must be used inside FinanceProvider.')
  }

  return context
}
