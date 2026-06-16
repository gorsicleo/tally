import { describe, expect, it } from 'vitest'
import {
  getFinancialGoalProgress,
  getFinancialGoalProgressRatio,
  getFinancialGoalRemainingAmount,
  sortFinancialGoalsByPriorityAndUpdatedAt,
  validateFinancialGoalInput,
} from './financial-goals'
import type { FinancialGoal } from './models'

describe('financial goals calculations', () => {
  it('calculates progress and caps display ratio at 100 percent', () => {
    expect(getFinancialGoalProgress(2500, 10000)).toBe(0.25)
    expect(getFinancialGoalProgressRatio(12000, 10000)).toBe(1)
  })

  it('calculates remaining amount and floors at zero', () => {
    expect(getFinancialGoalRemainingAmount(2500, 10000)).toBe(7500)
    expect(getFinancialGoalRemainingAmount(15000, 10000)).toBe(0)
  })
})

describe('financial goals validation', () => {
  it('rejects invalid fields and accepts valid input', () => {
    expect(
      validateFinancialGoalInput({
        name: '  ',
        description: '',
        type: 'custom',
        targetAmount: 100,
        currentAmount: 0,
        targetDate: null,
        priority: 'medium',
      }),
    ).toBe('Goal name is required.')

    expect(
      validateFinancialGoalInput(
        {
          name: 'House',
          description: '',
          type: 'house',
          targetAmount: 500000,
          currentAmount: 5000,
          targetDate: '2026-06-14',
          priority: 'high',
        },
        '2026-06-15',
      ),
    ).toBe('Target date cannot be in the past.')

    expect(
      validateFinancialGoalInput(
        {
          name: 'House',
          description: '',
          type: 'house',
          targetAmount: 500000,
          currentAmount: 5000,
          targetDate: '2026-06-15',
          priority: 'high',
        },
        '2026-06-15',
      ),
    ).toBeNull()
  })
})

describe('financial goals sorting', () => {
  it('orders goals by priority and updatedAt desc', () => {
    const goals: FinancialGoal[] = [
      {
        id: 'goal-low',
        name: 'Vacation',
        description: '',
        type: 'vacation',
        targetAmount: 3000,
        currentAmount: 500,
        targetDate: null,
        priority: 'low',
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-14T10:00:00.000Z',
      },
      {
        id: 'goal-high',
        name: 'House',
        description: '',
        type: 'house',
        targetAmount: 500000,
        currentAmount: 15000,
        targetDate: null,
        priority: 'high',
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-13T10:00:00.000Z',
      },
      {
        id: 'goal-medium-new',
        name: 'Emergency',
        description: '',
        type: 'emergencyFund',
        targetAmount: 10000,
        currentAmount: 4500,
        targetDate: null,
        priority: 'medium',
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-15T10:00:00.000Z',
      },
    ]

    expect(sortFinancialGoalsByPriorityAndUpdatedAt(goals).map((goal) => goal.id)).toEqual([
      'goal-high',
      'goal-medium-new',
      'goal-low',
    ])
  })
})
