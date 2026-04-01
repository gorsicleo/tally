# Branch Protection Checks

Configure branch protection for `main` in GitHub repository settings and mark these checks as required:

- `CI / Lint`
- `CI / Changeset Required`
- `CI / Unit and Component Tests`
- `CI / E2E Tests (Playwright)`
- `CI / Visual Regression (Playwright)`

Notes:

- Branch protection is not configured via code in this repository and must be enabled manually in GitHub settings.
- If visual snapshots are intentionally not required for merge in your workflow, you can leave `CI / Visual Regression (Playwright)` as non-required while keeping it enabled for PR feedback.
