# Phase C — provider-read reduction plan

Baseline `7ffa64d`. Phase C only; no AI, worker/Cron, polling, publishing, write conflict/readback changes. Read the audit, Phase B report, scans, CMS changes, Managed Value sync and AGENTS. W=Webflow HTTP request, I=credential RPC; normal navigation costs exclude explicitly confirmed scan execution. E/G delta must stay zero.

## Proposed slices (before implementation)

| Slice / files | W/I before → proposed | Key / TTL / invalidation | Authorization and stale UX | Risks / tests |
| --- | --- | --- | --- | --- |
| 1 Persisted structure and connector telemetry: new metadata schema/service, migration, Webflow client/writer telemetry | Infrastructure alone unchanged. Explicit site refresh1/1; collections refresh2/1; selected schema refresh3/1 | actor+workspace+site+connection+generation+kind+collection.15min freshness hypothesis; no automatic stale refresh. Explicit refresh replaces relevant entries; site/connection/credential changes invalidate generation and data | Current DB owner, current connection actor/status/site binding checked on every cache read/claim/save. Cache never grants remote access. Missing, expired, denied, unavailable and429 are separate states | RLS two accounts/member; reconnect race; concurrent refresh; failure clears flight; bounded leases; secret-free logs; Retry-After preserved |
| 2 Sites + New Scan: sites/service, scan service/actions, respective pages, metadata refresh control | Sites C/C→0/0 on normal open; New Scan2/1→0/0 on warm OR cold open; Review2/1→0/0 | Persist site display URL/name/image/locales and collections separately. Collection schema is fetched only when explicitly requested, not all collections eagerly | Display saved time. Cold/expired setup asks explicit refresh; review requires fresh stored collection list and current DB authorization; preview/confirmation still uses existing RPCs. Execution retains live ownership validation | Zero provider/credential/quota on GET/prefetch; review stale selection; expired is not forbidden; API errors never trigger hidden refresh; bilingual UX |
| 3 Explorer + prefetch: CMS page, explicit live-items action/component, settings discovery and links | Warm/cold structure navigation2–4/1→0/0; explicit live item page retains4/1 safety reads | Same saved site/collections/schema/locales. Items never persisted in structure cache; live response held only in mounted UI with fetched time | Cached structure clearly separated from explicitly loaded staged content. Every live page validates fresh sites+collection ownership+schema+items; no URL flag can invoke live loader from prefetch | Two sites with multi-site token, changing tabs clears content, pagination explicit, errors/429 no retries; provider-reading discovery routes no speculative prefetch |
| 4 Scan batch schema reuse: scan service/runner adapter | 4/1→3/1 on fresh schema hit; cold/expired4/1 | Same scoped cache, schema only. Confirmed batch can populate/reuse schema as part of existing authorized scan work; no new background refresh or scheduling | KEEP fresh sites and collections per batch: currently necessary to detect moved resources with a multi-site token. KEEP fresh item page. Current DB owner/connection checked before credential access and save. Cached schema only controls detection; writes retain fresh schema/item checks | Moved collection, revoked token, replaced connection, changed schema, TTL boundary, limits/ranges, paused429; full write-safety regression suite |

## TTL decision and authorization boundary

15min is a **starting freshness ceiling**, not observed provider stability. Selected over30min because existing scan previews expire after15min; this caps setup drift within the existing review horizon. No evidence yet supports a longer duration. Collection display can remain visibly stale, but new setup preview requires an explicit refresh when expired. Source authorization has **zero TTL**: live site and collection ownership checks are retained for content reads and scan batches, and all existing write checks are unchanged. A stale schema can miss recently added fields during a scan; existing partial-scan coverage remains explicit. Manual refresh before scanning forces current structure. Tune only after telemetry and observed schema churn; no claim of measured optimal TTL.

No token/credential is stored in metadata or a cross-request credential cache. In-flight promises hold only an active refresh and are discarded on settlement. Keys include the current invalidation generation. Cross-process leases prevent duplicate provider refreshes; contenders receive a busy result or reuse a completed cache entry, never start a second request. Expiration alone never means revoked access. Provider401/403 mark the cached scope denied and discard usable metadata; connection revocation/replacement invalidates at the DB layer, including refresh results arriving late.

## Telemetry contract

Connector emits structured bounded events: action classification, endpoint class, GET/read vs PATCH/write, numeric HTTP status (0 transport failure),429 flag,duration, optional internal site/workspace IDs. Never token, headers, body, full URL/path/query, arbitrary operation labels or customer strings. No separate telemetry HTTP/Edge/Gemini requests; use structured server logs. Explicitly label metadata refresh, scan batch, live Explorer, and other existing connector calls as unclassified where action is unavailable. Do not modify AI context/cache behavior to improve labeling.

## Gates and deployment

Each slice: lint, typecheck, full tests, webpack production build; mocked W/I budgets, persisted-cache RLS/invalidation tests, cache miss/hit/expired/denied/reconnect/429 cases. No real customer content writes or live provider test requests. Record limitations honestly. Migration is additive and local until explicitly requested to deploy. Prior remote migration history contains only Phase B; do not blindly replay historical migrations with a normal db push.

## Slice 1 results

Lint, TypeScript, full suite (741 tests / 129 files), production webpack build passed. Local PostgreSQL-compatible fixture applies all migrations and verifies denied cross-account/member/anonymous access, revocation, credential invalidation, late-save rejection, lease contention, cooldown. Connector tests verify 429 is passed through and telemetry failure never retries or changes a write. Existing routes unchanged: W/I delta0, E/G delta0. No live provider or customer writes tested; migration not deployed.

## Slice 2 results

Sites uses saved metadata: C W/C I →0 W/0 I, including cold opens. New Scan and preview configuration:2 W/1 I →0 W/0 I each. Missing/expired collections require explicit refresh (2 W/1 I); site display refresh1 W/1 I. No automatic refresh or scan creation on navigation. Saved timestamps shown, names/URLs from saved metadata, current DB checks on every cache access. Denied and expired states remain distinct. In-process refresh coalescing and database lease prevent duplicate work; cooldown prevents credential access. All item/write paths unchanged. E/G +0.

Slice 2 gates: lint, TypeScript, 744 tests/130 files, production webpack build passed. Added missing/warm/expired no-provider budgets and explicit concurrent refresh/cooldown tests. Review uses `loadScanCollections` cached contract; final execution still checks the provider. No real provider refresh or remote migration performed.

## Slice 3 results

Explorer GET and collection navigation:2–4 W/1 I →0 W/0 I (cold as well as warm). Explicit live-items load/pagination stays4 W/1 I, preserving fresh source/schema checks. Item content is not persisted and switching collection clears the local response. Cached fields/locales and live response time are visibly separated. Settings discovery no longer runs from `?sites=1` GET; only its button invokes C W/C I. No route page calls a provider-reading site service now; collection TabLinks retain prefetch=false. No automatic retry, no frequency changes. E/G +0. Existing tests retain foreign-collection rejection, revoked provider access and credential denial before reads. No customer writes.

Slice 3 gates: lint, TypeScript, 744 tests/130 files, production webpack build passed. Browser validation against the connected project remains pending migration; no claim of live UI/provider verification. Explicit content pagination remains live, cache is not represented as live items.

## Slice 4 results

Batch schema adapter runs only after fresh site/collection authorization. Warm schema4 W/1 I →3 W/1 I; absent/expired schema4 W/1 I →4 W/1 I (fills the cache with metadata already read by that batch). Current owner/connection/generation are rechecked via the scoped RPC. It never caches item bodies, writes, conflict reads or readback. Concurrent schema lease contention pauses using the existing batch retry contract rather than duplicating a schema request. Existing polling and worker code unchanged. Source rejection happens before schema/item reads for a moved collection. Explicit collection refresh invalidates stored schemas and in-flight schema leases. E/G +0.

Authenticated owners can call the cache RPC directly, so its data is explicitly lower-trust display/detection input, not provider permission evidence. Fresh source membership, fresh item reads and unchanged independent write validation remain required. Cache payloads are Zod-validated on read, including site/schema identity. In-flight map contains only refresh promises and is keyed by actor, workspace, site, connection and generation; it is removed on success/failure.

## Final validation and cost table

Slice 4/final gates: lint, typecheck, **750 tests across131 files**, production webpack build and `git diff --check` passed. Warm/cold runner results compare equal, including all occurrence ranges. A moved collection is rejected before the cache callback/items read. Additional DB tests cover explicit refresh invalidation of active schema leases and connection replacement. All existing CMS/Managed Value write-safety regressions remain green.

| Product action | Before W/I | After W/I | Notes |
|---|---:|---:|---|
| Sites GET | C/C |0/0| Cold/warm; no hidden refresh |
| New Scan GET |2/1|0/0| Cold/expired asks refresh |
| Prepare/review scan |2/1|0/0| Current owner + fresh saved structure; provider membership at execution |
| Explorer metadata GET/navigation |2–4/1|0/0| Cached schema/list/site/locales |
| Explicit live item page |4/1|4/1| Fresh ownership/schema/items preserved |
| Confirmed scan batch, warm schema |4/1|3/1| Fresh sites, collection membership, item page |
| Confirmed scan batch, cold/expired schema |4/1|4/1| Fills cache as part of this authorized batch |
| Explicit site / collections / schema refresh |—|1/1,2/1,3/1| New explicit controls replace navigation reads |
| Site discovery GET |C/C when requested|0/0| Explicit discovery action remains C/C |
| All writes/conflict checks/readback |existing budget|unchanged| No caching/coalescing |

E/G delta is0 for every slice. Cache adds narrow Supabase lookups (one per requested metadata scope, including one per site on the Sites list; claim/finish on misses/refresh) in exchange for fewer provider/credential reads. No full occurrence plans or item content are included. An explicit schema refresh followed by explicit live-items load costs3+4 reads; the live content path deliberately retains its independent safety reads. Do not claim it is a one-read live browser.

Remaining validation: apply `20260923000500_webflow_metadata_cache.sql` once to the intended Supabase environment before using these changed routes, then verify the visible controls with a test account/site. This turn did **not** deploy that migration, call the real Webflow API, or modify customer content. Local schema/RPC/RLS tests are not a claim of remote deployment or authenticated browser QA. Remote historical migration bookkeeping remains as described above.

TTL and lease bounds:15min matches the existing setup-preview horizon as a conservative initial bound, not a measured optimum. The90s metadata lease accommodates at most three sequential15s provider timeouts plus DB processing, and prevents crashed refreshes from blocking indefinitely. It is not an authorization TTL. In-memory pending refreshes are bounded to100 and removed on settlement. No timer initiates provider work.

Operational telemetry: filter server logs where `provider="webflow"`, group by `action` and `endpoint`, sum read/write events and429, inspect `durationMs`. Metadata refresh, scan batches and Explorer live reads are labeled; legacy integration/AI/worker actions remain `unclassified` to avoid changing those paths in this phase. No telemetry exporter, Edge request, customer body, path/query, credential or secret is emitted.

Phase D and E have not been started.

## Remote migration deployment — 2026-09-23

After explicit user authorization, applied only `20260923000500_webflow_metadata_cache.sql` to linked project `nxibjpprjorchjeoudss`, confirmed against the application's Supabase host. Isolated workdir included the four already-recorded Phase B migrations and this migration; dry-run selected only Phase C. No historical migrations were replayed or marked applied.

Read-only post-deployment verification confirmed the migration record, RLS on both new tables, all three invalidation triggers, authenticated RPC execute allowed, anonymous execute denied, direct authenticated cache-table SELECT denied. No Webflow call or customer-content write performed. This supersedes the earlier migration-pending note; live UI/provider validation remains separate.
