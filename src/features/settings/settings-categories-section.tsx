import type { Category } from '../../domain/models'

interface SettingsCategoriesSectionProps {
  sortedCategories: Category[]
  linkedTransactionsByCategoryId: Map<string, number>
  onBack: () => void
  onAddCategory: () => void
  onEditCategory: (categoryId: string) => void
}

export function SettingsCategoriesSection({
  sortedCategories,
  linkedTransactionsByCategoryId,
  onBack,
  onAddCategory,
  onEditCategory,
}: SettingsCategoriesSectionProps) {
  return (
    <section className="panel settings-list-panel">
      <div className="settings-categories-header">
        <button
          type="button"
          className="ghost-button compact"
          onClick={onBack}
        >
          Back
        </button>

        <div>
          <p className="eyebrow">CATEGORIES</p>
          <h3>Manage categories</h3>
          <p>Tap a row to edit. Deletion now supports reassignment or Uncategorized fallback.</p>
        </div>

        <button
          type="button"
          className="submit-button compact"
          onClick={onAddCategory}
        >
          + Add
        </button>
      </div>

      <div className="settings-group-list settings-category-list-panel">
        {sortedCategories.map((category) => {
          const linkedCount = linkedTransactionsByCategoryId.get(category.id) ?? 0

          return (
            <button
              key={category.id}
              type="button"
              className="settings-category-row"
              onClick={() => onEditCategory(category.id)}
            >
              <div className="settings-category-main">
                <span
                  className="chip-dot"
                  aria-hidden="true"
                  style={{ backgroundColor: category.color }}
                />

                <div className="settings-category-info">
                  <strong>{category.name}</strong>
                  <span className="settings-category-kind">{category.kind}</span>
                </div>
              </div>

              <div className="settings-category-meta">
                <span className="settings-category-count">{linkedCount} linked</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
