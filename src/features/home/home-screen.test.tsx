import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeScreen } from './home-screen'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'

describe('HomeScreen financial goals card', () => {
  it('shows max three active goals and deep-links to budgets goals', async () => {
    const onNavigate = vi.fn()
    const state = {
      ...initialFinanceState,
      financialGoals: [
        {
          id: 'goal-high',
          name: 'House',
          description: '',
          type: 'house' as const,
          targetAmount: 100000,
          currentAmount: 25000,
          targetDate: null,
          priority: 'high' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-15T10:00:00.000Z',
        },
        {
          id: 'goal-medium',
          name: 'Emergency Fund',
          description: '',
          type: 'emergencyFund' as const,
          targetAmount: 10000,
          currentAmount: 2000,
          targetDate: null,
          priority: 'medium' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-14T10:00:00.000Z',
        },
        {
          id: 'goal-low',
          name: 'Vacation',
          description: '',
          type: 'vacation' as const,
          targetAmount: 5000,
          currentAmount: 500,
          targetDate: null,
          priority: 'low' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-13T10:00:00.000Z',
        },
        {
          id: 'goal-extra',
          name: 'Car',
          description: '',
          type: 'car' as const,
          targetAmount: 20000,
          currentAmount: 1000,
          targetDate: null,
          priority: 'low' as const,
          status: 'active' as const,
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-12T10:00:00.000Z',
        },
      ],
    }

    const { user } = renderWithFinance(
      <HomeScreen
        onNavigate={onNavigate}
        onEditTransaction={() => {}}
        onEditRecurring={() => {}}
        onShowToast={() => {}}
      />,
      createFinanceContextValue({ state }),
    )

    expect(screen.getAllByText('House').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Emergency Fund').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vacation').length).toBeGreaterThan(0)
    expect(screen.queryByText('Car')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View all' }))

    expect(onNavigate).toHaveBeenCalledWith('budgets', { budgetsView: 'goals' })
  })

  it('shows create goal action when no active goals exist', async () => {
    const onNavigate = vi.fn()

    const { user } = renderWithFinance(
      <HomeScreen
        onNavigate={onNavigate}
        onEditTransaction={() => {}}
        onEditRecurring={() => {}}
        onShowToast={() => {}}
      />,
      createFinanceContextValue({
        state: {
          ...initialFinanceState,
          financialGoals: [],
        },
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Create goal' }))

    expect(onNavigate).toHaveBeenCalledWith('budgets', {
      budgetsView: 'goals',
      openCreateGoal: true,
    })
  })
})
