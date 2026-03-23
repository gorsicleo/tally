import type {
  Budget,
  Category,
  ConflictPolicy,
  SyncEntityType,
  SyncQueueItem,
  Transaction,
} from '../domain/models'

interface SyncRequest {
  clientTimestamp: string
  conflictPolicy: ConflictPolicy
  operations: SyncQueueItem[]
}

interface SyncConflict {
  entityType: SyncEntityType
  entityId: string
  serverRecord: Category | Transaction | Budget | null
}

interface SyncResponse {
  appliedOperationIds: string[]
  serverTimestamp: string
  conflicts: SyncConflict[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSyncConflict(value: unknown): value is SyncConflict {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.entityType === 'transaction' ||
      value.entityType === 'category' ||
      value.entityType === 'budget') &&
    typeof value.entityId === 'string' &&
    (value.serverRecord === null || isRecord(value.serverRecord))
  )
}

function isSyncResponse(value: unknown): value is SyncResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.appliedOperationIds) &&
    value.appliedOperationIds.every((entry) => typeof entry === 'string') &&
    typeof value.serverTimestamp === 'string' &&
    Array.isArray(value.conflicts) &&
    value.conflicts.every(isSyncConflict)
  )
}

export async function pushSyncQueue(
  endpoint: string,
  operations: SyncQueueItem[],
  conflictPolicy: ConflictPolicy,
): Promise<SyncResponse> {
  const requestBody: SyncRequest = {
    clientTimestamp: new Date().toISOString(),
    conflictPolicy,
    operations,
  }

  // Remote sync is intentionally disabled for now; local state remains source of truth.
  void endpoint

  const payload: unknown = {
    appliedOperationIds: requestBody.operations.map((operation) => operation.id),
    serverTimestamp: new Date().toISOString(),
    conflicts: [],
  }

  if (!isSyncResponse(payload)) {
    throw new Error('Sync response payload was invalid.')
  }

  return payload
}
