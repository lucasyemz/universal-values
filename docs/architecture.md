# Architecture and request budgets

## Boundaries

| Layer | Responsibility |
| --- | --- |
| `src/app`, `src/components` | Routes, presentation, local drafts and explicit user actions |
| `src/modules` | Domain schemas, permissions, plans, eligibility, orchestration and narrow read contracts |
| `src/connectors` | Supabase/Webflow/Gemini transport and provider-specific adapters, including Designer integration |
| PostgreSQL/RPC/RLS | Tenant isolation, transactional confirmation, persistent numbering, quota reservation, leases and audit |
| Node/Edge worker | Execute the same confirmed CMS domain plans; no independent mutation semantics |
| MCP | Authenticated, bounded read-only access through shared services |

Keep this modular application; do not create microservices or duplicate plans/policies to optimize a screen. Existing Designer presentation in the connector directory is not a reason to put new business rules in React. API payloads are validated with Zod, while privileged transitions are also checked in the database.

## Data roles

Scan occurrences are saved observations with exact ranges, source identity and freshness. Drafts express local intent. A persisted preview freezes the proposed payload and supporting evidence. Confirmation admits an idempotent operation; per-field dispatch/results and audit describe execution. Routing records only map public identifiers. These records serve different purposes; consolidating screens does not justify deleting execution evidence or treating a preview as success.

Summaries must use narrow projections rather than load full plans/snapshots/bindings. Review counters preserve manual, applied, reverted, protected and specific-search semantics. Recent overview activity is limited to five entries; Changes uses stable reverse-chronological pagination across CMS/static sources. Progress and redirect DTOs load only the state/identity needed. Managed Value lists use counts; source details paginate, while in-panel editing retains its 50-source limit. Group-aware scan pagination is [design only](design/group-pagination.md).

## Cache and security

Provider structure cache keys include actor/workspace, site, connection identity/generation, kind and collection where applicable. The current initial metadata TTL is 15 minutes, a conservative policy rather than a measured optimal duration. Every use still enforces current database ownership/connection state. Cached structure never proves live provider authorization or current item content.

Reconnect, revoke, connection replacement and explicit refresh invalidate the relevant metadata. Missing/expired structure requests explicit refresh; expiration is not denial. Denied provider access fails safely. Concurrent metadata refreshes can coalesce within the same scope; writes, conflict reads and authoritative item reads cannot.

Request-scoped memoization may share user, membership and route lookups inside one request. It must not persist authorization between requests/users. Credentials must not enter shared caches, public payloads or logs.

## Expected provider work

W = Webflow calls; I = credential accesses; Q = database queries; E = Edge invocations; G = Gemini requests. Counts below describe action contracts, not service bills. DB work is still required for authenticated navigation.

| Action | W / I contract |
| --- | --- |
| Open Sites, New Scan, review configuration, warm Explorer structure | 0 / 0; no hidden cold-cache refresh |
| Explicit site / collection-list / schema refresh | 1/1, 2/1, 3/1 respectively |
| Explicit Explorer uncached collection/page selection | 4 / 1; valid two-minute in-memory page hits cost 0 / 0 after current DB scope validation |
| Scan batch with reusable schema | 3 / 1 versus 4 / 1 cold; fresh site, collection and item checks remain |
| Prepare/execute writes | Existing fresh safety reads remain; never optimize them away with metadata TTL |
| Saved search, mode switches, local selection | No new W/I/E/G; DB reads may be needed for saved data |

Provider telemetry records action/endpoint class, read/write, status/429, duration and scoped identifiers. It must not include content, tokens, credentials or sensitive full URLs. The original measurements and query-plan evidence are in the [archive](archive/2026-09/README.md); use measured payloads, not guessed indexes.

## Execution and monitoring

Scans remain browser-scheduled bounded reads. CMS confirmed changes run independently in a durable FIFO queue. The worker's authoritative runnable predicate is reused by the SQL Cron gate; the gate neither claims nor reserves work. Idle Cron performs no Edge invocation. Immediate kicks are best-effort, durably deduplicated per confirmed operation; failure does not invalidate confirmation, and Cron recovers it.

Edge batches are sequential, at most three fields with a strict 90-second budget, pacing and reserved time before starting another field. Stop on cooldown, uncertainty or required attention. Preserve per-field dispatch intent, leases, result verification and no-resend behavior.

Activity uses 15 seconds only for truly active work, 60 seconds for inactive/attention states, with hidden/offline suspension. Progress uses a narrow DTO and refreshes parent data only on meaningful changes; terminal work stops progress polling. Health distinguishes idle, scheduled waiting, processing, stalled runnable work, cooldown and errors. Missing empty heartbeats is not failure.

See [worker operations](background-sync.md), [database setup](../supabase/README.md) and [verification](verification.md).

CMS Explorer uses a bounded mounted-session cache (12 pages, two minutes) with actor/workspace/site/connection/generation/collection/page/locale keys. It is not persisted CMS structure or write authority. GET never loads item content; explicit selection loads one page, local search does not fetch, refresh invalidates session pages. Provider Retry-After blocks retry controls and has a best-effort process guard; no distributed cache or new Edge invocation. See [Explorer UX plan and verification](cms-explorer-ux-plan.md).
