import { createContext } from 'react'
import type {
  BackupPreferences,
  CategoryKind,
  FinanceState,
  RecurringFrequency,
  ThemeMode,
  TransactionType,
} from '../domain/models'
import type {
  CategoryDeletionPlanInput,
  CategoryDeletionPlanResult,
} from '../domain/category-service'

export interface AddCategoryInput {
  name: string
  color: string
  kind: CategoryKind
}

export interface UpdateCategoryInput extends AddCategoryInput {
  id: string
}

export interface AddTransactionInput {
  type: TransactionType
  amount: number
  categoryId: string
  note: string
  occurredAt: string
  recurringTemplateId?: string | null
  recurringOccurrenceDate?: string | null
}

export interface UpdateTransactionInput extends AddTransactionInput {
  id: string
}

export interface UpsertBudgetInput {
  id?: string
  name: string
  categoryIds: string[]
  monthKey: string
  limit: number
}

export interface TransactionRecurrenceInput {
  frequency: RecurringFrequency
  intervalDays: number | null
  startDate: string
}

export interface AddRecurringTemplateInput {
  type: TransactionType
  amount: number
  categoryId: string
  note: string
  frequency: RecurringFrequency
  intervalDays: number | null
  startDate: string
  nextDueDate: string
}

export interface UpdateRecurringTemplateInput extends AddRecurringTemplateInput {
  id: string
}

export interface ApplyRecurringOccurrencesInput {
  templateId: string
  occurrenceDates: string[]
}

export interface FinanceContextValue {
  state: FinanceState
  isLoaded: boolean
  addCategory: (input: AddCategoryInput) => void
  updateCategory: (input: UpdateCategoryInput) => void
  previewCategoryDeletion: (
    input: CategoryDeletionPlanInput,
  ) => CategoryDeletionPlanResult
  deleteCategory: (input: CategoryDeletionPlanInput) => string | null
  addTransaction: (input: AddTransactionInput) => void
  updateTransaction: (input: UpdateTransactionInput) => void
  deleteTransaction: (transactionId: string) => void
  addRecurringTemplate: (input: AddRecurringTemplateInput) => string | null
  updateRecurringTemplate: (input: UpdateRecurringTemplateInput) => void
  stopRecurringTemplate: (templateId: string) => void
  addRecurringOccurrences: (input: ApplyRecurringOccurrencesInput) => void
  skipRecurringOccurrences: (input: ApplyRecurringOccurrencesInput) => void
  upsertBudget: (input: UpsertBudgetInput) => string | null
  removeBudget: (budgetId: string) => void
  setTheme: (theme: ThemeMode) => void
  setCurrency: (currency: string) => void
  updateBackupSettings: (settings: Partial<BackupPreferences>) => void
  replaceState: (nextState: FinanceState) => Promise<void>
}

export const FinanceContext = createContext<FinanceContextValue | undefined>(
  undefined,
)
