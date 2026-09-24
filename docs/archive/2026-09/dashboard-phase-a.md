> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Phase A — persisted-data UX

2026-09-22. Implements Phase A only, following `api-ux-cost-audit.md`.
No migrations, provider metadata cache, aggregate SQL, worker/Cron changes, polling changes or AI changes.

## Slices and checks

Each slice was implemented sequentially and passed ESLint, TypeScript/route generation,
full Vitest suite and production `next build --webpack` before the next slice.

| Slice | Main files | Passing tests | User flow before → after |
| --- | --- | --- | --- |
| 1 Saved Quick Search | `modules/scans/saved-search*.ts`, `components/sites/quick-search.tsx`, Overview, scan page | 678 / 109 files | History → scan → filter (3 actions) → Overview search → open group (2) |
| 2 Run Again | `modules/scans/repeat-*.ts`, `components/sites/repeat-scan.tsx`, NewScanWizard, scan history/detail | 682 / 110 | From history: New scan → collections → Continue → types/query → Review → confirm (6 actions) → Run again summary → Run again (2 actions) |
| 3 Navigation state | `modules/navigation/state.ts`, `components/layout/navigation-state.tsx`, layout/sidebar, scan groups | 684 / 111 | Return + re-enter filters/expand/scroll → return through remembered link |
| 4 Context | `modules/managed-values/context-actions.ts`, `components/managed-value-context.tsx`, values list/protected occurrence | 686 / 112 | Detail navigation + return → open/close contextual panel, zero route transitions |
| 5 Inline Managed Value editing | context panel, ManagedValueEditor, values detail back link | 687 / 112 | Open separate detail then edit/apply → edit/apply within list panel |
| 6 Attention/activity destinations | `modules/sites/presentation.ts`, page-service, Overview, source anchor | 688 / 112 | Attention → filtered history → operation → Attention → operation; unresolved fields open All |

Final QA follow-up: added a visible reset for the Quick Search group constraint; new searches
leave that constraint rather than silently hiding other groups. Centralization checkbox state is
restored only for still-available rows with identical source text and exact ranges. It never restores
a confirmation checkbox. Final test total is recorded after validation below.

## Cost comparison

Same definitions as the audit: Q table requests/RPCs; W Webflow Data API; I credential access;
E Edge invocations; G Gemini generations. `L` means existing canonical route lookups, `A` an
archived binding snapshot query. Counts below are code-path counts, not production billing traces.
Shared Auth/proxy/layout/activity overhead and destination render work are excluded on both sides.
No DB optimization claim is made in Phase A.

| Action | Before Q/W/I/E/G | After Q/W/I/E/G | External request introduced? |
| --- | --- | --- | --- |
| Quick Search typing | Feature absent; ordinary input 0/0/0/0/0 | 0/0/0/0/0 | No |
| Submit Quick Search | Existing history + result filtering loads both full screens | +3 Q if no compatible scan; +4 Q + L when one exists; W/I/E/G all 0 | No |
| Open repeat configuration | New scan: 7/2/1/0/0 | Summary: 7 Q + L; 0/0/0/0 external/credential | No; removes 2 metadata reads for this route |
| Repeat confirmation | Existing prepare + confirm: 9/2/1/0/0, after setup | 6/0/0/0/0, after summary | No; unchanged batch reads occur only after explicit Run again |
| Customize existing collections | Full new configuration loader: 7/2/1/0/0 | Local transition 0/0/0/0/0 | No; explicit Review scan retains existing preparation checks |
| Save/restore navigation state | 0/0/0/0/0 | 0/0/0/0/0 | No; destination keeps normal DB loader |
| Read Managed Value context | Detail: 5 + A Q; return rerenders list | Panel open/page: 5 + A + L Q; close 0 | No; W/I/E/G all 0 |
| Inline Managed Value editing | Existing editor/preview/confirm contract | Same contract, no duplicated editor pipeline | No; existing name/slug preview exception retained |
| Create attention/activity destinations | Existing row data and route links | Same Q; all other counts 0 | No |

Canonical site links add at most two request-cached DB lookups when the namespace was not already
loaded. Normal Overview rendering remains provider-free. The new result/repeat/targeted links disable
prefetch. The pre-existing New Scan loader still reads metadata on explicit entry; changing that general
loader or Explore CMS caching is Phase C, not implemented here.

Run Again does not avoid the existing scan batch's Webflow reads. It avoids rebuilding the configuration
from Webflow just to display it. It uses the persisted plan, current owner check, original connection
check, immutable preview RPC, confirmation/quota RPC and existing execution authorization. The same
operation key is reused for duplicate submissions. No new provider endpoint or Edge kick is added.

## Search and safety contract

- Only latest compatible completed/limited scan among the latest 20 eligible scans of this account/site.
- Scan timestamp, collection names and detected-only/partial coverage are visible. No live-site claim.
- Exact saved canonical groups only; text folding is a lookup aid, never a merge. URL comparison remains
  case/fragment/trailing-slash sensitive. Numeric hints reuse `numericSearchValue`; phone and BRL hints
  are deterministic. Email/foreign money remain text hints.
- No match means no matching usable saved group, not absence from the live CMS. A unique occurrence is
  offered only when the existing scan result grouping supports it; otherwise targeted scan is offered.
- No substring/context-to-range conversion; original source text, offsets, protection and outcomes are untouched.
- Group links open All, exposing existing reviewed/managed states in the authoritative result editor.
- Targeted scan links prefill the query and deterministic type hints. Scope selection and explicit confirmation are still required; additional selected types retain existing detector behavior.
- Run Again renders a summary only on GET. It neither prepares nor confirms from render, typing or prefetch.
- Managed context is DB-only, paged at ten sources in the response/UI. The pre-existing full loader still
  reads bindings internally; SQL-level pagination is intentionally not implemented. In-panel editing is
  limited to 50 sources; larger sets, active operations and archived values use the existing detail flow.
- Managed previews retain digest validation, version checks, conflict detection, audit and idempotency.
  No auto-apply, automatic publish, credential validation, AI generation or retry is introduced.
- Session state is scoped to user and canonical route, expires after 24h, and permits only DB-backed routes.
  Explicit query links override memory. Operation/error/confirmation parameters are never restored.
  Existing 30-day occurrence drafts and exclusion/source validation remain authoritative.

## Validation

- Added tests for type hints, exact URL equality, context rejection, targeted-query compatibility, limited
  scans, unique occurrences, account/site bounds, no credential/provider access, repeat plan fidelity,
  stale summary/connection rejection, duplicate operation key, scoped repeat number resolution,
  navigation isolation/expiry, source/range identity, context pagination/protection, activity filter behavior.
- Existing full-suite coverage includes stale previews, duplicate clicks, field conflicts, managed ranges,
  RLS, quotas and execution verification. A pre-existing crypto tamper test was made deterministic: it
  now flips a byte instead of occasionally replacing a byte with its already-existing value.
- Browser checks and remaining limitations are recorded below. No live confirmation, scan execution,
  AI generation or customer content mutation was used for QA.


### Browser QA (authenticated localhost, read-only)

- Overview Quick Search: searched `2000`; latest compatible scan #5, saved date and five collection names
  displayed, with a truthful no-saved-group message and targeted-scan link. No new scan was started.
- Run Again: opened saved scan #2 summary; Customize retained Property Listings, `2000`, text detection
  and all three matching options. Continued between local wizard steps only, without submitting Review.
- Returned to Overview through the sidebar: `?q=2000` and visible input value were restored.
- Opened a reviewed scan, collapsed its group, returned through the Scans link, then reopened it through
  the history title: `filter=reviewed` and the collapsed group were retained without browser Back.
- Managed Value sources panel: saved source values and verification times appeared; two sources fit page 1,
  both pagination buttons disabled correctly. Escape closed the dialog and returned focus to View sources.
- Managed Value Edit panel: existing value populated the editor; no preview/apply appeared merely on open.
  Did not type a replacement, check/synchronize sources, confirm a scan, revert or apply real content.
- Visual check at the browser's desktop viewport confirmed the Overview search card and scope messaging.
  Mobile breakpoints, screen-reader traversal, exact scroll-position restoration through layout changes,
  live two-account sessions, multi-page real source panels, and actual provider execution were not browser-tested.
  Account isolation, pagination and execution safety are covered by automated tests; this is not a live
  production transport trace. Billing-level deltas remain unmeasured.

Final automated validation: 690 tests across 112 files; lint, typecheck and production build passed.
No change was made to Phases B, C, D or E. No deployment, migration, commit or push was performed.
