> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Phase E — E1 + E2 implementation plan

Scope approved: shared contracts and seven read-only MCP tools only. No E3 resources, E4 previews, REST transport, write tools, semantic analysis or webhooks in this patch. Dashboard remains usable independently. Read AGENTS, README, API audit, Phase A–D reports and scans/CMS/Managed Value/background documentation. Older guide behavior is superseded by executable contracts and later phase reports.

## Reuse and boundary

MCP `/api/mcp` → shared `modules/agents` service → narrow persisted-data gateway. Transport/SDK integration lives in `connectors/mcp`. Reuse Phase A `compatibleSavedScan`, `savedMatches`, deterministic hints and `groupScanResults`; Phase B overview/activity/binding projections. New adapter projections omit source snapshots and credentials. No changes to replacement, ranges, equality or worker code. Scan result values are explicitly original saved observations, not live CMS or current applied content. Review counts reuse the Phase B projection; individual editing remains in dashboard.

Tools: list_sites, get_site_summary, search_saved_content, list_managed_values, get_managed_value, get_scan_results, list_recent_changes. All read-only, cost A, W/I/E/G=0. Tool discovery must not read scans or start work. No provider refresh fallback. Existing preview/confirm/execution/credential/AI RPCs remain internal and unreachable through this adapter.

## Authentication and authorization

Use random 256-bit scoped personal tokens, SHA256 at rest, 30-day maximum, explicit issue/revoke in Integrations after signed-in confirmation. Scope fixed to copyreplace:read, one workspace, current owner only (consistent with dashboard's owner-only domain). Members are denied, not silently elevated. Limit five active tokens/user. Validate token expiry/revocation, current membership and account plan pause on every request/tool. No raw Webflow credential, Supabase service key or dashboard session shared with agents. A narrow SECURITY DEFINER gateway validates its bearer before any data access, fixes search_path, pins account/workspace/site and refuses arbitrary query/RPC names. Token cannot authorize other domain mutations. Raw token never logged or stored in browser storage.

OAuth is preferable for general public connectors but authorization-server consent/client-registration is a separate delivery. E2 supports MCP clients that allow custom Authorization headers; do not claim OAuth-only hosted clients work yet. Cookie-only MCP requests are rejected. Origin/Host checked against configured MCP origin, HTTPS required except loopback development. No permissive CORS. Sessionless JSON Streamable HTTP using official SDK, one server/transport per request. SDK tool annotations are descriptive; backend checks are authoritative.

## Budgets and caching

Atomic persisted counters per actor shared across tokens: 60 read/transport requests/minute and 1,000/day, including administrators; separate from existing scan/AI quota. Tool data gateway rechecks token and charges each tool (discovery charges request only). Reject JSON-RPC batches, body >16KiB, unknown methods/tools and excessive input. One gateway RPC/tool plus authentication/rate RPC/request. Bounded pages: 5 list rows, 20 result occurrences, 20 latest eligible scan metadata; up to1,000 narrow occurrence records for exact grouping/search, never complete field snapshots. Public response hard cap32KiB; labels/snippets bounded, full URLs never normalized for matching. No server response cache or cached auth. `Cache-Control: no-store` everywhere. No hidden provider work. Duplicate reads are safe but consume read allowance. No user content mutations or scan quota charges.

## Contracts, freshness and pagination

Canonical account/site slugs and existing numeric resource routes; UUIDs internal. Site input account/site tuple, scan/value positive integer. Stable ordered pagination and continuation scope validation. Every scan/search returns original timestamp, collections/types, limited/truncated/skipped flags, saved-data and live freshness unknown. No compatible/matching scan means only no matching saved occurrence; return a targeted dashboard scan link, never prepare/start automatically. Exact URLs remain exact. Do not synthesize occurrences from context. Group counts computed using unchanged domain rules; result paging explicitly observation-only and no bulk-selection authority. Managed detail returns canonical value/version/uncertain/source count; no whole binding snapshots. Activity preserves CMS/static and saved status/attention.

## Telemetry and privacy

Log allowlisted tool name, internal workspace/site identifiers where resolved, result class, duration, cache_hit=false, cost class A, success. No args, prompts, tokens, URLs with query strings, source bodies or raw errors. Token lifecycle audit records issue/revoke IDs/time/actor, no token/hash. Read budgets bounded storage per actor with window resets, no unbounded per-request audit table. Failed auth logs no attacker-controlled tool name. Structured errors: AUTH_REQUIRED, SITE_NOT_FOUND, SCAN_NOT_FOUND, SCAN_NOT_READY, RATE_LIMITED, INVALID_INPUT, RESPONSE_TOO_LARGE, UNAVAILABLE. No stack traces.

## Risks and rollout

1 E1: plan + shared schemas/errors + local migration for scoped auth/rate gateway. 2 E2: persisted service, SDK route, token administration, automated DB and protocol tests. Migration/deployment is not authorized by implementation request; remains local pending approval. Client compatibility verified via SDK synthetic transport, not real customer data. Hosted OAuth-only clients remain unsupported until OAuth delivery.

Security-definer projections must explicitly filter actor/workspace/site even when reusing invoker projections; test two tenants, wrong site, revoked ownership/token, expiry, anonymous and malformed IDs. Missing migration fails closed. Never set arbitrary SQL or external URLs from tool args. Response content is untrusted customer data; tool descriptions warn against treating it as instructions. No assets downloaded by server.

E3 resources later reuse same service/rate/auth. E4 previews must use existing immutable preview/digest pipeline and idempotency; E5 REST mirrors service without duplicated business rules. E6 writes require separate evaluation and backend confirmation, never client tool approval alone. E7 optional enrichment: explicit opt-in, 2–5 snippets, fingerprint(feature,model_family,normalized_candidate,context_hash,prompt_version), provider/token/estimated-cost/cache telemetry; no LLM added now. E8 events require signed payloads, event IDs, transactional outbox, bounded retries, replay window and delivery idempotency before exposure.

## Required validation

Owner/member/foreign workspace/site, token expiry/revoke/current membership, anonymous, paused plan, shared rate caps, malformed/missing resource, partial/limited/old scans, no saved match, exact URLs/ranges, pagination, output bounds, duplicate reads, no sensitive fields and W/I/E/G zero. Use synthetic PGlite and official SDK client only. Run lint, typecheck, full tests, production build. Document actual results and remaining deployment/client checks in docs/mcp.md.

## E1/E2 implementation report

Delivered `/api/mcp` using official SDK1.30.1, the seven read-only tools, shared deterministic service, scoped token administration in Integrations (EN/PT), local migration008 for hashed tokens/current-owner enforcement/atomic budgets/lifecycle audit, and `docs/mcp.md`. No E3–E8 surfaces were implemented. The repository adapter uses only the publishable Supabase key; no service-role key or provider credential access. MCP calls do not mount dashboard AI components.

Keyset continuation uses site slug, Managed Value number and activity timestamp/source/number. Original immutable scan observations use explicit20-row pages; aggregate review counts reuse Phase B. Site summary includes recent scan numbers/links so clients can discover scans without guessing IDs. All public paths use existing route formatting. Search matches complete canonical values before display clipping and never derives ranges from context.

Budgets: discovery/auth1Q; ordinary tools2Q (auth+read); saved search2Q without compatible scan,3Q with one. Every gateway call charges the shared read budget, including repeated reads. W/I/E/G0 for every read-only path. No cache hits or model/token costs are fabricated; semantic accounting is design-only until E7. No source snapshots sent to the client.

Local SQL tests exercise real migrations and anonymous RPC entry with synthetic tokens: owner/member/foreign site/workspace, revocation/expiry, current ownership, shared minute/day budget across tokens, five-token cap, lifecycle idempotence, pause policy, narrow projections, missing/running/limited/old scans, no-match, pagination and cross-tenant rejection. Official SDK client integration tests cover initialize, discovery, tool calls, no write tool, headers/origin, invalid/batched/oversized requests, structured errors and redacted telemetry. Exact-URL/range and response-bound tests reuse the shared service.

No remote migration or application deployment is performed in E1/E2. Browser token-administration UI, real hosted clients, reverse-proxy Host configuration and concurrent multi-connection PostgreSQL load remain integration checks. PGlite serial tests prove constraints and scope behavior, not production lock throughput. SQL inspection confirms no external provider/credential/worker RPC is called.

Dependency audit reports14 findings in dependency nodes already present in the baseline lockfile (Webflow CLI/transitives); no newly affected dependency node from MCP. No unrelated dependency upgrade or automatic audit fix was applied.

## Final validation — 2026-09-23

Lint, TypeScript, full785 tests in137 files, production webpack build and `git diff --check` passed. Official SDK client tests use synthetic in-process HTTP transport; database tests use all migrations in PGlite. No live customer content, provider request, remote migration/deployment, commit or push was used for this implementation. Real client/hosting and browser token-management checks remain pending activation.

## Remote migration activation — 2026-09-23

After explicit user approval, applied only `20260923000800_mcp_read_access.sql` to linked project `nxibjpprjorchjeoudss`. Isolated migration workdir and dry-run excluded historical migrations already applied outside CLI bookkeeping. Verified the remote migration record, RLS on all three integration tables, denied anonymous token-table SELECT and token-management execution, allowed authenticated token management, and AUTH_REQUIRED for a missing bearer. No token issued, customer content changed or provider invoked. This supersedes the earlier migration-pending note. MCP_SERVER_ORIGIN configuration and dashboard activation remain separate; this operation did not deploy the app.
