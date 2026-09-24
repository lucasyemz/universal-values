# Scan variable creation deployment — 2026-09-24

Applied with explicit user approval to linked Supabase project `nxibjpprjorchjeoudss`:

- `20260924000100_scan_variable_apply`
- `20260924000200_scan_variable_preview_grants`

The CLI ledger omits historical manually applied migrations. Checked the actual schema and required functions first. Executed only the new SQL and registered each migration in the same transaction; did not replay or repair historical migrations. Reloaded the PostgREST schema cache.

Hosted default grants included direct table-write privileges. The follow-up migration explicitly removes all privileges from PUBLIC, anon and authenticated, then grants authenticated SELECT only. Verified RLS enabled, authenticated read allowed, direct writes denied, anonymous table access denied, authenticated confirmation allowed and anonymous confirmation denied.

Both ledger entries verified. API table availability returned HTTP 200 using a zero-row read. Local PGlite regression tests passed (2 tests: atomic creation/idempotency/isolation/partial results and rollback/expiry). No real creation, binding allocation, queue confirmation or Webflow content write was performed during verification. The existing worker contract is unchanged.

## Scan review counters — 2026-09-24

Applied `20260924000300_scan_variable_review_counts` to the same linked project after explicit approval. Verified the preceding two versions and the old function before deployment. Replaced only the summary function and registered the migration atomically; reloaded PostgREST. Verified the ledger entry, updated post-group binding exclusion, site predicate, authenticated execution and denied anonymous execution. No customer content or Webflow writes were performed. Reload the scan list to obtain the new counts.
