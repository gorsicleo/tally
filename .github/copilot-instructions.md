# Copilot PR Review Instructions

Focus review comments on regression prevention and data correctness.
Comment only when there is a concrete bug risk, missing safeguard, missing test, ambiguous behavior, or meaningful maintainability risk.

## Priorities

- Protect state invariants and cross-entity consistency (categories, transactions, recurring templates, budgets, settings).
- Prioritize migration/restore and persistence safety over implementation style preferences.
- Verify financial totals and derived values remain correct across Home, Insights, and Budgets.
- Prefer targeted test requests for risky changes over broad refactor suggestions.

## Comment Quality

- Explain what can break, who it impacts, and what evidence would make it safe.
- Keep comments specific, calm, and action-oriented.
- Ask for focused tests when touching high-risk logic paths.

## Ignore Noise

- Do not leave style-only, formatting-only, or wording-only comments.
- Ignore harmless local naming differences and CSS/class ordering unless behavior/accessibility breaks.
- Do not suggest broad refactors when the PR scope is intentionally narrow.
- Avoid generic advice (for example, "follow best practices" or "add comments").
