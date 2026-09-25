# CMS scans and saved search

## Start and scope

Open a site's New Scan, choose collections/types or a specific term, review the saved plan and explicitly start. Opening or reviewing uses persisted structure and consumes no scan quota/provider requests. Show structure freshness; **Refresh from Webflow** is explicit when absent/expired. Run Again loads the previous DB configuration, shows a summary and offers Run again / Customize; current execution checks still apply.

CMS scans read supported fields in selected collections, including draft items. They do not crawl public HTML or prove whole-site coverage. Archived items and the system slug field are excluded. Supported detection includes text, numeric values, prices, phones, dates, links and images/galleries; example/placeholder text can be found without repetition. Generic repeated-value groups require repeated occurrences; specific-term and placeholder findings may be singletons.

Links/images compare exact URLs, preserving case, query strings, fragments and trailing slashes. HTML entities may be decoded for extraction; this is not URL normalization. Do not resolve relative links, fetch destinations or compare images visually. Rich Text parsing does not execute HTML. `href`/`src` extraction is supported; embeds, background images and `srcset` are not covered.

## Exact text and numbers

Specific search is literal, not regex. Case, accent and whole-word options are independent. Normalization is for comparison only; saved mappings preserve exact original ranges. Rich Text text search cannot cross unsupported tag/entity boundaries or search attributes as text. HTML replacements escape inserted content and retain unselected markup.

Numeric fields support exact numeric-term matching (2000 does not match 12000), keeping the provider's numeric type. Unsupported/unsafe numeric forms must not silently lose precision. Text offsets are stored as Unicode code points; do not replace them with JavaScript UTF-16 indices. See detection and replacement tests for grapheme/range conversion.

## Results and review

Pending / Reviewed / All filter the already-formed groups. Applying one occurrence leaves its untouched peers pending, even the last member of a repeated group. Verified results are read-only with actual recorded before/after. Failures/conflicts/uncertainty are not applied outcomes. Manual flags do not create Variables or apply drafts; compatible source/value/snapshot flags can carry forward, but specific-term searches must not inherit unrelated historical review.

The local results filter searches saved labels/context; it never invents editable ranges from context. Quick Search on Overview uses only compatible completed/limited saved scans, explicitly showing date and collection scope. No match means only no match in that saved scan. Offer a targeted scan if exact editable evidence or coverage is missing; never start it automatically.

Only checked eligible occurrences enter preview/application. Preserve validated drafts and selection by identity/snapshot/ranges; focus alone does not select. Selection or value changes invalidate confirmation. Image lists use thumbnails and readable filenames; previews avoid raw gallery JSON. See [CMS changes](cms-changes.md) and [Variables](managed-value-sync.md).

## Bounds and execution

Technical bounds: 20 collections, 500 items, 1,000 occurrences, 2,000 characters per field, 10 matches per field; each batch reads up to 25 items and stores up to 200 occurrences. Free plans additionally limit items to 100. Limits/skipped fields produce partial coverage, not an all-clear. Current source of truth: `src/modules/scans/schema.ts` and [plan policy](free-plan.md).

The browser schedules batches at least five seconds apart; leaving the page stops scheduling and returning can resume. A 90-second lease plus revision protects atomic cursor/occurrence/audit persistence and deduplication. Provider reads may repeat after interruption without duplicating records. One active/paused scan per site; cancellation preserves evidence and requires confirmation. Reconnection invalidates continuation with the old connection.

Failures pause execution; 429 respects Retry-After. Fresh items and provider permission/source checks remain authoritative; only eligible metadata/schema is reused. The scan is not a transactionally consistent snapshot across provider pagination. There is no automatic retention/deletion policy for saved customer evidence.

## Verification

Automated tests cover detection, Unicode, numeric matching, HTML, exact URLs, limits, leases, review/application state, RLS and audit rollback. Browser/provider concurrency, real OAuth, 429 and external edits require a designated test environment; do not claim them from mocks. Group-aware result pagination is [not yet implemented](design/group-pagination.md).

## Live text context

Selected text edits show the complete resulting field immediately below the replacement input. Multiple selected ranges in one source are combined with `buildFieldChanges`, the same exact-range builder used by confirmation. Plain-text Unicode positions, Rich Text escaping, individual drafts and removals are preserved; HTML is rendered as readable text, never injected. Only selected eligible occurrences enter this display. The shared text-diff renderer highlights replacements.

This adds no Q/W/I/E/G calls. Existing asynchronous persisted-preview validation and explicit confirmation remain in place, including suggested slug changes and stale receipt protection. Images are unchanged. Designer persists its text preview when the user confirms instead of requiring a separate review-screen action; per-confirmation request/write safety remains unchanged.

Live text preview highlights unchanged selected occurrences in yellow and edited text in green. Display ranges are mapped from saved occurrence offsets (Unicode code points) into rendered text offsets, including decoded Rich Text entities; unselected repetitions are not inferred as selected. These display ranges never replace the authoritative mutation ranges.

Text editing places the replacement input above the Before/New value context columns. Confirmation omits duplicate text comparisons only when the server-validated field's exact before/after values match the local display plan. Unexpected differences and suggested slugs remain visible, and confirmation still requires the current server receipt. No validation or write-safety step is removed.
