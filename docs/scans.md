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

The “Variables created” tab and count include only confirmed creation provenance in `managed_value_previews` for the current scan, site and actor. Existing variables merely linked to scanned sources must not enter this list or its divergence details; users access the full catalog under Variables. Protected occurrence/write eligibility remains unchanged.

New Scan uses a single CMS configuration form inspired by the Designer: Text, Links, Images and Advanced mode beside explicit collection selection. Text offers a literal term and matching options, or repeated-text detection when empty; links/images show their existing exact-URL scope without inventing live checks or unique-link coverage. Advanced preserves mixed detection types, numbers, prices, phones, dates and repeat customization. Inactive mode fieldsets are disabled so hidden text/options cannot leak into link/image payloads. The configuration form starts the read directly on Search, without an intermediate review screen or saved draft. The explicit Search action submits the visible selected scope to a single atomic RPC that reuses existing preview validation, confirmation, quotas and audit. A failed start rolls back the entire record. Repeat uses the same atomic gateway. Migration 20260928000200 revokes direct client preview creation and removes unused historical previews while retaining audit and permanent resource numbers. No static-page controls or implicit refresh are introduced; setup Q/W/I/E/G = 0, repeat start Q decreases by one. Migration applied with explicit approval on 2026-09-28; see [deployment verification](qa/start-scans-deployment.md).

Completed scans with known zero pending and zero reviewed occurrences display a neutral No results badge across history, overview and scan details. These cards omit Review occurrences and retain Run again. Missing counts never imply no results; partial, cancelled and active scans retain their own status. This is presentation-only, with Q/W/I/E/G delta 0.

Scan start maps only PostgreSQL 23505 on one_active_cms_scan to an active-scan notice, with a link to the site's scans. Running and paused scans hold this slot. Other start failures do not imply a connection problem; provider-scope loading failures retain their connection guidance. Repeat uses the same classifier. No additional queries or provider calls.

## Confirmed scan queue

Migration `20260928000300_scan_queue.sql` adds queued scans, monotonic queue ordering and a 20-scan technical admission bound per actor (including administrators). Admission reserves monthly scan quota once; cancellation does not refund it. Atomic start still commits only after explicit Search. A shared database runnable predicate serializes scans by actor/site and respects older paused work, leases and Retry-After. Free accounts wait for confirmed CMS changes; CMS write workers are unchanged. Queued work can be cancelled through the existing confirmation/audit path.

The dashboard activity panel runs one bounded read batch at a time for already-confirmed scans, while open, visible and online. It never resumes paused work automatically. Closing the dashboard suspends execution, not the saved queue; opening it again continues eligible confirmed work. Scan details observe progress and expose explicit resume/cancel. Scans and overview badges distinguish Queued (clock), In progress (spinner), and paused/terminal outcomes.

Queue execution adds one narrow next_cms_scan RPC per dispatch attempt, followed by the existing batch work (unchanged W/I cost per batch, E/G +0). Work is paced at least five seconds after each batch; no eligible job waits 15 seconds; errors back off to 30 seconds. The runner mounts only while activity contains active/queued scans, and suspends timers offline/hidden. Detail observation is every 15 seconds with a narrow scan projection and current ownership checks; full plans remain limited to execution/result use. Activity observation keeps its existing 15/60-second cadence. No provider refresh, scan admission or quota consumption occurs on navigation; only previously confirmed work can progress.

Local tests cover FIFO, duplicate admission, lease exclusion, paused-head blocking, Retry-After, cancellation, foreign-account denial and the admin queue bound. PGlite tests do not establish production multi-session concurrency. Migration applied with explicit authorization on 2026-09-28; see [deployment verification](qa/scan-queue-deployment.md).
