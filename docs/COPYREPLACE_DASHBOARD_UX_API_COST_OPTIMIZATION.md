# CopyReplace — Dashboard UX & API Cost Optimization Plan for Codex

> **Purpose:** Make CopyReplace substantially faster and easier to use while **reducing unnecessary Webflow/API/LLM traffic**.
>
> This document is based on the current repository architecture and product behavior as of September 2026.
>
> The optimization target is not simply “fewer clicks.” It is:
>
> **fewer clicks + fewer waits + fewer remote requests + no reduction in safety.**
>
> CopyReplace must continue to preserve:
>
> - preview before writes
> - validation
> - explicit confirmation
> - conflict detection
> - idempotency
> - audit history
> - no automatic Webflow publishing
> - RLS / ownership checks
>
> **Do not trade safety for speed.**

---

# 1. Current product constraints to preserve

Before changing anything, read:

```text
AGENTS.md
README.md
docs/scans.md
docs/cms-changes.md
docs/managed-value-sync.md
docs/background-sync.md
docs/free-plan.md
```

Important current behavior:

## Scan behavior

Current CMS scans:

- support 1–20 selected collections;
- process up to 500 items technically;
- process Webflow items in batches of up to 25;
- store up to 1,000 occurrences;
- process the next batch on a minimum ~5 second client scheduling interval;
- persist progress in PostgreSQL;
- can be resumed;
- currently stop being scheduled if the scan page is closed;
- respect `429 Retry-After`;
- allow one active/paused scan per site;
- exact scan results are already persisted.

Do not accidentally turn dashboard navigation into automatic rescans.

---

## Current free-plan limits

The database currently enforces Free-plan limits, including:

```text
1 connected Webflow site
5 confirmed scans / month
100 processed items per new scan
50 confirmed CMS fields / month
1 active scan or CMS operation
200 operation preparations / month
1,000 integration credential accesses / month
60 preparation + integration accesses / minute
```

The UI must not create hidden operations that consume quotas.

---

## Current CMS write safety

CMS changes currently:

1. create a preview;
2. require explicit confirmation;
3. reconstruct the operation server-side;
4. re-read the remote field before writing;
5. compare it against the expected snapshot;
6. block conflicts;
7. write staged CMS content;
8. record real results;
9. support retry/revert where allowed.

Do **not** remove the pre-write remote re-read merely to reduce Webflow requests.

That request is part of the product's safety guarantee.

---

## Managed Value sync

Managed Values already:

- centralize linked CMS occurrences;
- preview updates;
- re-read sources before writing;
- verify outcomes;
- preserve conflicts;
- use the background operation queue.

The dashboard should reuse this stored information rather than repeatedly asking Webflow for the same data.

---

# 2. Primary optimization rule

For every screen or interaction, use this data-source priority:

```text
1. Existing client state
2. Derived local computation
3. Persisted scan / operation data in PostgreSQL
4. Cached provider metadata
5. Fresh Supabase query
6. Webflow API read
7. Webflow API write
8. AI / LLM API
```

The implementation should always ask:

> Can this answer be produced from a cheaper layer?

Do not use Webflow as the dashboard database.

CopyReplace's own persisted data should power most navigation and UI.

---

# 3. Desired user flows

## User knows what they want to change

Target:

```text
Dashboard
→ Quick Search
→ Results + replacement
→ Preview
→ Apply
```

Normally no more than **3 meaningful steps after entering the query**.

---

## User does not know what needs changing

Target:

```text
Dashboard
→ Run scan
→ Review findings
→ Preview
→ Apply
```

Avoid unnecessary configuration when safe defaults exist.

---

# 4. Dashboard home should become an action center

The site Overview should answer:

```text
What needs attention?
What happened recently?
What can I do now?
```

Recommended structure:

```text
Site name                                      [New scan]

[Managed Values] [Needs review] [Occurrences] [Last scan]

Quick Search
[ Search text, URL, phone, price... ]

Needs attention
- 12 findings ready to review
- 2 conflicts
- 1 paused operation

Recent activity
...
```

Do **not** make Overview fetch live Webflow content.

Overview should be powered almost entirely by PostgreSQL.

---

# 5. Add Quick Search without creating API spam

Add a prominent input:

```text
What do you want to find?

[ Search text, URL, phone, price... ]
```

## Default behavior

Search the latest compatible persisted scan first.

```text
query
↓
normalized locally
↓
query persisted occurrences
↓
return results immediately
```

Do not contact Webflow automatically.

If the data is old, communicate that:

```text
Results from Sep 22 · 14:30

[Refresh from Webflow]
```

If no suitable scan exists:

```text
No recent scan covers this content.

[Run a targeted scan]
```

Do not silently consume a scan quota.

---

# 6. Auto-detect query type locally

Do not use AI for determining whether the user pasted:

- a URL;
- phone;
- email;
- currency;
- number;
- plain text.

Use deterministic parsing / existing canonical schemas.

Example:

```text
https://example.com
→ URL

(918) 555-0292
→ phone

$489,000
→ currency/number

hello@example.com
→ email

otherwise
→ text
```

Reuse existing canonicalization logic where possible.

---

# 7. Build a reusable local search index from scan data

CopyReplace already stores scan occurrences.

Use those persisted results more effectively.

Create/extend normalized searchable fields only if the current schema does not already support this efficiently.

Potential derived values:

```text
normalized_text
normalized_phone
normalized_url
normalized_number
normalized_currency
searchable_context
```

Do not duplicate large field snapshots unnecessarily.

Use database indexes appropriate to actual queries.

Before adding a migration, inspect current schema and query plans.

---

# 8. Normalize once, reuse everywhere

Normalization should happen at ingestion or through deterministic generated/derived logic, not repeatedly on every page request.

Examples:

```text
(918) 555-0292
→ 9185550292

https://example.com/
→ normalized URL representation

$489,000
→ numeric comparison representation

"  Free Consultation "
→ trimmed canonical text
```

Preserve the original raw value separately.

---

# 9. Do not rescan on navigation

These actions must never trigger a Webflow scan automatically:

```text
open dashboard
open scan history
open Managed Values
open activity
go back
change tab
open drawer
change filter
sort table
paginate stored results
```

A scan must require an explicit user action.

---

# 10. Make freshness a first-class UX concept

Use visible freshness instead of background refetching.

Examples:

```text
Last scanned
2h ago
```

```text
CMS structure checked
18 min ago
```

Then provide:

```text
Refresh
Run again
```

This reduces remote calls while increasing user trust.

---

# 11. Cache provider metadata

Webflow metadata changes far less frequently than scan content.

Cache where safe:

```text
site metadata
collection list
collection field/schema metadata
locale metadata
authorized site list
```

Suggested strategy:

```text
cache in CopyReplace DB
+
updated_at / fetched_at
+
TTL
+
manual refresh
```

Do not fetch collection schemas on every page transition.

Suggested initial TTLs to evaluate, not blindly implement:

```text
site metadata:        30–60 minutes
collection list:      15–30 minutes
collection schema:    15–30 minutes
locale metadata:      30–60 minutes
```

If Webflow provides a relevant webhook for a resource, prefer invalidation from events over short polling.

Codex must verify current Webflow capabilities before introducing webhook assumptions.

---

# 12. Request deduplication

Within one server request or concurrent render, identical provider reads should collapse into one call.

Implement a request-level dedupe layer around Webflow reads where appropriate.

Conceptually:

```ts
getCollectionSchema(site, collection)
```

called by two components during the same operation should not create two Webflow requests.

Do not cache write responses as reads.

---

# 13. Search debounce

For UI search:

```text
200–350ms debounce
```

Rules:

- if data is already loaded, filter client-side;
- do not call Webflow on keypress;
- do not call AI on keypress;
- do not create scan preparations on keypress.

If querying PostgreSQL for large result sets, debounce and cancel stale requests.

---

# 14. Results + replacement on the same working screen

Avoid:

```text
Results
→ detail route
→ replace route
→ preview route
```

Preferred:

```text
Search: "Free Consultation"

12 matches

☑ Home / Hero
☑ Contact / CTA
☑ Practice Areas / CMS

Replace with
[ Schedule a Consultation ]

                           [Preview 12 changes]
```

Selecting and deselecting matches is local state.

No remote request is needed until preview is prepared.

---

# 15. Use drawers for context instead of route churn

Use a side drawer for:

```text
occurrence context
Managed Value metadata
source details
operation summary
history detail
```

Opening a drawer should not refetch the parent dataset.

Pass or reuse loaded identifiers/data and fetch only missing local DB detail.

Do not query Webflow merely to open a detail drawer.

---

# 16. Inline edits where safe

For a Managed Value:

```text
Company Phone
(918) 555-0292                    [Edit]
```

Edit inline:

```text
[ (918) 555-0300 ]

[Preview changes]
```

The edit field itself should generate zero external API requests.

Only preparation/preview and eventual execution may use provider access according to existing safety logic.

---

# 17. Keep one meaningful confirmation

Preferred write flow:

```text
Edit
→ Preview
→ Apply
```

Avoid:

```text
Edit
→ Continue
→ Review
→ Confirm
→ Are you sure?
```

The Preview is the user's deliberate confirmation surface.

Do not remove explicit confirmation currently required by the backend.

---

# 18. Reuse scan results to create previews

A preview can initially display the stored scan snapshots.

Do not re-read every source merely to render the first visual preview if the current secure architecture does not require it at that stage.

However:

> execution must retain the existing server-side re-read/conflict validation.

This gives the user a fast preview without weakening safety.

Codex must inspect the current implementation before changing when reads occur.

---

# 19. Smart selection defaults

For deterministic exact matches:

```text
Exact matches
12 selected
```

For uncertain or future fuzzy matches:

```text
Possible matches
3 need review
```

Do not spend AI tokens classifying exact equality.

---

# 20. Separate exact from intelligent discovery

Future architecture should have:

## Tier A — deterministic and cheap

```text
exact repeated content
canonical phone matches
exact URLs
numeric/date patterns
stored occurrence grouping
```

## Tier B — optional intelligent enrichment

```text
fuzzy matches
semantic relationship
context classification
likely outdated variants
```

Tier B must not be required for core product functionality.

---

# 21. AI must be opt-in or budgeted

The current product should not become dependent on an LLM API for normal scans.

If AI features are added later:

Use explicit actions such as:

```text
Find related variations
Analyze context
Suggest group
```

Do not automatically AI-analyze every detected occurrence.

---

# 22. Minimize LLM payloads

Never send a full website/CMS dump to an LLM.

Send only:

```text
candidate value
type
2–5 representative snippets
minimal source metadata
```

Example:

```json
{
  "value": "$489,000",
  "type": "currency",
  "contexts": [
    "Starting at $489,000",
    "Homes from $489,000",
    "Current price: $489k"
  ]
}
```

Use structured responses.

Cache semantic enrichment against a stable content fingerprint.

If the same candidate + contexts have not changed, reuse the result.

---

# 23. AI cache key

For future AI analysis, create a deterministic fingerprint such as:

```text
feature
model_family
normalized_candidate
context_hash
prompt_version
```

Reuse the saved result when all inputs match.

Changing UI must not invalidate AI results.

Changing prompt version intentionally may invalidate them.

---

# 24. AI budget telemetry

If/when LLM integrations exist, record:

```text
provider
feature
workspace_id
site_id
request_count
input_tokens
output_tokens
estimated_cost
cache_hit
timestamp
```

The purpose is cost control, not user surveillance.

Do not log sensitive full prompts unless necessary and covered by retention/privacy rules.

---

# 25. API telemetry

Add lightweight observability for external provider usage.

Track aggregated counts:

```text
webflow_read
webflow_write
webflow_429
webflow_retry
integration_access
scan_batch
cms_worker_invocation
ai_request
ai_cache_hit
```

Useful dimensions:

```text
site
workspace
operation type
endpoint class
success/failure
```

Avoid high-cardinality payload logging.

---

# 26. Introduce an API cost dashboard for admins

Internal only.

Show:

```text
Webflow reads today
Webflow writes today
Integration credential accesses
Edge worker invocations
Scans started
Fields processed
429 responses
AI requests/tokens (future)
```

This is necessary to know whether optimization is working.

---

# 27. Define budgets per user action

Document an expected maximum provider cost for common operations.

Example conceptual budgets:

```text
Open Overview:
0 Webflow calls

Open Managed Values:
0 Webflow calls

Search latest scan:
0 Webflow calls

Open old scan:
0 Webflow calls

Run targeted scan:
Webflow calls proportional only to selected collections/items

Open occurrence detail:
0 Webflow calls

Edit input:
0 Webflow calls

Prepare preview:
prefer 0 remote calls where safe

Apply CMS update:
required safety reads + writes only
```

Write tests where possible to prevent regressions.

---

# 28. Optimize scan configuration to reduce Webflow reads

Current docs explicitly state:

> selecting fewer collections reduces reads, but selecting fewer information types does not eliminate the need to read items from selected collections.

Reflect that truth in UX.

Recommended scan setup:

```text
Quick scan
- recent collections
- specific text / known target

Full scan
- choose collections
- choose content types
```

Encourage narrower scans when the user knows what they want.

---

# 29. Remember previous scan configuration

Store/reuse:

```text
selected collections
selected types
specific text mode
```

On repeat usage:

```text
Run again
```

should be one click.

Secondary:

```text
Customize
```

Do not force the user through the configuration wizard every time.

This improves UX without additional requests.

---

# 30. Targeted scan from Quick Search

If cached data is insufficient, offer:

```text
Scan for "Free Consultation"
```

Use the specific-text feature that already exists instead of starting a broad scan.

If possible, let the user select a small collection scope.

This minimizes processed items and Webflow API traffic.

---

# 31. Do not use page refresh as data refresh

Browser/page navigation should not mean:

```text
refresh Webflow
```

Separate concepts:

```text
UI refresh
database refresh
provider refresh
new scan
```

Only provider refresh should consume remote API quota.

---

# 32. Polling optimization

Current Free-plan documentation says:

- activity polls every ~15 seconds while active;
- every ~60 seconds without activity;
- polling pauses while hidden/offline;
- change progress polls every ~15 seconds.

Preserve the hidden/offline optimization.

Improve further:

## Overview

Do not poll at 15 seconds unless there is actually an active operation relevant to that site.

No active operation:

```text
60s or no polling
```

Active scan/change:

```text
10–15s as currently appropriate
```

Completed:

Stop high-frequency polling immediately.

---

# 33. Prefer event-driven invalidation where cheap

If Supabase Realtime is already available and comfortably within project quotas, evaluate using it **only for operation status transitions**, not for every table.

Do not automatically introduce Realtime.

Compare:

```text
polling cost
vs
Realtime connection/message cost
vs
implementation complexity
```

If polling is already cheaper for expected traffic, retain it.

Codex should document this comparison before implementing.

---

# 34. Important background worker optimization

Current `background-sync.md` states that the Supabase Cron invokes the Edge Function every minute and therefore can consume roughly:

```text
43,200 invocations / 30 days
```

even when there is no work.

This deserves explicit optimization.

## Preferred improvement

Keep the cron job, but modify the SQL job so it first performs a **cheap database existence check** for runnable queue work.

Only call `pg_net` / the Edge Function when pending work exists.

Conceptually:

```sql
if exists (
  select 1
  from <queue>
  where status = 'runnable'
  ...
) then
  perform net.http_post(...);
end if;
```

The exact queue/status conditions must come from the existing migration logic.

Do **not** invent queue semantics.

This can preserve quick background execution while eliminating idle Edge Function invocations.

---

# 35. Add immediate worker kick + cron fallback

For better perceived speed:

When the user confirms a CMS operation:

1. commit the operation normally;
2. optionally trigger one authenticated worker execution immediately from trusted server code;
3. keep cron as recovery/fallback for interrupted processing.

This avoids waiting up to one minute for the first field while not requiring constant aggressive polling.

Important:

- confirmation must remain idempotent;
- worker kick must not duplicate fields;
- existing leases/durable-send protections must remain authoritative;
- failure to kick immediately must not fail the confirmed operation.

Treat the immediate kick as acceleration, not correctness.

---

# 36. Consider small worker batches

Current worker model processes at most one field per Edge invocation.

Evaluate processing a **small bounded number** per invocation, e.g.:

```text
up to 3–5 runnable fields
or
until a strict execution-time budget is reached
```

Potential benefit:

- fewer Edge Function invocations;
- faster multi-field operations.

Constraints:

- preserve per-field leases;
- preserve 429 / Retry-After behavior;
- stop immediately on provider cooldown where required;
- preserve per-field audit/results;
- do not create high Webflow request bursts;
- stay comfortably below Edge execution limits.

Do not implement this without tests.

---

# 37. Do not optimize away verification reads

Managed Value sync currently re-reads sources before writing and verifies outcomes.

CMS changes also rely on source revalidation.

These are intentional.

Do not remove these calls merely to make request counts look lower.

Optimize:

```text
unnecessary metadata reads
duplicate reads
idle worker calls
navigation refetches
```

not:

```text
safety-critical conflict reads
required write verification
```

---

# 38. Avoid duplicate post-write reads where evidence already exists

Inspect each write path.

If the Webflow write response already returns authoritative final field data for a particular content type, determine whether an additional immediate GET is truly required.

However:

- images may be normalized/imported by Webflow;
- existing docs rely on real returned state and uncertainty handling.

Therefore do not broadly remove post-write verification.

Any reduction must be endpoint/content-type-specific and covered by tests.

Default: preserve current behavior.

---

# 39. Prefetch only cheap routes

Next.js route prefetching is useful, but it must not cause hidden Webflow calls.

Safe candidates:

```text
Overview
Scans list
Managed Values list
Changes list
```

when they use persisted DB data.

Avoid prefetching a route if rendering it performs provider calls.

Codex must inspect data loaders before enabling/aggressively relying on prefetch.

---

# 40. Client-side state preservation

Preserve:

```text
search
filters
sort
pagination
selected results where safe
scroll position
expanded groups
```

when navigating to/from drawers/details.

This reduces repeated database requests and user work.

Use URL search params for durable filter/search state where appropriate.

---

# 41. Optimistic UI: only for low-risk local state

Good optimistic actions:

```text
open/close UI
selection
filters
local labels
marking purely local UI state if backend semantics allow
```

Remote content writes:

```text
never fake success
```

For Webflow changes show:

```text
Queued
Processing
Applied
Conflict
Failed
Needs verification
```

according to real operation state.

---

# 42. Avoid over-fetching database rows

For Overview:

Do not load:

```text
full scan snapshots
all occurrences
all audit payloads
full Managed Value source content
```

just to render counts.

Use aggregate queries / narrow projections.

Example:

```text
count managed values
count pending findings
latest scan timestamp
latest activities LIMIT 5
```

Detail data should load on demand.

---

# 43. Pagination everywhere large data can grow

Current history limits already cap recent output.

Continue using:

```text
limit
cursor/page
load more
```

for:

```text
scans
occurrences
Managed Values
changes
activity
```

Do not send 1,000 occurrence records to the browser when only the first 50 are visible.

---

# 44. Avoid duplicate server calls in React composition

Inspect server components for patterns where:

```text
Parent fetches X
Child fetches X again
Sidebar fetches X again
Header fetches X again
```

Consolidate shared reads at the correct layer or use request-scoped memoization.

Do not create giant all-purpose payloads solely to eliminate queries.

Optimize based on measured duplication.

---

# 45. Use narrow DTOs

Create view-specific data shapes.

Examples:

```ts
SiteOverviewSummary
ScanListItem
ManagedValueListItem
ActivityListItem
OccurrencePreview
```

Do not send full database models to every client component.

Benefits:

- smaller payloads;
- clearer contracts;
- reduced accidental sensitive data exposure;
- faster rendering.

---

# 46. Static Designer extension vs dashboard

The Webflow Designer extension and dashboard should not independently perform the same expensive scan.

If both surfaces refer to the same site:

- store scan identity/results centrally;
- show shared current state;
- reuse completed scan data.

If the extension requests a fresh scan, the dashboard should see that operation rather than create another.

---

# 47. Protect against double-submit

For all expensive actions:

```text
Start scan
Prepare preview
Confirm operation
Run targeted scan
Refresh provider data
```

Disable/relabel the action immediately after submission.

Existing idempotency remains authoritative.

UI should make duplicate requests unlikely even before server deduplication.

---

# 48. Add request coalescing for repeated refresh actions

If two requests ask to refresh the same provider resource concurrently:

```text
same site
same collection
same operation type
```

where safe, reuse the in-flight promise/job rather than sending duplicate provider requests.

Do not coalesce writes with different idempotency keys.

---

# 49. Rate-limit awareness in UX

If Webflow responds with `429`:

Do not let the user hammer Retry.

Show:

```text
Webflow asked us to wait.

Resume available in 34 seconds.
```

Disable until the allowed time.

The existing scan/change Retry-After logic must remain.

---

# 50. Quota-aware UX

Since Free already has explicit quotas, expose relevant context before an expensive operation.

Example:

```text
Scans this month
3 / 5
```

But do not show quota warnings on every screen.

Before confirmation:

```text
This scan will use 1 of your remaining 2 monthly scans.
```

Only if this is supported by current quota semantics.

---

# 51. Introduce a cost classification for new features

Every new feature PR should label external cost:

```text
Cost class A:
DB/client only

Cost class B:
provider read

Cost class C:
provider write

Cost class D:
AI/LLM
```

In code review ask:

> Could this be implemented at a cheaper class?

This can be documented in `AGENTS.md`.

---

# 52. Suggested additions to AGENTS.md

Add a section similar to:

```md
# External API efficiency

- UI navigation must not trigger provider refreshes implicitly.
- Prefer persisted scan/operation data over Webflow reads.
- Webflow refreshes/scans require explicit user intent unless part of an already confirmed operation.
- Do not add LLM calls to deterministic workflows.
- AI enrichment must be optional, cacheable, and use minimal context.
- Preserve safety-critical remote reads used for conflicts and write verification.
- New external integrations must include request/cost telemetry.
- Do not prefetch routes that perform external-provider calls.
```

---

# 53. Phase 1 — Audit before implementation

Codex should first produce:

```text
docs/api-ux-cost-audit.md
```

No behavior changes yet.

Audit:

## UI

For each major dashboard route:

```text
user goal
number of clicks
number of page transitions
number of loaders
duplicate choices
```

## Network

For each route/action:

```text
Supabase queries
Webflow calls
credential accesses
Edge invocations
polling interval
AI calls if any
```

## Waste candidates

Identify:

```text
provider reads caused by navigation
duplicate fetches
uncached metadata
over-fetching
polling with no active job
idle Edge invocations
large result payloads
avoidable repeated preparations
```

Do not optimize based only on intuition.

---

# 54. Phase 2 — Quick UX wins with zero provider-cost increase

Implement first:

```text
Quick Search against stored scan data
Results + replacement on one screen
Drawers for context
Inline Managed Value edit
Run Again with previous config
Needs Attention deep links
Recent Activity deep links
state preservation
smart local type detection
debounced local/database search
```

These should improve UX without increasing Webflow traffic.

---

# 55. Phase 3 — Database/query efficiency

Then optimize:

```text
narrow projections
aggregates for Overview
pagination
request memoization
normalized search fields/indexes where justified
shared site context
provider metadata cache
```

Measure before/after.

---

# 56. Phase 4 — Polling and worker efficiency

Then address:

```text
activity polling only when useful
stop high-frequency polling when complete
conditional worker invocation
immediate worker kick
optional bounded worker batches
```

This phase requires strong integration tests.

---

# 57. Phase 5 — Optional AI architecture

Only after deterministic UX is strong.

Prepare infrastructure for:

```text
fuzzy grouping
semantic variants
context analysis
```

But do not enable automatic LLM consumption by default.

---

# 58. Performance targets

Suggested product targets:

## Overview

```text
0 Webflow calls on normal open
```

## Scan history

```text
0 Webflow calls on normal open
```

## Managed Values list

```text
0 Webflow calls on normal open
```

## Changes list

```text
0 Webflow calls on normal open
```

## Quick Search

```text
0 Webflow calls when a compatible stored scan exists
```

## Result filtering / selection

```text
0 external calls
```

## Detail drawer

```text
0 Webflow calls by default
```

## New scan

Provider calls only after explicit confirmation.

## Apply replacement

Only required safety/provider operations.

---

# 59. User-perceived speed targets

Aim for:

```text
filter/search interaction:
<100ms perceived when local

drawer open:
instant / <100ms shell

route transition using DB data:
fast enough to avoid blocking full-page spinner

operation submission:
immediate acknowledged state
```

Remote Webflow operations may take longer; communicate real progress rather than hiding it.

---

# 60. Do not add fake speed

Never show:

```text
Applied
```

before a Webflow write is confirmed.

Use:

```text
Queued
Processing
```

until the result is real.

Optimistic UX is for low-risk local state, not external writes.

---

# 61. Codex implementation prompt

Use the following prompt after adding this document to the repository:

```text
Read this optimization guide completely before changing code.

Then read:
- AGENTS.md
- README.md
- docs/scans.md
- docs/cms-changes.md
- docs/managed-value-sync.md
- docs/background-sync.md
- docs/free-plan.md

Goal:
Reduce user steps and perceived latency while also reducing unnecessary Webflow, Supabase Edge, integration, and future AI/LLM requests.

Do not optimize by weakening safety.

Before coding, create:
docs/api-ux-cost-audit.md

For each current dashboard route and major action, document:
1. the user task
2. current number of meaningful steps
3. Supabase queries
4. Webflow calls
5. integration credential accesses
6. polling behavior
7. Edge worker calls
8. duplicate/avoidable calls
9. current persisted data that could be reused

Do not modify production code until the audit is complete.

Then propose changes grouped as:

A. UX improvements with zero additional provider requests
B. database/query optimizations
C. Webflow request reductions
D. polling/worker reductions
E. optional future AI architecture

Prioritize A before B, B before C/D, and do not implement E unless explicitly requested.

Hard constraints:
- AI must never directly modify a customer website.
- Keep preview, validation, explicit confirmation, audit and idempotency.
- Preserve source re-read/conflict checks before writes.
- Preserve required write verification.
- No automatic publishing.
- No hidden scan creation.
- No automatic provider refresh on page navigation.
- Do not consume scan quotas through UI prefetching.
- Do not add LLM calls to exact search or normal scanning.
- Preserve Free-plan quota enforcement in PostgreSQL.
- Preserve RLS and ownership checks.
- Do not expose internal UUIDs in canonical dashboard URLs.

UX priorities:
1. Quick Search using stored scan data
2. Results + Replace on one working surface
3. Run Again using prior scan config
4. detail drawers instead of unnecessary routes
5. inline Managed Value editing
6. Needs Attention deep links
7. Recent Activity actions
8. persistent filters/search/scroll state
9. smart defaults based on deterministic data

API priorities:
1. zero Webflow calls for ordinary dashboard navigation
2. reuse persisted scan data
3. cache slow-changing Webflow metadata
4. deduplicate concurrent reads
5. narrow DB payloads and paginate
6. reduce idle polling
7. make background worker invocation conditional on pending work
8. evaluate immediate worker kick + cron fallback
9. evaluate small bounded worker batches
10. add provider usage telemetry

Do not implement all phases in one patch.

After each phase:
- run lint
- run typecheck
- run tests
- run build
- report behavior preserved
- report measured/request-count improvement
- report any new external API request introduced

Any optimization that adds recurring external calls must justify its cost in the implementation summary.
```

---

# 62. Definition of Done

This optimization program is successful when:

- [ ] common user tasks require fewer steps
- [ ] Quick Search can use stored scan data
- [ ] ordinary dashboard navigation performs no Webflow calls
- [ ] opening old scans does not rescan
- [ ] drawers/details reuse existing data
- [ ] filters/search do not consume Webflow requests
- [ ] scan configuration can be reused
- [ ] targeted scans are available when appropriate
- [ ] activity polling is active only when justified
- [ ] hidden/offline polling remains paused
- [ ] idle Edge worker invocations are reduced
- [ ] duplicate external reads are coalesced
- [ ] metadata has a documented cache/freshness policy
- [ ] API usage is measurable internally
- [ ] future AI calls are optional and budgeted
- [ ] no safety guarantees regress
- [ ] no additional automatic publishing exists
- [ ] conflict detection still works
- [ ] retries remain rate-limit aware
- [ ] lint/typecheck/tests/build pass

---

# 63. Final principle

The product should feel faster because it is smarter about **when not to call an API**.

The ideal CopyReplace architecture is:

```text
User interaction
↓
Reuse local / persisted knowledge first
↓
Ask Webflow only when freshness or execution requires it
↓
Use AI only when semantic intelligence genuinely adds value
```

The goal is:

> **Less bureaucracy for the user. Less unnecessary infrastructure work for CopyReplace. Same safety guarantees.**
