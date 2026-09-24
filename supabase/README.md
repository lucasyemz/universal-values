# Database lifecycle

PostgreSQL holds scoped observations, previews, operations, leases, quota reservations, routing metadata and audit. RLS and restricted RPCs enforce tenant boundaries and privileged transitions. Client-visible IDs are not authorization; never expose service-role credentials in the frontend.

## Migrations

On a new development database apply all `migrations/` in filename order. On an existing project inspect the actual schema and migration ledger first: earlier migrations may have been applied manually. Do not assume a missing ledger entry means a missing schema, replay the full history or repair history blindly.

Tests, builds and app startup do not deploy migrations. Remote deployment requires explicit authorization, the correct target and review of the pending SQL. Existing deployments are documented in dated reports, not guaranteed by this file. Keep original migrations immutable; introduce a new migration for schema changes.

Worker-dependent changes require compatible executor deployment. In particular, `20260922000400_applied_scan_sources.sql` pins preview evidence consumed by the worker. Review [CMS contracts](../docs/cms-changes.md) and [Cron/Edge setup](../docs/background-sync.md) before activation. Cron SQL and Edge deployment are separate from migration application.

## Verification

`npm test` includes local PGlite database tests using simulated Supabase identities and providers. Verify owner/foreign-account/anonymous behavior, grants, audit rollback, idempotency and exact queue eligibility. These tests do not exercise real Auth, multi-session PostgreSQL races or customer writes. Justify indexes/RPCs with actual query shapes and representative plans rather than intuition.
