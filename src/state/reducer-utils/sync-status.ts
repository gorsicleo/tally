export function markEntityStatus<T extends { id: string; syncStatus: string }>(
  items: T[],
  entityIds: Set<string>,
  syncStatus: 'synced' | 'pending' | 'failed',
): T[] {
  return items.map((item) =>
    entityIds.has(item.id) ? { ...item, syncStatus } : item,
  )
}
