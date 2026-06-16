import {
  compareLocalDateKeys,
  getTodayLocalDate,
} from '../utils/date'
import type {
  FinancialGoal,
  FinancialGoalPriority,
  FinancialGoalType,
} from './models'

export interface FinancialGoalInput {
  name: string
  description?: string | null
  type: FinancialGoalType
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  priority: FinancialGoalPriority
}

const priorityOrder: Record<FinancialGoalPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export const financialGoalTypeLabels: Record<FinancialGoalType, string> = {
  house: 'House',
  car: 'Car',
  emergencyFund: 'Emergency Fund',
  vacation: 'Vacation',
  education: 'Education',
  custom: 'Custom',
}

export const financialGoalPriorityLabels: Record<FinancialGoalPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function isFinancialGoalType(value: unknown): value is FinancialGoalType {
  return value === 'house' ||
    value === 'car' ||
    value === 'emergencyFund' ||
    value === 'vacation' ||
    value === 'education' ||
    value === 'custom'
}

export function isFinancialGoalPriority(value: unknown): value is FinancialGoalPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

export function getFinancialGoalProgress(
  currentAmount: number,
  targetAmount: number,
): number {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return 0
  }

  return currentAmount / targetAmount
}

export function getFinancialGoalProgressRatio(
  currentAmount: number,
  targetAmount: number,
): number {
  return Math.max(0, Math.min(getFinancialGoalProgress(currentAmount, targetAmount), 1))
}

export function getFinancialGoalRemainingAmount(
  currentAmount: number,
  targetAmount: number,
): number {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(targetAmount)) {
    return 0
  }

  return Math.max(targetAmount - currentAmount, 0)
}

export function sortFinancialGoalsByPriorityAndUpdatedAt(
  goals: FinancialGoal[],
): FinancialGoal[] {
  return [...goals].sort((left, right) => {
    const priorityDifference = priorityOrder[left.priority] - priorityOrder[right.priority]

    if (priorityDifference !== 0) {
      return priorityDifference
    }

    const updatedDifference = right.updatedAt.localeCompare(left.updatedAt)

    if (updatedDifference !== 0) {
      return updatedDifference
    }

    return left.name.localeCompare(right.name)
  })
}

export function validateFinancialGoalInput(
  input: FinancialGoalInput,
  todayLocalDate = getTodayLocalDate(),
): string | null {
  const trimmedName = input.name.trim()

  if (!trimmedName) {
    return 'Goal name is required.'
  }

  if (!isFinancialGoalType(input.type)) {
    return 'Goal type is required.'
  }

  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    return 'Target amount must be greater than zero.'
  }

  if (!Number.isFinite(input.currentAmount) || input.currentAmount < 0) {
    return 'Current amount cannot be negative.'
  }

  if (!isFinancialGoalPriority(input.priority)) {
    return 'Priority is required.'
  }

  if (input.targetDate) {
    if (compareLocalDateKeys(input.targetDate, todayLocalDate) < 0) {
      return 'Target date cannot be in the past.'
    }
  }

  return null
}