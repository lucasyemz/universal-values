# Dashboard component and rendering review

2026-09-28. Scope: local component structure and CPU/rendering work. Request scheduling, provider APIs, database queries, commercial limits and write flows are unchanged.

## Component inventory and decisions

| Area | Existing building blocks | Action |
| --- | --- | --- |
| Shared interface | Button, StatusBadge, Notice, DataTable, Diff, headers, ResourceNumber | Reused; no competing card/button system. Added shared TextParts for highlighted diff segments. |
| Scan editor | OccurrenceEditor, ReplacementInput, ImageSelectionEditor, InlineReview | Memoized source projection, eligibility display derivation, selection signature, change review, live preview and variable-selection derivation with complete inputs. |
| Scan local state | useScanDrafts, useEditorSelection | Stable occurrence/exclusion inputs; excluded membership uses a Set instead of repeated array searches. Existing restoration/invalidation semantics unchanged. |
| Scan history / overview | ScanHistoryList, CollectionTags, ScanVersionSelector | Type/translated-label derivation retained across local search/filter renders. Shared list/compact variants remain intact. |
| Variables | ManagedValueEditor, InlineReview | Source-key index replaces find per field; previews retained during unrelated pending/checking state changes. |
| CMS Explorer | LiveCmsItems, DataTable, MetadataRefresh | One memoized filter result feeds count and rows; field-name Map replaces repeated schema scans for every displayed field. Fetch/cooldown behavior unchanged. |
| History | ChangeCard, ChangeDetails, TextChangeDiff | Comparison output benefits from shared compact diff segments; server-rendered cards remain server components. |
| Shell and sites | AppShell, AccountMenu, SiteCard | Existing component boundaries retained. No blanket memoization or new client boundary. |

## Comparison rendering

textDiff now joins adjacent segments with the same changed state. Equal strings return one unchanged segment without tokenization. This changes display representation only, never the provider payload. Shared TextParts renders the compact segments in both comparison cards and live replacement context, keeping semantic colors and exact text.

Synthetic fixture: 100 repetitions of `A comfortable house with gardens and spacious rooms. `; replace the first `comfortable` with `beautiful`. Both output sides fell from 1,700 segments to 3. Regression coverage preserves separated changes, whitespace, Unicode, markup, deletions, exact reconstruction and bounded large-difference work.

Local Node 24 measurement, 500 iterations after warm-up:

| Measurement | Before | After |
| --- | --- | --- |
| Diff calculation alone | 46.98 ms | 66.19 ms |
| Diff plus React server-rendered after text | 136.40 ms | 107.80 ms |

Compaction adds linear work to the pure calculation while reducing React child processing. The combined synthetic sample improved about 21%; this is not a browser INP, mobile-device or whole-site speed claim. Timings are single-machine observations, not CI thresholds.

## Safety and limits

Memoization is component-local derived presentation state, keyed by current inputs. Server authorization and confirmation still run normally. Changed snapshot, selection, values, bindings and locale invalidate the applicable derivation. No cross-user authorization cache or additional persistence was added. Q/W/I/E/G delta: zero.

This is a focused code/rendering review, not proof that all dashboard routes are optimal. Further changes such as virtualizing occurrence lists, lazy-loading hidden CMS field trees or restructuring the shell should be driven by browser profiles; they can affect focus, selection and state restoration. No dependencies, request changes or broad lazy loading were added speculatively.

Validation: TypeScript, lint and production webpack build passed. Full test result is recorded in the completion report. No live CMS writes or new scans were used for testing. Visual geometry was not changed intentionally; this pass did not repeat the prior authenticated visual audit.
