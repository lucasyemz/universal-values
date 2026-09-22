# Stack

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Zod
- Tailwind

# Architecture

Platform integrations must live in:

`/src/connectors`

Business logic must not be implemented inside React components.

# Safety

AI must never directly modify a customer website.

All mutations must support:

1. preview
2. validation
3. explicit confirmation
4. audit log

# Sync

Every write operation must be idempotent.

# Code quality

- TypeScript strict mode
- Avoid `any`
- Validate API payloads with Zod
- Add tests for important business logic

# Dashboard URL standard

- Public dashboard URLs must use the existing account slug and site slug, in lowercase with hyphens. Example: `/dashboard/lucasmatrixx/sites/real-state-website/scans/1`.
- Site resources use a persistent positive integer scoped to `(site, resource type)`. Scans, Managed Values, operations, static changes and previews must not expose database UUIDs/hashes in public paths or resource query parameters. Two different sites/accounts can each have scan `1`.
- Allocate numbers transactionally in PostgreSQL through `dashboard_resource_routes`; backfill existing records deterministically, never renumber them, reuse deleted numbers, or derive numbers from list positions/counts.
- Use `src/modules/routes/resources.ts` for route formats, `links.ts` for server-rendered public resource links, and `resolve.ts` for authenticated resolution. Account setup previews use `/dashboard/{account}/setup/{sites|workspaces}/{number}`. Workspace settings follow the existing account/workspace slug scope.
- UUIDs remain internal database identifiers, form/action payloads, API identifiers and idempotency keys. API/OAuth/security tokens must retain their existing security contracts; this URL rule concerns user-facing dashboard navigation.
- Keep old dashboard UUID URLs as authenticated redirects. Canonical routes rewrite internally to existing handlers; preserve filters, pagination and errors. Do not redirect action POSTs into GETs.
- Numeric IDs are not authorization: enforce account/site scoping, RLS and existing owner checks. An operation query parameter must belong to the current site AND scan. Never fall back to another account or site when a route cannot be resolved.
- Test stable numbering, concurrent allocation, cross-account isolation, legacy redirects, query parameters and server-action rewrites whenever routing changes.
