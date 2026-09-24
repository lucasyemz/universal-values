# Engineering rules

Stack: Next.js, React, strict TypeScript, Supabase/PostgreSQL, Zod and Tailwind.

## Sources of truth

Read [product rules](docs/product-rules.md), [architecture](docs/architecture.md) and [URL contracts](docs/dashboard-urls.md) before changing their behavior. Focused guides are indexed in [docs/README.md](docs/README.md). `docs/archive/` is historical evidence, not current instructions. `docs/design/` describes unimplemented proposals. Update the relevant current guide with behavior changes; do not append competing rules to old reports.

## Architecture

- Platform integration code belongs in `src/connectors`; domain rules and orchestration belong in `src/modules`. React components render state and collect intent, not authorization or business decisions.
- UI actions, workers and MCP reuse domain contracts. Do not create alternative write paths or duplicate eligibility/queue predicates.
- Validate boundary payloads with Zod, avoid `any`, keep TypeScript strict. Use narrow read DTOs for summaries, progress and routing; load complete plans only where validation/execution needs them.
- Authorization memoization is request-scoped only. Never cache identity or permission decisions across requests/users. Enforce current account/workspace/site ownership and RLS in every applicable server boundary.

## Mutation safety

- AI must never directly modify a customer website. Suggestions fill drafts only; the shipped MCP tools are read-only.
- All mutations support preview, validation, explicit confirmation and audit. Website writes happen only after final confirmation of the exact persisted/displayed payload.
- Changing values or selection invalidates the preview receipt. Reject stale versions and delayed preparation responses; duplicate confirmation reuses the same operation identity.
- Every write is idempotent. Persist dispatch intent before provider writes; reconcile uncertain results by reading, never blindly resend them. Preserve leases, FIFO eligibility, Retry-After and per-source audit.
- Preserve fresh ownership/source checks, conflict detection and required post-write verification. Metadata caches never authorize writes. No automatic publishing.
- Managed Value protection includes exact ranges, snapshots and versions. Independent text may change only through the existing non-overlap contract; do not weaken other protected types or URL equality.
- Only selected eligible occurrences enter an edit. Focus is not selection. Never silently select hidden pages. Preserve exact offsets and gallery metadata/order.
- Only verified application outcomes move applied occurrences to Reviewed; failed/conflicting/uncertain attempts remain unresolved. Preserve separate manual-review semantics and read-only applied history.

## UI and request budgets

- Use shared light-mode components/tokens, English by default with PT-BR maintained. Show scope, freshness, consequences and meaningful errors; avoid redundant confirmation controls.
- Normal navigation and prefetch must not start scans, consume scan quota, generate AI or silently refresh provider metadata. Saved search is limited to stored compatible scans, never a claim about the entire live site.
- Measure Q (DB queries), W (Webflow), I (credential accesses), E (Edge invocations), G (Gemini) when changing execution costs. Preserve explicit refresh, hidden/offline polling suspension and bounded workers.
- Admin bypasses commercial allowances only, not authorization, safety or technical limits. Do not fabricate remaining provider quota from local counters.
- Do not log customer content, secrets, credentials or sensitive full URLs. Never commit environment files or generated credentials.

## Dashboard URL standard

- Workspace lists/settings use `/dashboard/{workspace-slug}/sites` and `/dashboard/{workspace-slug}/settings/webflow` for every workspace. Resolve slugs only inside the verified signed-in account; no global fallback.
- Site/resource paths use `/dashboard/{workspace}/sites/{site}`. Example: `/dashboard/kazama-test/sites/real-state-website/scans/1`. Resolve the workspace within the signed-in account and require the site to belong to that workspace. Moving a site changes its workspace path, not its site slug or resource numbers. Old account/site paths remain authenticated compatibility aliases; a real workspace namespace wins over an ambiguous account alias. Never fall back across workspaces when a canonical site is absent.
- Resource numbers are persistent positive integers scoped to `(site, resource type)`, transactionally allocated through `dashboard_resource_routes`. Never renumber, reuse deleted numbers or derive them from counts/list positions. Setup previews use `/dashboard/{account}/setup/{sites|workspaces}/{number}`.
- Use `src/modules/routes/resources.ts`, `links.ts`, `resolve.ts`, `site-resolve.ts`, `workspace-resolve.ts` and `src/modules/sites/workspace-url.ts`; do not handcraft competing route formats.
- UUIDs stay internal to database/actions/APIs/security tokens. Public resource query parameters use scoped numbers. Operation parameters must belong to both current site and scan.
- Legacy URLs remain authenticated GET/HEAD redirects with query strings preserved. POST actions rewrite without redirects or conversion to GET. Missing/foreign mappings fail closed.
- Routing changes require coverage of stable/concurrent allocation, account isolation, legacy redirects, query parameters and action rewrites. Numeric IDs and slugs never grant permission.

## Validation and deployment

- Test important domain rules and database isolation. Test website writes only with synthetic data or an explicitly designated test site, never real customer content.
- For code changes run lint, typecheck, full tests and production build. Run typecheck/build sequentially because Next generates shared types. For documentation-only changes verify references, contradictions and diff instead of claiming runtime coverage.
- Distinguish automated tests, browser checks, live-provider tests and untested cases in reports. PGlite is not proof of multi-session production concurrency.
- Remote migration/deployment requires explicit authorization for that work. Verify destination and actual schema/history first; never assume every historical manual migration is in the CLI ledger. Keep worker/schema versions compatible.
