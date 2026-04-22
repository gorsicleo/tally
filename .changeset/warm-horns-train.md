---
"tally": patch
---

[severity:minor] Hardens app-lock and recovery security behavior by enforcing cooldown on repeated failed recovery-code unlock attempts, tightening persisted verifier parsing for PIN and recovery metadata, and hiding recovery unlock when no codes remain. Also fixes TypeScript compatibility issues in WebAuthn/crypto typing and updates visual baselines for the expanded Privacy & Security settings UI.
