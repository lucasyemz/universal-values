> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Phase B — query efficiency plan

Baseline: `154a0ed` (2026-09-23). Phase A accepted; B only. No C/provider caching, D/poll cadence or worker changes, E/AI work. Q counts PostgREST table requests/RPCs, not statements inside PostgreSQL; Auth/proxy/layout and canonical-link queries are accounted separately. All slices keep W/I/E/G delta at zero. No production credentials, writes, quota operations or provider requests are used for measurement.

## Inspected contracts

Read `AGENTS.md`, `api-ux-cost-audit.md`, `dashboard-phase-a.md`, `scans.md`, `cms-changes.md`, `managed-value-sync.md`, `inline-review.md`, `sequential-scan-edits.md`, `cms-change-queue.md`. Code is authoritative where older documentation differs: reviews are read-only; applied IDs, reversals, targeted numeric searches and independent managed text ranges must remain intact.

## Proposed focused slices (before implementation)

`S` <=5 scan rows/page, `O` <=1,000 occurrences/scan, `H` history pages of 200, `B` bindings, `L` existing canonical-link queries. Empty result sets may skip queries. The figures are static successful-path counts, to be backed by synthetic measurements below; they are not production billing claims.

| Slice / exact target | Current Q and rows/payload | Proposed Q and rows/payload | Security / semantic risk | Required tests |
| --- | --- | --- | --- | --- |
| 1 Shared identity + operation routing: auth/service, sites/service, scans/service, routes/links, changes/[id] | Repeated Auth verification and site+owner (2Q per call). Redirect 4Q scan / 5Q revert; full request JSON, source_history and <=1,000 occurrences | React request-only cache for identity/owner/site; redirect 3Q: routing row + owning resource/site + membership, <=3 narrow rows; no plan reconstruction | Never share auth across requests or cache credentials; require actor AND current owner; preserve scan/site validation and error redirects | Missing/foreign request, wrong owner, scan/site mismatch, valid CMS/sync/revert, request-scope boundaries; all existing URL tests |
| 2 Scan summaries: sites/page-service and new DB read projection | 3Q + S*(2+H)+L; scan `*`, <=5,000 full snapshots, manual ID results, all operation changes/results/source payloads | Site+owner 2Q + list 1Q + summary RPC 1Q + L; <=5 scan list DTOs + <=5 summary rows | Count the exact eligible group set, NOT raw occurrences_count minus reviewed. Union manual IDs and successfully applied/reverted IDs; protected occurrences remain counted; targeted numeric singleton rules match JS | Differential SQL vs existing groupScanResults/countReviewedOccurrences/loadReviewState semantics; manual unreview, partial apply, revert, MV, typed/specific/limited, two owners; EXPLAIN ANALYZE fixtures |
| 3 Activity + Overview: sites/page-service, changes page | Changes 2Q +1–2 streams+L; up to page*5+1 per stream or 2,000 full rows for attention. Overview 10Q+L, two site checks, full static plans/events and CMS results | Authorized read projections + merged stable cursor query: 2Q+1Q+L, <=6 narrow events; Overview narrow counts + recent LIMIT5, no source/plan/history bodies | security-invoker views/functions honoring RLS; sort timestamp DESC + deterministic source/id tie; old attention window of latest five changes preserved on Overview | SQL/JS parity of static verified/reported/conflict/expiry and CMS attention; mixed/equal dates, pagination, no duplicates, foreign site; EXPLAIN evidence |
| 4 Progress: scans/change-actions + narrow DTO | 4–6Q (+1 queued count), full request/plan and <=1,000 occurrences + source_history, just to poll | Narrow progress row + existing owner check + health + queue count; no sources/results bodies. Include retry_at/updated_at. Keep 15s timing and existing refresh behavior | Read only, same actor+ownership, no weakened confirmation; projected verified/issues equal existing result filters | Progress of ordinary/MV/revert/cancelled/paused; no planner/provider call; queue position parity |
| 5 Managed sources: sites/page-service, managed-values/context-actions + list DTO | List 3+B+L, up to 1,000 binding IDs; context 5+A+L, all binding snapshots +20 operation histories, then slice ten | List aggregate binding count/uncertain in narrow projection. Context current value + owner + paged bindings count + active flag; <=10 source rows, no unrelated histories; archived JSON sliced in DB | Preserve 50-source editing threshold, archived/active/uncertain protections. Full mutating preview still obtains authoritative bindings. Actual detail mutation contract stays intact | Paging 0/10/11/50/51/1,000; archived, foreign value/site, active-operation state; no partial-scope sync |
| 6 Group-aware pagination design: docs and result-scope contracts | Result loader <=1,000 occurrences + entire history/bindings; groups formed before filter | Design only in this phase unless evidence demonstrates safe implementation: immutable group cursor, one full group/page (oversized explicit), selected IDs restricted to loaded groups, existing draft signatures retained | Never split a group or include hidden IDs; global counters separated from page selection; avoid duplicating replacement logic in SQL | Document exact grouping/key/range/draft/refresh/invalidation requirements and rollout tests; do not claim unimplemented savings |

## Query-plan / migration gate

Before adding a migration, run representative existing queries on a local PGlite database with the actual migrations and synthetic authenticated tenants. Record EXPLAIN (ANALYZE, BUFFERS) where supported, rows and serialized result bytes. Run proposed projections on the same fixtures. No new index unless observed plan evidence justifies it. Prefer existing site/scan/source indexes; an index does not remove large JSON transfer. Check authenticated owner/member/foreign/anonymous access with actual RLS, not just mocked filters. No remote schema change in this task.

Read-only aggregate RPCs may use the existing owner-checking review function; any SECURITY DEFINER function must explicitly require auth.uid, actor/site ownership, fixed search_path and restricted grants. Prefer SECURITY INVOKER otherwise. New DB APIs must fail clearly when migration is missing; never silently report zero counters.

## Acceptance and reporting

After every implemented slice: lint, typecheck, full tests, production build. Append measured Q/rows/bytes, scope of measurements, W/I/E/G before→after (all 0→0 for touched DB-only paths), behavior checks and remaining risks. Existing provider-reading routes keep their current behavior; no credential cache, provider prefetch, worker kick, altered poll frequency or AI call. No changes to real customer content.

## Slice 1 result

Implemented request-local React `cache` for `requireUser`, `requireWorkspaceOwner(workspaceId)`, `getScanSite(id)`. No module Map, TTL, credential caching or cross-request session state. Namespace functions already use request cache and were retained. CMS redirect now uses request identity + scan identity + owner (3Q vs4 scan/5 reversal); Managed Value redirect uses request identity + site + owner (3Q, unchanged count, narrow request). Scan redirect rows: <=1,003 →3; no occurrence/source_history/result payload. Ownership, actor, matching scan/site/workspace and legacy error context remain checked. Added four routing tests and updated existing redirect tests. Lint/typecheck/722 tests/build passed. W/I/E/G 0/0/0/0→0/0/0/0. React memoization applies only inside the rendering request; no savings claimed outside React's cache dispatcher.

## Baseline evidence for slice 2 (before its migration)

`tests/database/phase-b-baseline.test.ts`, local PGlite with all actual migrations, two authenticated owners, six scans and 6,000 occurrences (1,600-character source bodies,100 groups/scan): the existing query `SELECT * FROM scan_occurrences WHERE scan_id=$1 ORDER BY id LIMIT1000` returns1,000 rows /2,217,594 serialized bytes. Five rows of scan history therefore transfer5,000 occurrences /11,087,970 bytes **before** operations and manual-review rows. Existing `scan_occurrences_scan_idx` is used (Bitmap Index Scan →250 heap blocks →quicksort,2024kB). Execution2.699ms in this embedded fixture is not a production latency estimate. Foreign-owner scan query returned zero rows under authenticated RLS. No new index is justified: the dominant measurable cost is wide result transfer, not a missing scan index.

The summary RPC will return one row per requested scan. Numeric singletons are returned as a small candidate array (`collection_id,number,reviewed`) because JS `numericSearchValue` intentionally rejects imprecise/exponent conversions; retaining that tested code avoids subtly different PostgreSQL float formatting. Ordinary group membership/review aggregation remains in PostgreSQL. Worst case1,000 numeric candidates is bounded and contains no text snapshots/ranges; no claim of constant byte size is made for that case.

## Slice 2 result

Lint/typecheck/full728 tests/production build passed. Q minimum18+L→4+L for five completed scans; occurrence rows5,000→5 aggregate rows; fixture summary payload581 bytes vs11,087,970 occurrence bytes alone. Numeric singleton worst case remains bounded as documented. Local FunctionScan EXPLAIN:5 output rows,2555 buffers,135ms; this includes review aggregation and is **not** comparable to timing the former occurrence SELECT alone. No claim of reduced SQL CPU or production latency. Existing review RPC acquires a scan lock; this inherited behavior remains a contention risk to measure in deployment. Explicit manual, successful, partial, reverted, targeted numeric/text and limited semantics are tested against the prior implementation. Migration is local only. W/I/E/G0/0/0/0→0/0/0/0.

## Slice 3 baseline evidence

`phase-b-activity-baseline.test.ts`: actual schema,300CMS+300static changes,1600-character static body, page20. Existing two prefix queries return202 rows/215,932 bytes even with empty CMS results/static event arrays. CMS EXPLAIN uses an authorized sequential scan of300rows and top-N sort (9buffers,~0.75ms locally). This does not justify a new index; narrow transfer and bounded output are the target. Recent Overview already has small scan rows but invokes the wide changes stream; the proposed JSON summary keeps count scalars and at most five narrow recent records, never plans/snapshots/audit bodies.

## Slice 3 result

Lint/typecheck/729 tests/build passed. Changes Q4+L→3+L (site+owner+one RPC); <=202 wide rows on fixture page20→6 narrow rows including lookahead. Additional smaller parity fixture:6rows/1642bytes, EXPLAIN22buffers/~4ms; these timings are not cross-fixture comparisons. Overview Q after request memoization8+L→3+L, one narrow summary with recent5 and combined activity5; scan counts/running/uncertain links retain their scopes. The attention filter retains the latest1000 per source boundary. Added SQL/JS state parity, observed-value verification, foreign/anonymous access and equal-date forward/back cursor tests. Cursor is untrusted pagination state, never authorization. No provider/credential/Edge/Gemini calls, W/I/E/G0→0 each. Remote migration and authenticated visual check remain pending.

## Slice 4 migration rationale

Polling currently calls the same full-request/occurrence loader measured in slice2: request JSON plus up to1000 source rows and, for reverts, the parent request. Actual progress consumer only reads status/cursor/counts/pause/error/queue. New invoker RPC uses existing request PK, results aggregate and audit request/action/step index; no new index. Its EXPLAIN and owner/foreign tests are captured locally. `updatedAt` means latest recorded audit transition (fallback creation); no claim that it timestamps unaudited lease/cooldown updates. `retryAt` is separate. Existing worker-health read and poll cadence are unchanged.

## Slice 4 result

Lint/typecheck/730 tests/build passed. Poll Q4–7→2 (progress+existing health), <=1000 occurrence rows plus request/parent→one198-byte measured DTO plus health. Tests cover queue order, conflict/pause/retry, success counts, lost owner and foreign actor; action test asserts the full request loader is never called. EXPLAIN24buffers/~3.4ms on1000-occurrence fixture. Audit timestamp limitation remains as stated. Poll interval unchanged; W/I/E/G0→0 each.

## Slice 5 baseline evidence (before migration)

`phase-b-managed-baseline.test.ts` uses actual schema/RLS,1000 bindings with1607-character sources. Existing `select * where managed_value_id=$1` returns1000rows/2,189,001bytes; EXPLAIN sequential scan251buffers/~1.1ms (all fixture rows belong to that value, so sequential scan is appropriate). Existing managed_value_bindings_value_idx and cms_changes_managed_value already support narrower selection. No index added. New context returns ten sources and count, with source identity ordered by ID; read pagination does not restrict authoritative mutation scope. List projection selects only existing savedValueSchema fields and aggregates bindings in DB. Archived snapshots are sliced inside DB in original ordinality, preserving their order. Active-operation detection keeps the current latest20-history scope.

## Slice 5 result

Lint/typecheck/733 tests/build passed. List Q4+L→4+L, up to1000 binding rows→at most5 count rows. Context Q5(+archive)+L→1+L;1000 bindings/2,189,001bytes→10 sources/18,388bytes in the same fixture (counts/value included in after). EXPLAIN520buffers/~1.8ms; count still reads DB rows, no claim of lower DB CPU. Archived/uncertain/active protections and50-source in-panel threshold retained. Tests include0/1/10/11/50/51/1000, paging, foreign/member/anonymous, archive and confirmed sync. Full sync detail still loads authoritative bindings because its mutation preview needs them; no partial-source apply introduced. W/I/E/G0→0 each.

## Final inspection slice (proposed before edits)

The floating activity panel still transfers up to50 complete `results` arrays to derive one issue flag. Reuse the already-tested security-invoker CMS summary view: Q4+L unchanged, <=50 rows unchanged, results JSON→integer issues. Same actor filter, tracked-ID limits, health read and cadence; required action/model/RLS tests. Review the scan summary against protected sources, specific-search review carryover, URL equality and first-success result selection. These are parity tests/refinements, not new replacement behavior. Also ensure recent Overview identity selection does not compute full summary JSON twice. No new indexes or external calls.

## Group pagination / UI scope

See `phase-b-group-pagination.md`. This requested design is complete; runtime group pagination is deliberately not enabled. Existing whole-group/range/draft/selection behavior and1000-occurrence cap remain intact. No savings are attributed to an unimplemented feature.

| User task | Before → after |
| --- | --- |
| Open scans or Overview | One navigation → one navigation; same counts and cards |
| Next/previous Changes | One click → one click; cursor preserves chronological boundary; old `page` links still work |
| Monitor operation | Automatic refresh → same automatic refresh interval; no new execution trigger |
| Open Managed Value sources | One click → one click; same ten-source pages; DB now retrieves only that page |
| Edit in source panel | Same <=50-source threshold, preview/apply contract and server validation |
| Review/apply/revert scan occurrences | Unchanged; no hidden-page selection or range rewriting introduced |

## Deployment and remaining validation

Apply migrations `20260923000100` through `20260923000400` in order before deploying this application version. They add read projections/functions only; no new indexes, customer content changes, provider credentials, quota writes or execution triggers. `cms_operation_summaries` and `site_change_summaries` are security-invoker views. Read RPCs use the authenticated client; summary ownership is explicit where a definer helper is used. Missing projections fail closed rather than inventing zero counts. Deployment rollback can restore the previous app while leaving additive DB APIs in place.

No remote migration, authenticated browser validation or customer write was performed. Local PGlite runs the real migrations with synthetic owners and RLS; it does not prove Supabase production latency, concurrent lock contention or deployment schema-cache behavior. Check the new read screens and progress once migrations are deployed. Read access should work for the current owner and fail after ownership removal. Summary helper inherits the existing review-read scan lock, bounded to five scans; monitor contention before larger batches. Detail/mutation routes intentionally retain authoritative plans and bindings. Authorization memoization relies on React's request dispatcher, never a process-wide user cache.

The `updatedAt` polling field is an audit-transition timestamp, not a new last-write database column. Attention keeps its existing1000-per-source window and Overview its latest-five-change scope. Numeric singleton payload can contain up to1000 small candidates. All performance measurements are synthetic serialized responses, excluding transport overhead and unchanged canonical-link queries (`L`); no production billing or SQL CPU reduction is claimed.

## Final verification and measurements

Final lint, typecheck, **738 tests in127 files**, production webpack build and `git diff --check` passed. Final regression cases cover protected occurrences, specific-search reset vs generic carryover, exact URLs, ECMAScript/Zod text trimming, first-success history semantics and malformed cursors. Activity panel Q/row cap unchanged; complete result arrays replaced by scalar issues. No application mutation/confirmation contract or polling cadence was changed.

Representative plans and serialized response measurements are committed as `docs/qa/phase-b-query-measurements.json`; regenerate by running the Phase B database tests. Same600-event fixture: Changes page20,202rows/215,932bytes→6rows/1,681bytes. These are payload measurements, not a claim of lower PostgreSQL execution time.

| Path | Q before → after (excluding unchanged L) | Transferred rows/payload | W/I/E/G delta |
| --- | --- | --- | --- |
| Five completed scans | minimum18→4 | 5000 snapshots→5 summaries;11,087,970→581bytes in ordinary fixture | +0/+0/+0/+0 |
| Overview | 10→3 from baseline;8→3 after slice1 memoization | full change bodies removed; recent5, activity5 and narrow counters | +0/+0/+0/+0 |
| Changes page20 | 4→3 | 202→6;215,932→1,681bytes | +0/+0/+0/+0 |
| Operation progress | 4–7→2 | full request/<=1000 sources→one198-byte DTO plus existing health | +0/+0/+0/+0 |
| CMS redirect | 4 ordinary/5 revert→3 | <=1003 rows→3 identities; no snapshots | +0/+0/+0/+0 |
| Managed list | 4→4 | <=1000 binding IDs→<=5 count records | +0/+0/+0/+0 |
| Managed source panel | 5–6→1 | 1000→10sources;2,189,001→18,388bytes | +0/+0/+0/+0 |
| Floating activity | 4→4 | <=50 change rows retained; result arrays→integer issues | +0/+0/+0/+0 |
| Group pagination | design only | no runtime savings claimed | +0/+0/+0/+0 |

Phase C, D and E remain unauthorized and untouched. Remote deployment and browser smoke checks remain pending as described above.

## Remote deployment — 2026-09-23

At the user's explicit request, applied all four Phase B migrations to the linked `Universal Value` project (`nxibjpprjorchjeoudss`). Remote migration history confirms versions20260923000100–20260923000400. Verified all six new functions grant execution to authenticated and deny anon, and both summary views have `security_invoker=true`. This supersedes the earlier remote-migration pending status; authenticated browser smoke checks still remain pending.

The remote CLI history had no entries for the older, manually applied schema. Used a temporary CLI workdir containing only these four migrations, dry-ran that exact set, then pushed it successfully. Did not replay or mark older migrations as applied without a separate schema audit. A future ordinary `db push` from the full repository must reconcile that historical discrepancy first. No customer content or external-provider operations were changed by this deployment.
