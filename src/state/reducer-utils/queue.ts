import { createId } from '../../utils/id'
import type { Budget, SyncQueueItem, Transaction } from '../../domain/models'

export function entityKey(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
): string {
  return `${entityType}:${entityId}`
}

export function queueOperation(
  queue: SyncQueueItem[],
  entityType: SyncQueueItem['entityType'],
  action: SyncQueueItem['action'],
  entityId: string,
  payload: SyncQueueItem['payload'],
): SyncQueueItem[] {
  const nextOperation: SyncQueueItem = {
    id: createId('sync'),
    entityType,
    action,
    entityId,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  }

  return [
    ...queue.filter(
      (item) => !(item.entityType === entityType && item.entityId === entityId),
    ),
    nextOperation,
  ]
}

export function queueTransactionUpserts(
  queue: SyncQueueItem[],
  transactions: Transaction[],
): SyncQueueItem[] {
  return transactions.reduce(
    (nextQueue, transaction) =>
      queueOperation(
        nextQueue,
        'transaction',
        'upsert',
        transaction.id,
        transaction,
      ),
    queue,
  )
}

export function queueBudgetUpserts(
  queue: SyncQueueItem[],
  budgets: Budget[],
): SyncQueueItem[] {
  return budgets.reduce(
    (nextQueue, budget) =>
      queueOperation(nextQueue, 'budget', 'upsert', budget.id, budget),
    queue,
  )
}
