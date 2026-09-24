# Dashboard / Designer interaction pattern

## Implemented: scan review

- Compact occurrence list with collection, item → field, highlighted context and status.
- Checkboxes are the edit scope. Focus alone never selects a target.
- One selected occurrence opens its editor; multiple selections show Group edit.
- Bulk fill changes selected drafts only. Unselected drafts remain stored, but cannot enter validation or application.
- Selection persists in session storage for 24 hours, scoped by user, scan and canonical group. Changed source content, ranges or eligible occurrences invalidate restoration.
- Desktop uses list + inspector based on available container width (700px), accounting for the dashboard sidebar. Narrow screens stack the panels. Lists have bounded height and keyboard focus.
- Secondary group actions (review flags and centralization) live in a Group actions popover beside the group heading, accessible while the group is collapsed; centralization opens its existing form. Escape closes the popover and restores trigger focus; clicking outside also closes it. Their selections and confirmation contracts are unchanged.
- AI batch targets are only mounted selected occurrences. The label explicitly says Fill selection with AI. Generation still requires a click.
- Collection coverage remains available in an expandable summary. Counts, limitations and source freshness are preserved.
- Shared Diff now uses labeled before/after panels, matching the Designer visual pattern. Reviewed occurrences use the same component with explicit historical labels and remain read-only.

## Durable UI rules

Use existing light-mode tokens: white surfaces, #F7F9FC app background, #1557FF primary, #EAF1FF selection, #111827 ink, #D9E0EA borders. Selected controls need a checked control and border/indicator, not just background color. Use compact responsive cards for site inventories and tables/lists for history. Use the list + inspector for editing work. Essential consequences, errors, scope and confirmation remain visible; technical metadata and secondary actions can be expanded.

## Safety and request costs

Existing InlineReview and prepare/apply actions are reused. Selection is included in the preview key, so changing it invalidates confirmation even if resulting writes happen to be identical. Managed Value protection is applied before selection; offsets and URL equality remain unchanged. No new provider endpoints, polling, metadata fetches or Gemini generation triggers were introduced. Selection, expanding groups and bulk draft filling are local; preview preparation and explicit application retain existing contracts and calls (including existing CMS name/slug validation). Provider/cache/worker optimizations have their own contracts in [architecture](architecture.md); UI selection must not add implicit provider work.

## Validation

Automated selection tests cover empty scope, unselected invalid drafts, eligibility, duplicate/foreign selection IDs, preservation of source ranges, partial replacement inside Rich Text, selected bulk filling and empty link validation. Session tests cover user/scope isolation, expiry, source changes and unavailable browser storage. Existing preview tests cover stale receipts and duplicate confirmation; server mutation tests cover validation and conflicts.

Browser validation on saved scan data: individual selection, group selection, mixed select-all state, empty editor, responsive notebook/mobile layout. No application or AI generation was triggered and no customer CMS content was modified. Provider execution remains covered by the existing automated suite, not a live write test.

## Image cards and partial review

Image group headers now show a thumbnail, decoded filename (without the Webflow asset-ID prefix), the exact original URL, occurrence count and CMS location. Individual image occurrences prefer their saved alt text, with filename fallback. No asset-library lookup is performed.

On terminal operation progress, the scan editor releases its confirmed preview and clears only the selection, allowing a new preview for remaining occurrences. Existing server outcomes decide which occurrences become reviewed; failed/conflicting/uncertain results are not promoted. Grouping precedes review filtering, so the last pending image remains visible even when its peers have been reviewed. Verified image changes have a read-only before/after image comparison in Reviewed.

Regression coverage: terminal preview reset/new request identity, single remaining repeated image, decoded filenames, verified image history and conflict exclusion. Actual Webflow writes were not used for these tests.

Image-only presentation: validated scan previews omit the raw CMS image/gallery JSON and show only the replacement image (the original thumbnail is already in the occurrence list). Reviewed images show the visual before/after pair without raw source JSON; manual reviews display the saved original image. Preview validation and exact write payloads are unchanged.

All occurrence types use the unified list/inspector layout, with the validated preview and explicit confirmation inside the inspector. Text, links, prices, phones, dates and numbers show before/editable-after in equal columns; text retains highlighted source context, AI controls and removal warnings. Full validated field differences and slug side effects remain visible before confirmation. Image editing instead embeds the URL input and live before/after inside the inspector, with one shared input for the selected group and an explicit individual-edit mode. The validated receipt, locations, counters and final apply action remain in the same panel without repeating the images. Invalid/empty URLs show a placeholder instead of mounting an image. Equal new text values share one result with all affected locations and distinct previous values; equal image replacement sets share one visual preview. Exact URLs are not normalized. This grouping is presentation-only: source fields, receipt, counters, slug effects and write payloads remain intact. Regression tests cover distinct old values, gallery/single-image grouping, exact URL equality and unchanged input plans.

Image workspace alignment: horizontal occurrence cards use uniform thumbnails; the inspector includes a compact Select/Edit/Review guide. Before/after media share equal grid tracks and a fixed height, with the URL control in a separate grid row so neither image is displaced. Narrow containers stack the comparison. Group actions remain accessible beside the collapsed or expanded group heading. No file dimensions or byte sizes are invented.

Image editor headings use the selected CMS item names, matching the occurrence list, above the white comparison card with compact source locations. The group summary retains the readable image filename. Display filenames decode nested URL encoding and strip repeated leading Webflow asset IDs; original URLs, equality and write payloads remain unchanged.
