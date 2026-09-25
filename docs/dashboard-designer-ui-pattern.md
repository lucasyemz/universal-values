# Dashboard / Designer interaction pattern

## Implemented: scan review

- Compact occurrence list with collection, item → field, highlighted context and status.
- Checkboxes are the edit scope. Focus alone never selects a target.
- One selected occurrence opens its editor; multiple selections show Group edit.
- Bulk fill changes selected drafts only. Unselected drafts remain stored, but cannot enter validation or application.
- Selection persists in session storage for 24 hours, scoped by user, scan and canonical group. Changed source content, ranges or eligible occurrences invalidate restoration.
- Desktop uses list + inspector based on available container width (700px), accounting for the dashboard sidebar. Narrow screens stack the panels. Lists have bounded height and keyboard focus.
- Group headers expose the direct manual-review action. Variable creation belongs to the final inline confirmation, alongside the one-off edit choice, rather than a separate header action.
- AI batch targets are only mounted selected occurrences. The label explicitly says Fill selection with AI. Generation still requires a click.
- Collection coverage remains available in an expandable summary. Counts, limitations and source freshness are preserved.
- Shared Diff now uses labeled before/after panels, matching the Designer visual pattern. Reviewed occurrences use the same component with explicit historical labels and remain read-only.

## Durable UI rules

Use existing light-mode tokens: white surfaces, #F7F9FC app background, #1557FF primary, #EAF1FF selection, #111827 ink, #D9E0EA borders. Selected controls need a checked control and border/indicator, not just background color. Use compact responsive cards for site inventories and tables/lists for history. Use the list + inspector for editing work. Essential consequences, errors, scope and confirmation remain visible; technical metadata and secondary actions can be expanded.

## Safety and request costs

Existing InlineReview and prepare/apply actions are reused. Selection is included in the preview key, so changing it invalidates confirmation even if resulting writes happen to be identical. Variable protection is applied before selection; offsets and URL equality remain unchanged. No new provider endpoints, polling, metadata fetches or Gemini generation triggers were introduced. Selection, expanding groups and bulk draft filling are local; preview preparation and explicit application retain existing contracts and calls (including existing CMS name/slug validation). Provider/cache/worker optimizations have their own contracts in [architecture](architecture.md); UI selection must not add implicit provider work.

## Validation

Automated selection tests cover empty scope, unselected invalid drafts, eligibility, duplicate/foreign selection IDs, preservation of source ranges, partial replacement inside Rich Text, selected bulk filling and empty link validation. Session tests cover user/scope isolation, expiry, source changes and unavailable browser storage. Existing preview tests cover stale receipts and duplicate confirmation; server mutation tests cover validation and conflicts.

Browser validation on saved scan data: individual selection, group selection, mixed select-all state, empty editor, responsive notebook/mobile layout. No application or AI generation was triggered and no customer CMS content was modified. Provider execution remains covered by the existing automated suite, not a live write test.

## Image cards and partial review

Image group headers now show a thumbnail, decoded filename (without the Webflow asset-ID prefix), the exact original URL, occurrence count and CMS location. Individual image occurrences prefer their saved alt text, with filename fallback. No asset-library lookup is performed.

On terminal operation progress, the scan editor releases its confirmed preview and clears only the selection, allowing a new preview for remaining occurrences. Existing server outcomes decide which occurrences become reviewed; failed/conflicting/uncertain results are not promoted. Grouping precedes review filtering, so the last pending image remains visible even when its peers have been reviewed. Verified image changes have a read-only before/after image comparison in Reviewed.

Regression coverage: terminal preview reset/new request identity, single remaining repeated image, decoded filenames, verified image history and conflict exclusion. Actual Webflow writes were not used for these tests.

Image-only presentation: validated scan previews omit the raw CMS image/gallery JSON and show only the replacement image (the original thumbnail is already in the occurrence list). Reviewed images show the visual before/after pair without raw source JSON; manual reviews display the saved original image. Preview validation and exact write payloads are unchanged.

All occurrence types use the unified list/inspector layout, with the validated preview and explicit confirmation inside the inspector. Text, links, prices, phones, dates and numbers show before/editable-after in equal columns; text retains highlighted source context, AI controls and removal warnings. Full validated field differences and slug side effects remain visible before confirmation. Image editing instead embeds the URL input and live before/after inside the inspector, with one shared input for the selected group and an explicit individual-edit mode. The validated receipt, locations, counters and final apply action remain in the same panel without repeating the images. Invalid/empty URLs show a placeholder instead of mounting an image. Scan preview cards follow the selected source order, with one card per source field. Outside that ordered scan view, equal replacements may share a visual preview with all affected locations and distinct previous values. Exact URLs are not normalized. This grouping is presentation-only: source fields, receipt, counters, slug effects and write payloads remain intact. Regression tests cover distinct old values, gallery/single-image grouping, exact URL equality and unchanged input plans.

Image workspace alignment: horizontal occurrence cards use uniform thumbnails; the inspector includes a compact Select/Edit/Review guide. Before/after media share equal grid tracks and a fixed height, with the URL control in a separate grid row so neither image is displaced. Narrow containers stack the comparison. Group actions remain accessible beside the collapsed or expanded group heading. No file dimensions or byte sizes are invented.

Image editor headings use the selected CMS item names, matching the occurrence list, above the white comparison card with compact source locations. The group summary retains the readable image filename. Display filenames decode nested URL encoding and strip repeated leading Webflow asset IDs; original URLs, equality and write payloads remain unchanged.

Text inspector spacing: the source list keeps its natural height instead of stretching to the entire selected-editor stack. Before/after controls start at the same vertical position; the replacement label remains accessible without duplicating the visible After heading. Keep current value uses the bordered secondary button. Reset and AI actions share a wrapping full-width action row below the comparison. Selection, drafts and confirmation are unchanged; incremental Q/W/I/E/G = 0.

All scan value types offer Edit values individually. Equal selected drafts start with a shared editor; distinct restored values open individually. Returning to shared mode copies the first selected draft to the current selection, matching image editing. Shared text editing retains every selected source context and error; input/reset/AI draft fills target only that selection. Preview headings show affected item names above collection → item → field locations; receipt grouping and persisted fields are unchanged. Switching modes itself makes no provider request; changed drafts retain existing preview invalidation/preparation.
AI suggestions remain item-scoped: enable individual editing for AI controls, avoiding a first-item suggestion silently becoming a shared replacement. Shared edits show name/slug and Rich Text guidance if any selected source needs it.

Text preview/results emphasize changed words with React strong elements only; original strings, HTML escaping, persisted receipts and CMS payloads remain unchanged. Insertions are emphasized on After; removals on Before. Large comparisons use a bounded prefix/suffix fallback. Scan previews follow the visible selected occurrence order, using one card per source field (multiple occurrences in one field remain one atomic field change). Historical verified text uses the same display-only comparison.

Reviewed results retain canonical value groups and split their contents by verified operation identity. Each operation block shows its recorded request date (UTC), affected item names and visible occurrence/field counts. Bulk reversal lives inside that block and uses only its reversible visible fields; separate confirmations are never merged by equal values. Manual reviews remain separate, and per-field reversal keeps the existing preview/confirmation flow. No new queries or provider calls: incremental Q/W/I/E/G = 0.

Product UI calls Variables “Variables” (EN) / “Variáveis” (PT-BR). Internal identifiers, API contracts and existing managed-values routes are unchanged.

Create variable uses only the editor selection. At final inline confirmation, the user chooses a one-off edit (default) or Create variable and apply, naming the new variable. At least two unmanaged fields must share the same final value. The receipt includes name, selected sources and new target; there is no second selection or separate review route. Ineligible selections keep creation blocked with an explanation. See [the atomic confirmation contract](cms-changes.md#create-variable-from-the-inline-preview).

Switching between a one-off edit and variable creation, or editing the variable name, preserves the displayed before/after while the selected content is unchanged. The visual content key is separate from the confirmation receipt key. Retained presentation never authorizes submission: confirmation waits for the current action/name receipt. Selection, source evidence or replacement changes invalidate the retained presentation immediately.


## Scan tabs and variable provenance

CMS scan results expose Pending, Reviewed and Created variables. The former All tab is removed. Legacy `filter=all` links open Pending, or Reviewed when the saved group has only reviewed occurrences; group/query scope is preserved. Variable creation is a distinct history count, not an occurrence review status.

Creation provenance uses confirmed `managed_value_previews.managed_value_id` records scoped by actor/site/scan. The variable tab also contains variables linked to fields observed in this scan, labeled separately from variables created here. Bound fields are excluded from Pending/Reviewed presentation and counters; binding protection and mutation eligibility remain unchanged. Divergence controls are collapsed inside the variable tab.

Variable cards paginate at 20 variables and show read-only before/after context from the latest confirmed/completed persisted operation. Only applied/already-applied evidence is presented as verified. Missing evidence, conflicts and uncertainty never manufacture an applied result. Item names come from saved scan metadata. No revert control is exposed for variable operations.

Read budget: Pending/Reviewed use one narrow creation-ID query; linked IDs reuse the loaded bindings. The variable tab additionally loads narrow metadata and at most one bounded latest-operation query per visible card (up to 20), plus canonical route resolution. Snapshots/results are loaded only for these detail cards. W/I/E/G delta = 0; no provider refresh, migration or customer mutation. Variable lists/details retain canonical numeric source-scan links; missing provenance stays unknown.

Scan list counters use the same post-group variable-field exclusion as the review screen (`20260924000300_scan_variable_review_counts.sql`). Exclusion happens after duplicate eligibility: a remaining unbound peer must not disappear. Ingestion status stays unchanged in storage; completed ingestion displays Scanned while pending work remains (or counts are unavailable), and Completed only at zero pending. Limited coverage retains its warning. Collection tags expose persisted item-read counts, including zero; absent legacy counts are never invented. The summary RPC keeps Q=1 per scan-list page (up to five scan IDs), at most five summary rows; W/I/E/G +0. No new index: the existing unique `(site_id,source_key)` binding index supports the exclusion.

Local PGlite validation for the revised summary: five scans / 5,000 occurrence snapshots yield five summary rows, about 581 JSON bytes, with unchanged authenticated scope checks. Representative `EXPLAIN (ANALYZE, BUFFERS)` reports a Function Scan (~113 ms locally, 2,555 shared hits); this is synthetic local evidence, not a production latency or concurrency guarantee. Remote deployment of the count migration remains a separate approval.

In scan history cards, collection scope is compact: the first collection name plus a `+N` button opens the remaining names in a popover. Item counts remain on the scan detail collection tags, not inside list-card tags. The popover uses saved data only and closes on outside click, focus leaving, or Escape (returning focus to its trigger).
