import type { Category } from './models'

export const UNCATEGORIZED_CATEGORY_ID = 'cat-uncategorized' as const
export const UNCATEGORIZED_CATEGORY_NAME = 'Uncategorized' as const
export const UNCATEGORIZED_CATEGORY_COLOR = '#7e8798' as const

export function isUncategorizedCategory(
  category: Pick<Category, 'id' | 'system'>,
): boolean {
  return (
    category.system === 'uncategorized' ||
    category.id === UNCATEGORIZED_CATEGORY_ID
  )
}

export function isSystemCategory(
  category: Pick<Category, 'system'>,
): boolean {
  return category.system !== null
}

export function createUncategorizedCategory(
  timestamp = new Date().toISOString(),
): Category {
  return {
    id: UNCATEGORIZED_CATEGORY_ID,
    name: UNCATEGORIZED_CATEGORY_NAME,
    color: UNCATEGORIZED_CATEGORY_COLOR,
    kind: 'both',
    system: 'uncategorized',
    createdAt: timestamp,
    updatedAt: timestamp,
    syncStatus: 'synced',
  }
}

export function ensureUncategorizedCategory(
  categories: Category[],
  timestamp = new Date().toISOString(),
): Category[] {
  const normalizedCategories = categories.map((category) => ({
    ...category,
    system: category.system ?? null,
  }))
  const index = normalizedCategories.findIndex(isUncategorizedCategory)

  if (index < 0) {
    return [createUncategorizedCategory(timestamp), ...normalizedCategories]
  }

  const existing = normalizedCategories[index]
  normalizedCategories[index] = {
    ...existing,
    id: UNCATEGORIZED_CATEGORY_ID,
    name: UNCATEGORIZED_CATEGORY_NAME,
    color: existing.color || UNCATEGORIZED_CATEGORY_COLOR,
    kind: 'both',
    system: 'uncategorized',
  }

  return normalizedCategories
}

export function getUncategorizedCategory(
  categories: Category[],
): Category | null {
  return categories.find(isUncategorizedCategory) ?? null
}

export function getVisibleManagedCategories(
  categories: Category[],
): Category[] {
  return categories.filter((category) => !isSystemCategory(category))
}
