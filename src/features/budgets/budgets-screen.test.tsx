import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BudgetsScreen } from './budgets-screen'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'

describe('BudgetsScreen goals view', () => {
  it('shows budgets by default and goals view filters archived goals with ordering', async () => {
    const state = {
      ...initialFinanceState,
      financialGoals: [
        {
          id: 'goal-low',
          name: 'Vacation',
          description: '',
          type: 'vacation' as const,
          targetAmount: 5000,
          currentAmount: 1000,
          targetDate: null,
          priority: 'low' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-14T10:00:00.000Z',
        },
        {
          id: 'goal-high',
          name: 'House',
          description: '',
          type: 'house' as const,
          targetAmount: 150000,
          currentAmount: 10000,
          targetDate: null,
          priority: 'high' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-13T10:00:00.000Z',
        },
        {
          id: 'goal-medium-newer',
          name: 'Emergency Fund',
          description: '',
          type: 'emergencyFund' as const,
          targetAmount: 10000,
          currentAmount: 2500,
          targetDate: null,
          priority: 'medium' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-15T10:00:00.000Z',
        },
        {
          id: 'goal-archived',
          name: 'Archived goal',
          description: '',
          type: 'custom' as const,
          targetAmount: 1000,
          currentAmount: 1000,
          targetDate: null,
          priority: 'high' as const,
          status: 'archived' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-16T10:00:00.000Z',
        },
      ],
    }

    const { user } = renderWithFinance(
      <BudgetsScreen />,
      createFinanceContextValue({
        state,
      }),
    )

    expect(screen.getByText('Available to budget')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Goals' }))

    expect(screen.queryByText('Archived goal')).not.toBeInTheDocument()

    const content = document.body.textContent ?? ''
    expect(content.indexOf('House')).toBeLessThan(content.indexOf('Emergency Fund'))
    expect(content.indexOf('Emergency Fund')).toBeLessThan(content.indexOf('Vacation'))
  })

  it('opens create goal sheet when requested from home deep-link', async () => {
    const onOpenCreateGoalHandled = vi.fn()

    renderWithFinance(
      <BudgetsScreen
        initialView="goals"
        openCreateGoalRequest
        onOpenCreateGoalHandled={onOpenCreateGoalHandled}
      />,
      createFinanceContextValue(),
    )

    expect(await screen.findByRole('dialog', { name: 'Create goal' })).toBeInTheDocument()
    expect(onOpenCreateGoalHandled).toHaveBeenCalledTimes(1)
  })
})
