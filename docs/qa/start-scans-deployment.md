# Atomic scan start deployment — 2026-09-28

Applied with explicit user authorization to Supabase project `nxibjpprjorchjeoudss` (Universal Value, main production), through the authenticated SQL Editor.

Preflight confirmed the ledger through `20260928000100`, no existing start_cms_scan function, two previews, 29 started scans and 174 audit rows. Applied only `20260928000200_start_scans_atomically.sql`, recording its exact source/version/name in the migration ledger in the same transaction, followed by PostgREST schema reload notification.

Post-deployment verification: migration registered; authenticated atomic start allowed; anonymous start denied; direct authenticated preview creation denied; zero previews remaining; all 29 started scans and 174 audit rows retained. Evidence: [SQL verification](start-scans-deployment.png).

Local validation before deployment: lint, TypeScript, 880 tests and production build passed. Database tests cover atomic rollback, duplicate identity, foreign-site rejection, changed-payload rejection and historical preview cleanup with audit/resource-number preservation. No live scan or Webflow write was triggered. Production multi-session concurrency and the full browser scan flow were not exercised during deployment.
