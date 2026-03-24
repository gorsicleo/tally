import type {
  Category,
  CategoryKind,
  RecurringTemplate,
  Transaction,
} from '../../domain/models'

export function isCategoryCompatible(
  category: Category,
  entry: Pick<Transaction, 'type'>,
): boolean {
  return category.kind === 'both' || category.kind === entry.type
}

export function categoryKindSupportsTransactions(
  kind: CategoryKind,
  transactions: Transaction[],
): boolean {
  return transactions.every(
    (transaction) => kind === 'both' || transaction.type === kind,
  )
}

export function categoryKindSupportsRecurringTemplates(
  kind: CategoryKind,
  recurringTemplates: RecurringTemplate[],
): boolean {
  return recurringTemplates.every(
    (template) => kind === 'both' || template.type === kind,
  )
}
