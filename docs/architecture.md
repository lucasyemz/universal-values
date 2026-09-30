---
title: "Architecture and request budgets"
status: atual
tags: [replaceall, guia]
---

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

Summaries must use narrow projections rather than load full plans/snapshots/bindings. Review counters preserve manual, applied, reverted, protected and specific-search semantics. Recent overview activity is limited to five entries; Changes uses stable reverse-chronological pagination across CMS/static sources. Progress and redirect DTOs load only the state/identity needed. Variable lists use counts; source details paginate, while in-panel editing retains its 50-source limit. Group-aware scan pagination is [design only](design/group-pagination.md).

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

Scans remain browser-scheduled bounded reads. Confirmed scans enter a bounded FIFO queue; the visible, online dashboard activity runner dispatches eligible batches through the shared database predicate. Paused scans require explicit resume or cancellation. See the queue contract in [scans](scans.md). CMS confirmed changes run independently in a durable FIFO queue. The worker's authoritative runnable predicate is reused by the SQL Cron gate; the gate neither claims nor reserves work. Idle Cron performs no Edge invocation. Immediate kicks are best-effort, durably deduplicated per confirmed operation; failure does not invalidate confirmation, and Cron recovers it.

Edge batches are sequential, at most three fields with a strict 90-second budget, pacing and reserved time before starting another field. Stop on cooldown, uncertainty or required attention. Preserve per-field dispatch intent, leases, result verification and no-resend behavior.

Activity uses 15 seconds only for truly active work, 60 seconds for inactive/attention states, with hidden/offline suspension. Progress uses a narrow DTO and refreshes parent data only on meaningful changes; terminal work stops progress polling. Health distinguishes idle, scheduled waiting, processing, stalled runnable work, cooldown and errors. Missing empty heartbeats is not failure.

See [worker operations](background-sync.md), [database setup](../supabase/README.md) and [verification](verification.md).

CMS Explorer uses a bounded mounted-session cache (12 pages, two minutes) with actor/workspace/site/connection/generation/collection/page/locale keys. It is not persisted CMS structure or write authority. GET never loads item content; explicit selection loads one page, local search does not fetch, refresh invalidates session pages. Provider Retry-After blocks retry controls and has a best-effort process guard; no distributed cache or new Edge invocation. See [Explorer UX plan and verification](cms-explorer-ux-plan.md).

Workspace overview uses one additional narrow `workspace_overview_counts` RPC returning only workspace IDs and site/scan/active-variable counts. Counts follow current site ownership/workspace (including transfers), under invoker RLS; no occurrence/plan/binding payloads. Until the migration exists, counters are omitted, never fabricated as zero. Workspace editing uses two explicit RPCs (prepare, confirm), no provider access; normal canonical navigation keeps its existing query count, while a namespace miss adds one alias lookup and an alias hit one current-route lookup. W/I/E/G delta is zero. See the workspace rename contract in [dashboard URLs](dashboard-urls.md).

## Local rendering derivations

The sidebar includes a collapsible site list for the selected workspace, linking directly to each site's overview. Its authenticated layout adds one narrow account-filtered, RLS-protected sites query (Q +1 per layout render; W/I/E/G +0), reuses workspace routing metadata and disables link prefetch. Sites and Site overview share an accessible disclosure. Each keeps a separate account-scoped open/closed preference in localStorage, synchronized between desktop/mobile menus and browser tabs. Only explicit toggles write preferences; storage failure falls back to memory. Navigation does not reset either preference. Expanding/collapsing adds no requests. Site-list read failures preserve workspace navigation and show an unavailable message. Canonical paths identify the active workspace during page loading; destinations still enforce their existing ownership checks.

Dashboard page headings use the shared `PageHeader` (directly or through `SitePage`): a light card groups the title, context, description, status and actions. Back navigation belongs in its optional separated top strip. Nested operation sections use the compact `embedded` variant with an `h2`, avoiding a second page heading and nested header cards. Spacing and responsive alignment belong in this component rather than individual routes.

Scan editing memoizes source projections, selection signatures and display previews by their current input references. CMS Explorer reuses one filtered page and a field-name index; Variables indexes live sources and retains comparisons during unrelated state changes. These are component-local presentation derivations, never authorization caches. Text comparisons coalesce adjacent equal-status segments and share TextParts; exact strings and change boundaries remain preserved. Request contracts are unchanged. Measurements and scope: [render performance review](qa/dashboard-render-performance.md).

## Setup without repeated confirmation

Workspace creation keeps the same two mutation RPCs (prepare then confirm), now within one explicit server action. Sign-out still uses one local-session auth sign-out. Site linking reuses the existing RLS/owner, quota, expected-connection and audit RPCs. The OAuth callback completes encrypted credential persistence first, then performs one authorized-sites read (W=1, I=1 for all sites), links sites sequentially with stable per-connection/site operation IDs and stores display metadata. This replaces discovery plus individual prepare/confirm reads (previously roughly W/I=1+2N for N sites on one connection). Site linking uses 2 mutation RPCs per site as before, plus existing metadata persistence and scoped connection/ownership reads; one additional narrow account sites query prevents copying an existing site from another workspace. E/G unchanged. GET navigation/prefetch remains provider-free; the OAuth callback is the explicit authorization completion. Existing write-safety paths are unchanged. No migration is required.

## Product motion

Dashboard and Designer share `src/styles/product-motion.css`: short entrance, disclosure/popover, pressed/hover and loading transitions. The extension build embeds these rules into its existing stylesheet before content hashing, with no new remote asset or animation dependency. Dashboard route motion uses Web Animations on pathname changes only, without keying/remounting content or animating query/filter updates. It cancels on cleanup and when reduced motion is enabled. Content is visible without JavaScript, native focus/keyboard semantics remain unchanged, and no exit animation delays an action. CSS reduced-motion rules cover both surfaces. No Q/W/I/E/G delta.

Workspace creation eligibility reuses request-scoped `getPlanUsage` (one narrow account RPC, shared with plan usage UI). When the Free account already has its allowed site, creation links/forms and server actions reject new workspaces; admin remains exempt. A completed creation replay checks the actor-scoped preview and returns the existing workspace. No Webflow/credential/Edge/AI calls are added. This application preflight improves setup UX; it is not a replacement for the transactional database site quota.
