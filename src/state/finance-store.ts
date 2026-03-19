import { createContext } from 'react'
import type {
  BackupPreferences,
  CategoryKind,
  FinanceState,
  ThemeMode,
  TransactionType,
} from '../domain/models'

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
}

export interface UpdateTransactionInput extends AddTransactionInput {
  id: string
}

export interface SetBudgetInput {
  categoryId: string
  monthKey: string
  limit: number
}

export interface FinanceContextValue {
  state: FinanceState
  isLoaded: boolean
  isOnline: boolean
  isSyncing: boolean
  addCategory: (input: AddCategoryInput) => void
  updateCategory: (input: UpdateCategoryInput) => void
  deleteCategory: (categoryId: string) => void
  addTransaction: (input: AddTransactionInput) => void
  updateTransaction: (input: UpdateTransactionInput) => void
  deleteTransaction: (transactionId: string) => void
  setBudget: (input: SetBudgetInput) => void
  setTheme: (theme: ThemeMode) => void
  setCurrency: (currency: string) => void
  setSyncEndpoint: (endpoint: string) => void
  updateBackupSettings: (settings: Partial<BackupPreferences>) => void
  replaceState: (nextState: FinanceState) => Promise<void>
  syncNow: () => Promise<boolean>
}

export const FinanceContext = createContext<FinanceContextValue | undefined>(
  undefined,
)
