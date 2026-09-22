# Dashboard / Designer interaction pattern

## Implemented: scan review

- Compact occurrence list with collection, item → field, highlighted context and status.
- Checkboxes are the edit scope. Focus alone never selects a target.
- One selected occurrence opens its editor; multiple selections show Group edit.
- Bulk fill changes selected drafts only. Unselected drafts remain stored, but cannot enter validation or application.
- Selection persists in session storage for 24 hours, scoped by user, scan and canonical group. Changed source content, ranges or eligible occurrences invalidate restoration.
- Desktop uses list + inspector based on available container width (700px), accounting for the dashboard sidebar. Narrow screens stack the panels. Lists have bounded height and keyboard focus.
- Secondary group actions (review flags and centralization) remain separate in More group actions; their selections and confirmation contracts are unchanged.
- AI batch targets are only mounted selected occurrences. The label explicitly says Fill selection with AI. Generation still requires a click.
- Collection coverage remains available in an expandable summary. Counts, limitations and source freshness are preserved.
- Shared Diff now uses labeled before/after panels, matching the Designer visual pattern. Reviewed occurrences use the same component with explicit historical labels and remain read-only.

## Durable UI rules

Use existing light-mode tokens: white surfaces, #F7F9FC app background, #1557FF primary, #EAF1FF selection, #111827 ink, #D9E0EA borders. Selected controls need a checked control and border/indicator, not just background color. Keep tables for site inventories and history. Use the list + inspector for editing work. Essential consequences, errors, scope and confirmation remain visible; technical metadata and secondary actions can be expanded.

## Safety and request costs

Existing InlineReview and prepare/apply actions are reused. Selection is included in the preview key, so changing it invalidates confirmation even if resulting writes happen to be identical. Managed Value protection is applied before selection; offsets and URL equality remain unchanged. No new provider endpoints, polling, metadata fetches or Gemini generation triggers were introduced. Selection, expanding groups and bulk draft filling are local; preview preparation and explicit application retain existing contracts and calls (including existing CMS name/slug validation). This does not implement cost-audit phases B–E.

## Validation

Automated selection tests cover empty scope, unselected invalid drafts, eligibility, duplicate/foreign selection IDs, preservation of source ranges, partial replacement inside Rich Text, selected bulk filling and empty link validation. Session tests cover user/scope isolation, expiry, source changes and unavailable browser storage. Existing preview tests cover stale receipts and duplicate confirmation; server mutation tests cover validation and conflicts.

Browser validation on saved scan data: individual selection, group selection, mixed select-all state, empty editor, responsive notebook/mobile layout. No application or AI generation was triggered and no customer CMS content was modified. Provider execution remains covered by the existing automated suite, not a live write test.

## Image cards and partial review

Image group headers now show a thumbnail, decoded filename (without the Webflow asset-ID prefix), the exact original URL, occurrence count and CMS location. Individual image occurrences prefer their saved alt text, with filename fallback. No asset-library lookup is performed.

On terminal operation progress, the scan editor releases its confirmed preview and clears only the selection, allowing a new preview for remaining occurrences. Existing server outcomes decide which occurrences become reviewed; failed/conflicting/uncertain results are not promoted. Grouping precedes review filtering, so the last pending image remains visible even when its peers have been reviewed. Verified image changes have a read-only before/after image comparison in Reviewed.

Regression coverage: terminal preview reset/new request identity, single remaining repeated image, decoded filenames, verified image history and conflict exclusion. Actual Webflow writes were not used for these tests.

Image-only presentation: validated scan previews omit the raw CMS image/gallery JSON and show only the replacement image (the original thumbnail is already in the occurrence list). Reviewed images show the visual before/after pair without raw source JSON; manual reviews display the saved original image. Preview validation and exact write payloads are unchanged.
