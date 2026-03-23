import { describe, expect, it } from 'vitest'
import { pushSyncQueue } from './client'
import type { SyncQueueItem } from '../domain/models'

describe('pushSyncQueue', () => {
  it('returns applied operation ids for queued operations', async () => {
    const operations: SyncQueueItem[] = [
      {
        id: 'sync-1',
        entityType: 'transaction',
        action: 'upsert',
        entityId: 'txn-1',
        payload: null,
        queuedAt: '2026-03-20T10:00:00.000Z',
        attempts: 0,
      },
    ]

    const result = await pushSyncQueue('demo://local', operations, 'client-wins')

    expect(result.appliedOperationIds).toEqual(['sync-1'])
    expect(result.conflicts).toEqual([])
    expect(typeof result.serverTimestamp).toBe('string')
  })
})