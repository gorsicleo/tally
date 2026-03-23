import type { CategoryDeletionPlan } from '../domain/category-service'
import type {
  AppSettings,
  Budget,
  Category,
  FinanceState,
  RecurringTemplate,
  Transaction,
} from '../domain/models'

export type FinanceAction =
  | { type: 'hydrate'; payload: FinanceState }
  | { type: 'replace-state'; payload: FinanceState }
  | { type: 'add-category'; payload: Category }
  | { type: 'update-category'; payload: Category }
  | {
      type: 'delete-category'
      payload: { plan: CategoryDeletionPlan; updatedAt: string }
    }
  | { type: 'add-transaction'; payload: Transaction }
  | { type: 'update-transaction'; payload: Transaction }
  | { type: 'delete-transaction'; payload: { id: string } }
  | { type: 'add-recurring-template'; payload: RecurringTemplate }
  | { type: 'update-recurring-template'; payload: RecurringTemplate }
  | { type: 'stop-recurring-template'; payload: { id: string; updatedAt: string } }
  | {
      type: 'add-recurring-occurrences'
      payload: {
        templateId: string
        transactions: Transaction[]
        nextDueDate: string
        updatedAt: string
      }
    }
  | {
      type: 'skip-recurring-occurrences'
      payload: {
        templateId: string
        nextDueDate: string
        updatedAt: string
      }
    }
  | { type: 'set-budget'; payload: Budget }
  | { type: 'remove-budget'; payload: { id: string } }
  | { type: 'update-settings'; payload: Partial<AppSettings> }
  | { type: 'sync-attempt'; payload: { at: string } }
  | { type: 'sync-success'; payload: { at: string; operationIds: string[] } }
  | {
      type: 'sync-failure'
      payload: { at: string; operationIds: string[]; error: string }
    }
