# Dashboard UX and API cost audit

Date: 2026-09-22. Baseline: commit `8076d81`.
Scope: **Phase 1 — audit only** of [the supplied optimization guide](COPYREPLACE_DASHBOARD_UX_API_COST_OPTIMIZATION.md).
No production behavior, quota, migration, worker schedule or external content is changed in this phase.

## Evidence and counting method

Read `AGENTS.md`, `README.md`, `docs/scans.md`, `docs/cms-changes.md`,
`docs/managed-value-sync.md`, `docs/background-sync.md`, `docs/free-plan.md`, and the supplied guide.
Inspected the route handlers, server actions, connectors, React polling/draft code and SQL gateways listed below.
Where prose and implementation disagree, this audit follows executable code.

- **Static counts** below are successful-path calls issued by the current code, not production traces or billing measurements.
- **Measured mocked counts** are marked separately. They run real loaders against a fake Supabase client and fake Webflow transport; no real site is mutated.
- **Browser observations** cover authenticated, read-only navigation on localhost. They validate visible workflow, not server-to-provider network counts.
- `Q` = one Supabase table request or RPC issued by a loader; **not** SQL statements inside RPCs. Auth/session verification, proxy routing, shared layout and client mount/poll costs are listed separately rather than silently omitted.
- `W` = Webflow Data API request. `I` = authorized credential access (`read_webflow_credential`), not a Webflow HTTP request. `E` = Edge invocation. `G` = Gemini generation request.
- Counts exclude retries/errors unless specified. Zero Webflow means zero **direct loader** calls, not proof that Next prefetching unrelated routes cannot call a provider.
- Steps count meaningful user decisions/submissions from the stated starting screen; typing a value or selecting several related checkboxes counts as one decision. Route transitions exclude proxy rewrites; legacy redirects are additional HTTP hops.

No production latency percentiles, response-byte measurements, live quota totals or production `EXPLAIN ANALYZE` were collected. No new index is justified solely by this audit.

## Principal findings

1. Overview, scan history, old scan results, Managed Values and change history already use PostgreSQL instead of Webflow. Preserve this.
2. Workspace **Sites** still calls Webflow to display project URLs: `C` reads and `C` credential accesses per load, where `C` is the distinct active linked connection count.
3. **New scan** performs two Webflow reads on entry; **Review scan** repeats those two reads before any scan is confirmed. This is metadata traffic, not an item rescan, but it consumes integration access quota.
4. **Explore CMS** performs two reads on open and four on each collection selection/page navigation. There is no shared metadata cache for these paths.
5. A scan batch performs **four** Webflow GETs: authorized sites, collections, collection schema, item page. The first three repeat across batches.
6. Scan-list review counters have a per-scan fan-out: up to five full occurrence sets (5,000 records) plus review RPCs and paged operation histories for one five-row table page.
7. Stored-results search is provider-free but submits a GET and reloads/recomputes all results. It is not yet a local/debounced search.
8. CMS edits and Managed Value detail edits **already have inline preview + explicit Apply**. Replacing them with another review surface would duplicate existing work.
9. The worker Cron invokes the Edge Function every minute even when idle. A conditional queue check can remove idle invocations, but the worker health model must change with it.
10. No automatic AI classification is needed. AI generation already exists, is opt-in, and has a small metadata cache; the guide's “future AI” language is partly outdated.

## Shared overhead (applies in addition to route rows)

| Layer | Current work | Evidence / implication |
| --- | --- | --- |
| Proxy | `auth.getClaims`; DB route lookups | `src/proxy.ts`, `modules/routes/resolve.ts`. Typical canonical site path: account + site lookup; resource: account + site + resource; `operation` adds operation route + scan ownership. Legacy GETs redirect, then resolve again. Never cache authorization globally. |
| Server layout | Plan usage RPC + workspace list; repeated `requireUser()` calls | `app/dashboard/layout.tsx`. `getPlanUsage` and `getWorkspaceNavigation` use React request cache. `requireUser`, `getScanSite`, membership checks and `getConnectionReader` do not. Count real Auth calls separately in a production trace before claiming a net total. |
| Resource links (`L` below) | Resource-route query per nonempty resource kind; cached account/site namespace | `modules/routes/links.ts`. `operationLinks` additionally reads request→scan IDs and scan routes. `resourceLink` and namespace are memoized within React requests; batch `resourceLinks` is not. |
| AI provider | 1 status RPC on mount and on window focus | `components/ai/provider.tsx`. No Gemini generation/network request to Google merely to read status. No timer. |
| Activity panel | At least 3 Q per poll (changes, scans, worker health); + site names and route-link queries when rows exist | `modules/activity/actions.ts`. Account-wide, up to 50 rows per stream. Immediate poll on pathname change and wake. No W/G/E. |
| Images | Browser thumbnail/preview downloads may contact image hosts | Zero W/G does not mean zero network. Keep previews bounded/lazy and distinguish asset bytes from API reads. |

## Dashboard route inventory and UX baseline

Public notation: `S = /dashboard/{account}/sites/{site}`;
`WS = /dashboard/{account}/sites` for the primary workspace; other workspaces retain existing workspace-slug routing.
Implementation files still use internal `[id]` paths. They are not proposed public URLs.
`H` = number of 200-row operation-history pages fetched, minimum 1 per reviewed scan.
`L` = resource-link queries above; `B` = 1 when bindings are requested, otherwise 0; `V` = 1 when linked values are loaded for a scan.
`C` = active relevant connections; `N` = sites; `A` = 1 for archived Managed Value snapshot.
All routes have the shared overhead above. All have **0 direct E and 0 G** on normal open.

| Route / user goal | Steps / route transitions from that screen | Loader Q (static, excluding shared overhead) | W / I on normal open | Current inefficiency and reusable data |
| --- | --- | --- | --- | --- |
| `/dashboard`: choose workspace/site | Workspace → site → overview: 2 / 2 | Reuses cached layout workspace and plan reads | 0 / 0 | Landing control center has no site Quick Search. Site data already persists. |
| `WS`: open linked site | Open site: 1 / 1 | `4 + 3C` | `C / C` | `loadWorkspaceSiteUrls` obtains live sites just for display URLs. Persist metadata and freshness instead. List not paginated. |
| `S/overview`: attention, activity, start work | Attention/activity: 1 / 1; new scan flow below | `10 + L` | 0 / 0 | `getScanSite` repeated via `siteChangesPage`; full Designer plans/events loaded to render summaries. Counts already partly use `head:true`. Recent list limited to 5. |
| `S/scans`: review previous scan | Open review: 1 / 1 | `3 + Σ(2 + H) + L` for completed/limited rows | 0 / 0 | Five rows/page, but fetches 1,000 occurrences per completed scan plus all change history pages to derive counters. Aggregate safely using same review semantics. |
| `S/scans/new`: configure scope | Select collections → Continue → types/query → Review → confirm consent + Start: 5 / 1 to persisted preview (then same-route refresh) | 7 | 2 / 1 | Site/owner loaded twice; sites+collections uncached. No prior config defaults or Run Again. Source is always CMS; static is a link, SEO disabled. |
| `S/scans/{n}` preview | Consent + Start: 1 / 0 path changes | Full `loadScanResults` path even for preview: `7 + V + H + L` | 0 / 0 | Loads occurrences/bindings/review history before status branch. Empty/new preview needs only plan/site/expiry. |
| `S/scans/{n}` completed/limited | Choose/edit → Preview → Apply: 3 / 0 | `7 + V + H + L`, plus selected operation child if present | 0 / 0 | Up to 1,000 occurrences and site bindings, values, complete scan operation history. Search/filter are server navigation. No group pagination; contexts already in snapshots. |
| Same scan, running/paused | Watch or Resume: 0–1 / 0 | Same heavy render + batch action below | 0 on server render; mounted running controller invokes W batches | Resume existing confirmed work, not a new scan. Must not mount controller for Quick Search. Paused Resume visually enables before cooldown but scheduler waits. |
| `S/managed-values`: find/open central value | Search/filter → open → edit → preview → apply: 4–5 / 1–2 | `3 + B + L` | 0 / 0 | Five values/page; filters in URL; name-only DB search. Binding projection narrow, capped at 1,000 with unknown totals if exceeded. List has no inline editor. |
| `S/managed-values/{n}`: edit/view sources | Edit → Preview → Apply: 3 / 0 | `5 + A`, plus history link/control lookups | 0 / 0 | Editor already inline on detail page. Loads complete bindings and 20 sync histories; no binding pagination. Input draft only React state. |
| Managed Value creation preview | Confirm centralization: 1 / 1 | 6 | 0 / 0 | Separate preview remains for a meaningful new relationship; snapshots reused. Avoid conflating “reviewed” and “managed”. |
| `S/changes`: inspect activity | Filter/open: 1–2 / 1–2 | `2 + streams + L` (`streams`=1–2) | 0 / 0 | Fetches prefix `page*5+1` from each stream then merges; attention filter loads up to 1,000 from **each** stream. Designer `plan/events` and CMS `results` are large. |
| CMS operation resource | 1 navigation; scan operation redirects to scan review, sync detail renders operation | `loadChangeRequest`: 3 Q managed / 4 Q scan / 5 Q revert; child may repeat | 0 / 0 | `changes/[id]` loads full request/occurrences merely to redirect; managed branch `ChangeDetails` reloads the request. Use narrow routing DTO. |
| `S/changes/{n}` static detail | Read applied before/after: 1 / 1 from history | 3 | 0 / 0 | Persisted plan/events only. Good drawer candidate using DB evidence. No live Designer reads. |
| `S/static` | Read limitation/open settings: 1 / 1 | 2 | 0 / 0 | Editing requires active Designer extension. Dashboard is not an independent static crawler. |
| `S/facts` | Edit → preview → confirm: 3 / 2 | 4 | 0 / 0 | Versions and previews: 20 each, full facts payloads. History capped, no further pages. |
| Facts preview | Confirm or archive: 1 / 1 | 5 | 0 / 0 | Base/latest version + own immutable preview; necessary conflict guard. |
| Facts version | View saved version | 3 | 0 / 0 | Read-only persisted facts. |
| `/dashboard/plan` | Inspect; plan switch review → confirm: 2 / 1 + refresh | Cached usage; admin site list 1; client Gemini usage RPC separately | 0 / 0 | Admin capacity aggregate runs as part of shared plan RPC too. Storage-size computation need not run for every layout. Manual Webflow balance is separate action. |
| `/dashboard/settings/integrations` | Connect Gemini explicitly; open workspace settings | 1 workspace query beyond layout cache wrapper | 0 / 0 | `listWorkspaces` bypasses memoized navigation wrapper; AI status/usage are DB only. |
| `/dashboard/settings/webflow` | Choose/create workspace | 1 | 0 / 0 | Single workspace redirects; duplicate list query. Workspace creation uses stored preview/confirmation. |
| Workspace Webflow settings | Show authorized sites → select → preview → confirm: 4 / 2 + refresh | `4 + 3N` for Designer sessions; `+3C` when `?sites` requested | 0 / 0 normally; `C / C` with `?sites` | Explicit discovery uses query parameter, repeated reload with it calls provider again. No TTL. Designer session loader repeats site+owner for each row. |
| Site-link preview | Confirm connection: 1 / 1 | 1 | 0 / 0 | Saved immutable selection; permission checks remain in confirmation RPC. |
| Workspace creation preview | Confirm: 1 / 1 | 1 | 0 / 0 | Saved name/expiry; no provider. |
| `/dashboard/designer` | Redirect matched site to settings; otherwise choose site | 1 | 0 / 0 | No scanning. Existing extension connects using code. |
| Legacy connection/AI/site-root routes | Redirect to current settings/integrations/overview | 0–2 plus destination | 0 until destination | Avoid public links using internal UUIDs when a canonical path is available; current redirects preserve ownership but add work. |

### Loaders and visible waiting

- `app/dashboard/loading.tsx` and `sites/[id]/loading.tsx` provide route loading shells. Nested `<section>` is not an independent streaming data boundary.
- Most pages await their full loader before rendering. Sites waits on remote URLs; New scan waits on remote collection metadata; Explore CMS waits on provider data.
- Overview begins five parallel tasks, but recent history contains more sequential site/link work. Scan-list review calculations fan out in parallel without reducing total cost.
- Inline preview has pending/disabled state and checks the draft fingerprint. `SubmitButton` uses pending form state. Do not add another confirmation modal.
- `FreshLink` refreshes the route; it is DB-only only when the destination loader is DB-only. It is not a provider-refresh abstraction.
- No `prefetch={false}` on provider-reading routes was found. Actual Next production prefetch depth was not measured; record as a risk, not a proven extra request count. Do not rely on dynamic routing alone to enforce the zero-provider rule.

## Major action / network baseline

| Action | DB / credentials | Provider work | UX / optimization boundary |
| --- | --- | --- | --- |
| Prepare scan | Site+membership 2 Q; reader 3 Q; preview RPC 1 Q | 2 W (sites + collections), 1 I | Current setup metadata duplicated. Scan quota is reserved on confirmation, preparation/integration limits can be consumed earlier. No AI. |
| Confirm scan | `getScan` 2 Q + confirmation RPC 1 Q | 0 W, 0 E | Idempotent SQL confirmation. Starts client scheduler on next render. Never prepare/confirm from keypress or route prefetch. |
| Scan batch | Successful path 11 Q including site/scan/owner/reader/claim/save/final progress; 1 I | 4 W per batch; 0 E/G | Persisted cursor/lease. Up to 25 items. 5-second DB `retry_at` between saved batches. Client minimum timer 500ms, honoring that DB timestamp; docs shorthand “5 seconds” is not the literal timer constant. |
| Search stored results / tabs | Re-runs result loader through GET | 0 W/I/E/G | No keypress request today, but no debounce/local filtering either. Does not discover new raw-match ranges. |
| Select/edit/fill same group | Client React state + localStorage draft | 0 W/I/E/G | Already cheap. Maintain group boundaries and protected ranges; selection alone must not create a preview. |
| Prepare ordinary CMS preview | `loadScanResults` + preview RPC; `prepareItemSlugs` reloads request plan; `readInlinePreview` reloads again | Normally 0 W/I. Name edits: 1 I + one item GET per missing name-source slug | Initial field preview already reuses persisted snapshot. Slug reads supply extra effect explicitly shown to user: not waste to delete. Consolidate DB rereads without trusting client snapshots. |
| Confirm CMS preview | `loadChangeRequest` + digest comparison + confirm RPC | 0 W/E/G inline; work enqueued | No immediate worker kick. Changed draft/selection invalidates visible preview. SQL confirms once, reserves quotas, verifies bindings/version/owner. |
| Normal worker field | Claim gateway (including 1 I), dispatch RPC, finish RPC | 4 W reads + up to 1 PATCH | Reads sites, collections, schema, current item. Ordinary un-managed/no-slug writes use authoritative PATCH response; **not** an unconditional extra GET today. |
| Managed/slug worker field | Same gateway/lease/audit model | 4 W reads + up to 1 PATCH + 1 verification GET on success | Preserve extra verification. Conflict/already-applied/reconciliation are read-only. No retry of dispatched uncertain writes. |
| Revert/retry | Stored original/results + preview RPC + plan reloads | Usually 0 W until execution; legacy missing slug may need GET | Exclude ineligible failures/uncertainty; never introduce a bulk revert which changes the selected scope silently. |
| Centralize / archive / review flag / facts | Preview + confirmation RPCs, DB audit | 0 W/G | Existing DB mutations still need validation and meaningful confirmation; merely opening a drawer should not run these actions. |
| Generate AI for one target | Full result/auth checks, 1 I for context, Gemini claim + status RPC | Warm metadata: 1 item GET; cold: +3 metadata GETs; 1 G | Explicit button. Generation fills a draft; never writes CMS. Current metadata TTL 5 min, process-local, bounded to 100 entries. |
| Generate group with AI | Context inputs max20; item promise dedupe within that batch; quota claim per generation | `U + 3Cmiss` W for context; one G per eligible generated target | `U` unique item/locale targets, `Cmiss` metadata cache misses. No generated-output cache or token telemetry. AI job survives dashboard navigation but not browser closure. |
| Connect Gemini | User confirmation; validates key; stores encrypted credential | Provider model-list request, not generation | No token/key in logs. Status check alone must not validate by generation. |
| Check Webflow allowance | Admin + owned-site check + reader/credential | 1 W, 1 I | Existing explicit action. Point-in-time per-minute headers, no polling. Not global telemetry. |
| Refresh available Webflow sites | Reader per active authorization | `C` W, `C` I | Currently explicit `?sites`; needs freshness/cache to avoid repeating on back/reload. |
| Poll change progress | `loadChangeRequest` (3–5 Q) + health RPC | 0 W/E/G | Reconstructs full plan including occurrences just to render cursor. Then `router.refresh()` reruns parent even if no change. |

## Polling and worker detail

- Activity polls every **15s while any displayed item exists**, not only runnable work. Paused/needs-attention items can sustain the fast interval; completed items remain visible temporarily (`modules/activity/visibility.ts`). Otherwise 60s. Hidden/offline skips queries. Path changes restart polling immediately.
- ChangeProgress polls at 15s, hidden/offline guarded, stops when completed/cancelled. It refreshes the full route after every successful poll, even if cursor/status is unchanged. Paused operations still poll at the same cadence.
- Overview has no independent poll; shared ActivityPanel is the polling source. Avoid adding another timer for Quick Search or freshness labels.
- Gemini status updates on focus; usage updates on focus/job transitions. These are DB calls, not automatic Google requests.
- ScanProgress resumes a running confirmed scan on mount and has no explicit hidden/offline guard. Pausing that scheduler is a product decision distinct from hiding read-only polling: preserve durable progress and clear feedback.
- Cron SQL: `supabase/cron/cms-worker.sql` always invokes `net.http_post`. At continuous one-minute cadence: `60 × 24 × 30 = 43,200` invocation attempts in 30 days. This is arithmetic from config, **not observed provider billing**.
- The actual runnable predicate in migration 015 is `status='confirmed' AND NOT background_paused AND background_next_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) AND (retry_at IS NULL OR retry_at<=clock_timestamp())`, ordered by next time/creation with `FOR UPDATE SKIP LOCKED`.
- Conditional dispatch must mirror that predicate, including **dispatched fields needing reconciliation**. Do not filter them out as “already sent”. Authorization/connection checks still belong to the authoritative claim gateway; an existence check does not reserve work.
- Empty claim updates `cms_worker_health`. Skipping idle calls would make current 3-minute heartbeat warnings misleading. Redesign health to distinguish idle/no work, queued waiting, stale runnable work, and errors in the same phase.
- `background_cms_step` + per-field durable dispatch remain authoritative even if Cron and a future immediate kick overlap. No immediate kick or bounded batching in this phase.
- Realtime is not currently used. Keep polling initially: first avoid unchanged full-route refreshes and polling paused/completed rows every15s. Compare measured DB poll volume versus connections/messages and operational complexity before introducing Realtime; no provider pricing assumptions are needed to make that first reduction.

## Persisted search and normalization: feasibility / pitfalls

Existing storage already contains `canonical`, `raw_match`, `source_value`, source IDs, positions,
collection/item/field labels, scan `plan` including types/search options, per-collection item counts,
creation time, truncation/skipped counts, reviews, protected bindings and verified change results.
There is an index on `scan_occurrences(scan_id)` and unique source/range/canonical identity. No
normalized full-text/trigram search index was identified. Canonicalization already occurs during detection.

**A saved scan is not a complete CMS index.** It stores detected occurrences, not every CMS field/item.
A specific-text scan stores that query's ranges; broad PlainText fallback has a length cap, and
RichText detection differs by mode. Link and image canonicalization deliberately preserves exact
URLs (query, fragment, case, trailing slash). Phone/number/money rules also have locale restrictions.

Quick Search must:

1. Search the latest compatible **completed/limited saved scan**, scoped to user/site and selected collections/types. Never choose a running scan and mount its scheduler just to search.
2. Show saved-scan timestamp, scope and partial coverage; “no saved match” must not mean “not present in the CMS”.
3. Keep “filter saved groups/context” separate from “replace this exact substring”. A match in a context label does not authorize replacing that substring using a different occurrence's offsets.
4. For the first phase, deep-link the matching **existing group** into its existing inline editor. If exact target ranges are not represented, offer a targeted scan; do not fabricate editable occurrences from a context substring.
5. Use deterministic type hints. Email remains a text hint unless actual detector support is added. `$489,000` must not silently become BRL or European decimal notation. Numeric detection should reuse `numericSearchValue` and canonical schemas.
6. Treat normalized text only as a lookup aid. Never merge business values, loosen URL equality, or bypass Managed Value protections because two search keys match.
7. Use narrow DB DTOs/limited result pages; avoid copying all field snapshots into a second index. No new migration in this phase. Evaluate query plans against representative synthetic scale before proposing generated fields/indexes.
8. Keep term/filter in URL; debounce DB requests (200–350ms) only if needed and ignore stale responses. Prefer local filtering of already-loaded bounded data.

The first proposed Quick Search deliverable is therefore **search saved findings**, not a claim to search the full site.
“Run targeted scan” reuses specific-text functionality, makes scope/quota explicit, and still reads
all items in selected collections; a narrower type list alone does not reduce item API pages.

## Existing UX to keep and gaps to address

- Results + replacement + persisted inline preview + digest confirmation already exist. Context uses local `<details>`; do not replace functioning inline context with a drawer merely to match a mockup.
- Reviewed/applied occurrences are read-only, with explicit revert. Text ranges outside Managed Values can remain editable. Repeated texts are not automatically a request to centralize.
- Scan draft storage is namespaced by user/scan and validates source/original signatures. Preserve this across pagination and refresh; drop applied/protected/stale entries. Current Managed Value input has no durable draft.
- Filters/query/page exist in URLs for result/list screens. Group expansion/scroll/selection are not uniformly restored across route transitions. Browser Back is not a reliable substitute for a defined state contract.
- Run Again is missing. Reuse saved collection IDs, types, query/options/placeholder mode; validate current permission and scope at execution. One explicit final action can confirm a visibly summarized repeat, but opening or prefetching its route cannot create/consume a scan.
- Needs Attention already deep-links paused/running scans, uncertain bindings and recent operation issues. It does **not** count all pending findings or all historical conflicts. Label remains limited to the saved summary; avoid green “everything healthy” claims.
- Recent Activity already links to scans/static changes/review operations. Improve targets and small payloads rather than creating duplicate operation pages.
- Canonical resource links work, but several site/workspace links still point at internal UUID URLs before redirect. Browser confirmed final slug URLs; remove redundant legacy hops as part of UX navigation cleanup, keeping old redirects for compatibility.

## Prioritized changes, separated into phases

### A — UX using persisted/local data (next implementation phase)

1. **Quick Search on Overview**: bounded saved-results search, deterministic type hint, timestamp and scope; direct link into existing editor and explicit targeted-scan fallback. No Webflow/Gemini call, no hidden preview or scan.
2. **Repeat configuration**: load prior plan from DB, visible summary with Customize; initially keep existing confirmation backend. No collection fetch on merely opening this summary.
3. Preserve URL filters and local drafts when returning from source context. Use an accessible drawer only for context that currently requires an extra route; lazy DB detail, keyboard/focus handling, no provider.
4. Inline Managed Value editing on the list should reuse the existing detail editor/preview contract, fetching bindings from DB only on edit. Paginate source previews before exposing very large binding sets.
5. Reuse existing attention/activity links; make limitations and freshness precise. Relevant quota displayed only at preparation/confirmation.

Acceptance: exact-match, no-match, partial/old scan, query mismatch, unique occurrence, number/URL/phone hint,
protected value, two accounts/sites, Back/navigation/draft restoration, stale preview and duplicate click.
No full CMS coverage claim and no new external requests. A can ship in focused slices; do not combine all phases into one patch.

### B — Database/query efficiency

1. Split `getPlanIdentity` from full plan/capacity metrics so sidebar layouts do not compute storage/whole-account capacity unnecessarily.
2. Introduce request-scoped `getScanSite`/membership identity reuse; dedupe within a render only. Never persist session authorization across users.
3. Replace scan-list full occurrence/history loading with a narrow **correct** review-count projection/RPC. Must preserve manual flags, successful edits, reverts and search-specific review semantics. No naive `occurrences_count - reviewed_count` shortcut.
4. Narrow route redirect loader and progress DTO; stop reconstructing field plans just to display counters. Build audit/detail only on demand.
5. Aggregate activity status and paginate merged CMS/static streams with stable cursors. Attention query must not scan 2,000 full plans in app memory.
6. Group-aware results pagination. Counts and bulk actions must state scope; never silently apply hidden pages. Query-plan benchmark precedes indexing.

Acceptance: per-account isolation; before/after Q/bytes/row counts on identical synthetic dataset; consistent totals and reverse chronology; no lost review history.

### C — Reduce provider reads

1. Store authorized site display URL metadata, freshness and invalidation on reconnect; Sites target `C → 0 W` for normal open.
2. Cache collection list/schema **for display and scan setup** with explicit refresh. Initial proposed 15–30 min, adjustable after observing edits, not a universal authorization cache.
3. Distinguish expired metadata from denied/revoked access; invalidation keys include workspace/site/connection identity. Reconnect/revoke must invalidate old entries. No cross-account leakage.
4. Coalesce identical authorized in-flight metadata reads; bound size/time and clear failed promises. Do not coalesce writes or cache fresh item reads used for conflicts.
5. Inspect safety implications before reusing metadata across scan batches. Current site/collection checks enforce source ownership; a TTL must not become a bypass for revoked/moved sources.
6. Disable prefetch for remaining routes that can call providers until the loader is explicitly provider-free.
7. Add aggregate provider metrics through connectors: endpoint class/read-write/status/429/duration, operation/site scope where needed; no token/full URL query/customer body logs. Existing admin `reads` counts credential access, not this telemetry.

Acceptance: warm normal navigation 0 W; explicit refresh one deduped request; expired/revoked/reconnected cases; failed fetch and429; ownership; unchanged pre-write and required post-write checks.

### D — Polling / worker efficiency

1. Poll only useful statuses; refresh parent only on version/cursor/status changes. Retain hidden/offline behavior and signal new work through local invalidation.
2. Conditional Cron gate with authoritative runnable predicate + updated idle health model, integration tests for pauses, cooldown, live/expired leases, uncertain dispatch recovery and revoked connection handling.
3. Evaluate post-commit authenticated immediate kick as best effort. Failure cannot reverse confirmed operation; duplicate confirmation must not generate unbounded kicks.
4. Evaluate at most3–5 fields per invocation within strict shared time budget. Respect next-run/cooldown scheduling; stop after errors/429; retain per-field leases/audit and no-resend recovery. Do not change batching without tests.

Expected saving: **up to**43,200 idle HTTP invocations per30 days of entirely idle continuous schedule, while retaining1,440 cheap SQL checks/day. Actual saving requires measuring runnable/idle ratio. No saving is claimed yet.

### E — Optional AI architecture (not authorized for implementation in this program phase)

Keep existing explicit Gemini draft generation. Do not add fuzzy/semantic enrichment, automatic classification,
embeddings or recurring LLM calls. If later requested: minimum representative context, content+prompt/model
fingerprint, token usage/cache-hit telemetry without sensitive prompt logging. Generated drafts and semantic
analysis caches are different products; don't reuse a cached generated draft when the user explicitly asks for a new variation.

## Budgets and regression gates

| User action | Current baseline | Target / invariant |
| --- | --- | --- |
| Open Overview / old scan / values / changes | 0 direct W | Preserve0; additionally prove no hidden provider-prefetch calls |
| Open Sites | `C W + C I` | 0 W/I until explicit metadata refresh |
| Open New scan | `2 W +1 I` | 0 W/I from normal navigation; user-requested metadata refresh only |
| Explore CMS collection | `4 W +1 I` per load | Persisted/cache-backed display or explicit fetch; never present stale data as live |
| Search saved findings | Not on Overview; existing result filter0 W/G | 0 W/I/E/G, bounded DB/local work |
| Input / selection / context expansion | 0 W/G | Preserve0; no preview on keypress |
| Prepare replacement | Usually0 W; slug exception | Retain saved-snapshot approach and explicit slug evidence |
| Apply a normal field | `4 GET + up to1 PATCH` | Retain required safety reads and authoritative result |
| Apply managed/slug field | `5 GET + up to1 PATCH` on success | Retain readback; no fake success or automatic retry |
| Idle worker per30d |43,200 configured HTTP attempts |0 idle HTTP attempts, with cheap queue checks + truthful health |

Proposed AGENTS addition for a later implementation phase: classify external cost as A(DB/client),
B(provider read), C(provider write), D(AI); navigation and prefetch cannot implicitly refresh providers;
prefer saved data; explicit AI only; minimal payloads; preserve conflict/readback checks; measured
telemetry for new provider access. **AGENTS.md itself is unchanged in this audit-only phase.**

## Validation record

- Audit-only changes: this document, copied source guide, transport-count baseline tests.
- Browser: authenticated dashboard root → workspace Sites → site Overview → scan history → saved scan 2 Pending → Reviewed. Canonical route and filter navigation worked; Reviewed displayed Applied, Read-only, original 2000 and verified result 5000, with a revert action. No scan prepared/confirmed, no CMS or Designer field altered, no AI generated.
- Source inspection covers all dashboard route families above. Not a full browser QA of every route/state. Mobile layouts, keyboard/focus drawers, live429, cross-user browser sessions, remote Cron state and production prefetch remain to validate during relevant phases.
- New tests in `src/modules/sites/service.test.ts` measure current metadata costs and repeated reads without real provider access. These deliberately document baseline expectations and must be updated when optimized; they are not desired permanent budgets.
- Validation passed: 671 tests across 107 files, ESLint, route type generation + TypeScript, and production build (`next build --webpack`). Existing tests cover snapshot/digest rejection, confirmed-only execution, idempotency, field conflict/readback, URL/RLS isolation and worker recovery. These automated checks do not replace the untested live scenarios listed above.
- Request reduction **this phase: 0**. New recurring/provider/AI calls introduced: **0**. All production safety behavior preserved because production code is untouched.
