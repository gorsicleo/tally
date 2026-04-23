# tally

## 1.4.0

### Minor Changes

- 93a1598: [severity:minor] Refines the Add transaction sheet for faster entry with reliable amount autofocus, a minimal close icon, centered presentation, compact date/repeat controls, and customizable quick category chips with add/remove controls plus Uncategorized fallback when chips are cleared. This update also makes date-chip picker behavior robust across desktop and mobile (including Safari clear/reset handling) and adds clearer visual separation between category and secondary controls.
- 4494f75: [severity:minor] Redesigns app headers across tabs with simplified title treatment, removes legacy subtitle/variant styling, and refreshes visual regression snapshots to match the new layout.
- 6d3081e: [severity:minor] Adds recurring budget support with a default recurring cadence in the budget editor, improves budget category chip usability on mobile (single-line truncation and consistent alignment), shows overspending budget alerts on Home, and adds a Settings preference to hide Home overspending alerts persistently. It also clarifies budget editor actions by using Discard for create and Close for update, and adds a recurring badge in budget lists.
- 98ea109: [severity:recommended-backup] Adds final privacy and security hardening with one-time recovery codes for app-lock fallback, improved unlock flows for PIN/device auth/recovery, and stronger safeguards that clear dependent lock metadata when launch lock is removed or invalid. Includes expanded tests to prevent regressions across lock, unlock, recovery, and persistence behavior.
- c475b90: [severity:minor] Fixes Home Recent transactions so future-dated entries do not appear, improves update metadata parsing and changelog presentation in the update sheet, and polishes navigation/records visuals by centering Records date chips, fixing changelog bullet alignment, and adjusting the Settings tab gear icon.

### Patch Changes

- 6df7b07: [severity:minor] Adds a Help and Feedback section in Settings with GitHub bug reporting, app info copy, and supporting visual and browser-flow coverage.
- 3016f21: [severity:minor] Fixes the update prompt changelog layout so release notes always render inside a bordered, rounded, scrollable container, preventing long content from pushing action buttons off-screen on small mobile/PWA viewports.
- f20a4c3: [severity:minor] Fixes the recurring editor sheet in Settings so it always has a visible close button and reliably dismisses after successful Save recurring or Stop recurring actions.
- c8392f3: [severity:minor] Improves locked-app startup flow by automatically attempting device authentication when available and falling back to PIN entry only if device auth fails, reducing unlock friction while preserving secure fallback behavior.
- d7f23e9: [severity:minor] Hardens CI changeset validation and makes recurring transaction tests date-safe across timezones.
- ba61911: [severity:minor] Hardens app-lock and recovery security behavior by enforcing cooldown on repeated failed recovery-code unlock attempts, tightening persisted verifier parsing for PIN and recovery metadata, and hiding recovery unlock when no codes remain. Also fixes TypeScript compatibility issues in WebAuthn/crypto typing and updates visual baselines for the expanded Privacy & Security settings UI.
