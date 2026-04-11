---
"tally": minor
---

[severity:minor] Fixes Home Recent transactions to exclude future-dated entries while keeping today and past items sorted newest-first, and makes the related tests timezone-safe. Improves update metadata parsing so changelog/severity are derived correctly from changesets (including case-insensitive severity markers), with fallback text only when changelog entries are unavailable. Enhances the update dialog changelog UX with Show more/Show less for long entries, and centers Records date chips so they no longer obscure leading transaction text.
