> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Phase D — polling and background worker efficiency

Scope: Phase D only. Phase C accepted and deployed. No Phase E, AI/MCP, provider-monitor reads, publishing or remote migration deployment. Read AGENTS, Phase C plan, API audit, background sync, CMS changes and Managed Value sync. Existing uncommitted Phase C work is preserved.

Q counts table/RPC requests, excluding auth/shared route resolution and SQL statements inside an RPC. E counts Edge invocations. W/I are per executed field, not per wall-clock minute: accelerating confirmed work must not be misreported as free provider execution.

## Implementation order and budgets (before coding)

| Slice | Current behavior / Q,E | Proposed behavior / Q,E | Correctness, health and tests |
|---|---|---|---|
| A Narrow progress | Phase B `operation_progress` already narrow;2Q/poll including health, every15s; every success refreshes full parent route | Keep narrow DTO;2Q/poll, full parent refresh only meaningful status/cursor/audit-version/paused/results changes.15s active,60s paused, stop terminal; hidden/offline pause+wake. E0→0 | Never execute from polling. Compare version signature; one terminal refresh/callback; no overlaps; wake/resume. Pure policy and fake-timer scheduler tests plus action DTO budget. No plans fetched |
| B Activity cadence |3Q+names/links per poll,15s if any visible item (even paused/completed);60s empty | Same per-poll bounded queries,15s only active work;60s attention/idle; completed visibility timer is local. Local invalidation after explicit actions wakes polling. E0→0 | Preserve hidden/offline guards; avoid double polls on wake; completion stops fast cadence; no AI scheduling changes. Test policies, completion visibility, invalidation and race cleanup |
| C Cron gate + health | Every minute E1 even idle; empty claim Q1 updates heartbeat. Health old3min heartbeat rule | One cheap SQL EXISTS each minute; idle E1→0 and idle claim Q1→0. Runnable E1 unchanged. Shared exact queue predicate used by claim+gate. One scoped health RPC replaces heartbeat RPC (same Q) | Predicate must include FIFO actor/site blockers, due next/retry, expired lease and dispatched reconciliation. Gate never claims/credentials. Health idle/waiting/processing/stalled/cooldown/error/attention based on queue, not empty heartbeat. Auth isolation, paused older blockers, lease expiration,429, revoked work, dispatch recovery. New local migration, Cron SQL fixture tests. No new index without evidence |
| D Best-effort kick | Confirmation enqueues only;0E, latency up to cron tick | Post-success server action: +1Q attempt, at most1 accepted kick per operation;0..1E to accelerate confirmed runnable work. Duplicate failures/successes bounded durably; cron always recovers | Auth owner+actor+confirmed; no client-supplied secret, no browser Edge access. Use existing Vault/pg_net private invocation gateway, catch failure independently after confirmation transaction. Unique operation kick record; authorization failure never invokes. Test duplicate/conflicting confirmations and lost kick/error fallback |
| E Bounded batch evaluation |1 field/invocation; successful field3Q claim/dispatch/finish,1I,4GET+PATCH (managed/slug +readback) | Evaluate max3 sequential fields under existing90s total fetch deadline. Keep5s scheduling gap, don't start another field with <60s budget; stop on idle/failed/conflict/uncertain/error/429. For N quick eligible fields E=N→ceil(N/3), normal Q3N unchanged (+at most one empty claim); safety W/I per field unchanged | Fresh claim/context, per-field lease and dispatch, unchanged executor. No parallel writes, no resends, no bypass scheduled/retry time. Fake clock/time-budget tests, full SQL recovery suite, Edge bundle build. If strict bound cannot be safely met retain1 and document evaluation |

## Planned files

A: `modules/scans/progress.ts`, new shared polling policy/scheduler under `modules/activity`, `components/scans/change-progress.tsx`, tests. B: `components/layout/activity-panel.tsx`, activity policy/local invalidation, explicit action clients as needed. C: new `supabase/migrations/20260923000600_worker_efficiency.sql`, `supabase/cron/cms-worker.sql`, health schema/service, change/activity actions, translations, DB/Cron tests. D: authenticated kick RPC in separate migration007, server-only helper, `scans/inline-actions.ts` and `change-actions.ts`, tests. E: worker batch orchestrator, `connectors/supabase/edge-worker.ts`, Edge tests/build script unchanged unless necessary. Update background docs and this report with gates and actual budgets.

## Authority and timing

Use the latest queue migration022003, not the older audit predicate alone. A candidate is confirmed, not paused, due by background_next_at, lease/retry elapsed, and has no earlier confirmed operation for same actor OR site. Do not filter dispatched=true. Revoked ownership/connection must still reach the existing claim validation and durable pause; gate does not retrieve credentials or decide authorization.

Health checks only the caller's owned operations and never reads provider credentials. No confirmed work means idle even without heartbeat. Scheduled/retry future means waiting/cooldown; active lease means processing; runnable overdue beyond3min means stalled (existing conservative warning horizon, now tied to actual work). A stale global heartbeat cannot mark idle unhealthy or another tenant healthy. Worker errors and manual attention remain distinct. No claim from health.

Kicks are optional infrastructure: missing migration, missing Vault/pg_net, failed HTTP queueing or worker failure never reverses successful confirmation. The existing cron job remains recovery. Migration deployment, Cron SQL installation, Edge deployment and activation are **not authorized** in this turn.

## Validation gates

After EACH slice: lint, typecheck, full tests, production webpack build. Record Q/E and W/I/G, tests and limits. Use synthetic PostgreSQL/PGlite and fake provider transport only; no real customer mutations. Final Edge build validates packaging only, not remote deployment. W/I/G delta for monitoring is0; execution retains exact per-field budget. No claim of production cost or latency measured from mocks.

## A — results

Lint/typecheck/full753 tests in132 files/production build passed. Progress remains2Q/poll, active8Q/min; paused8→2Q/min; terminal→0 after final observation. Eliminated unchanged parent refreshes (variable parent-route Q avoided); version/cursor/status changes still refresh and terminal callback runs once. Hidden/offline do not poll; wake resumes; one in-flight request. E0→0,W/I/G +0. Existing Phase B DTO reused with no plan reconstruction. Tests cover unchanged signature, cursor/version/pause transitions, cooldown, terminal stop, hidden/offline, coalesced wakes and disposal.

## B — results

Activity now chooses15s only while returned work is active. Paused/attention/completed-only lists use60s: recurring3+L Q per15s → per60s (at least12→3Q/min). Active cadence unchanged. Completion visibility expires locally after15s without a DB call. Change confirmation/progress/resume emits a coalesced local notification so an idle panel need not wait60s. E0→0,W/I/G +0; no change to AI jobs or status calls. Per-event observation is intentional, bounded by the shared single-flight scheduler.

B gates: lint/typecheck754 tests/production build passed.

## C — results

Lint/typecheck758 tests/production build passed. New migration006 shares the latest FIFO predicate between claim and the read-only EXISTS gate. Explicit outer confirmed/not-paused filters retain compatibility with existing partial indexes; no speculative indexes added. Cron script checks before Vault/HTTP, preserving its schedule and activation state. Idle minute:1E+1 empty claim RPC→0E+0 claim RPC, still one SQL gate. Up to43,200 idle invocations/30days avoided if entirely idle, not a billing measurement. Health remains1Q (2Q combined progress,3Q+links activity), now tenant/operation-scoped and based on queue state. W/I/G +0. Tests cover idle with no heartbeat, future schedule, lease, cooldown, paused, worker error, overdue runnable, FIFO blockers, no reservation by gate, dispatched recovery, revoked connection and foreign health access. Health adds queued for runnable work awaiting dispatch; waiting/stalled/cooldown do not keep fast polling. No migration/Cron/Edge deployment performed.

## D — results

Post-commit inline and legacy confirmations call a best-effort authenticated RPC. Added1Q/confirmation attempt; E0→at most1 accepted immediate invocation per operation, only if runnable. Durable unique kick ledger bounds duplicate clicks, including failed infrastructure attempts. Missing scheduler/Vault/HTTP errors do not reject or undo confirmation; Cron can still claim. No Webflow/Gemini/credential call occurs in the kick RPC itself (actual confirmed execution retains normal W/I later). Tests cover rejected preview/foreign caller, duplicate confirmation, failed kick persisted, cron recovery and successful UI confirmation despite a thrown kick network error. One full-suite run hit a10s PGlite setup timeout; fixture setup now allows30s like other DB fixtures, and the full suite is rerun with four workers. No production timeout/safety rule changed.

D gates: lint/typecheck/full762 tests in133 files/production build passed (four workers). Failed acceleration is independent of confirmation, no client secrets or new provider-monitor calls.

## E — results (bounded execution, within Phase D)

Implemented maximum3 sequential fields under the existing90s shared deadline. Keep5s spacing and reserve at least60s before starting each field. Slow work therefore remains single-field when necessary. Stop immediately on completion, idle, conflict, failure, uncertainty or cooldown. Per-field claim/dispatch/finish and fresh validation/readback are unchanged. No concurrent writes or automatic resends.

For N quick runnable fields, E N→ceil(N/3) is a best-case bound; scheduling, other workers and slow providers can reduce batching. Successful field Q remains3N, with at most one extra empty claim per invocation; no empty claim after known completion. W/I/G delta per executed field is0. Individual slow fields can still exhaust the shared deadline; durable dispatch and lease reconciliation retain the existing recovery contract.

Gates: lint, typecheck, full767 tests in134 files, production webpack build and Edge bundle build passed. Added time-budget, sequential execution, terminal/unsafe-stop and SQL per-field audit/recovery tests. Tests use synthetic records and fake provider transport, never customer content.

## Delivery and remaining validation

All five Phase D slices are implemented locally. No Phase E AI/MCP work was performed. Provider monitoring adds W/I/G0. Immediate kicks add at most1E per operation; idle Cron removes1E/min, while batch execution reduces invocations for eligible work. These are code/test budgets, not measured production savings. Authorization, source re-read, conflict detection, idempotency, audit, post-write verification, Retry-After and no automatic publishing remain authoritative.

Pending explicit deployment approval: migrations006/007, updated Cron SQL and rebuilt Edge Function. Do not replay historical migrations blindly: this project's remote migration history is incomplete. No remote database, Cron, Edge deployment or customer write occurred in this Phase D turn. Browser interaction and deployed infrastructure have not been validated; SQL fixtures and scheduler tests are not a substitute for that integration check.

The optional Deno smoke test could not run offline: the Deno npm package was not cached (ENOTCACHED). Edge bundle compilation passed; runtime smoke remains pending.

## Remote migrations — 2026-09-23

After explicit user approval, applied only `20260923000600_worker_efficiency.sql` and `20260923000700_worker_kick.sql` to linked project `nxibjpprjorchjeoudss`. An isolated workdir preserved the five already-recorded Phase B/C migrations; dry-run selected only006/007. Both applied successfully and a subsequent remote migration listing confirmed both versions. No historical migrations were replayed. This supersedes the migration-pending note above. Cron SQL installation and Edge deployment remain pending; neither was changed in this deployment. No worker invocation or customer-content write was used for validation.

## Phase D — Cron and Edge deployment, 2026-09-23

With explicit user authorization, rebuilt and deployed `cms-worker` to `nxibjpprjorchjeoudss`, then installed `supabase/cron/cms-worker.sql`. Verified job1 remains active on `* * * * *`, the invocation function contains the conditional runnable gate, and authenticated callers cannot invoke the private scheduler directly. The queue reported no runnable work before deployment. The authenticated `check` diagnostic through Vault/pg_net returned HTTP200, `{"ok":true,"mode":"check"}`, without timeout (request4244). No customer-content test operation or manual run was submitted. Secrets were preserved.

This supersedes the pending Cron/Edge deployment notes above. Batching under real provider load and dashboard browser interactions remain untested; the diagnostic does not validate a customer write.
