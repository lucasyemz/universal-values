# CMS editing, confirmation and execution

## Inline preview

Edit selected occurrences in the scan or a Managed Value. Group fill changes selected drafts only. The common editor prepares a persisted preview after one second without typing; AI batches wait for generation to finish. Preparation does not confirm an operation or modify Webflow/central values.

Show before/after, affected fields/items/locales and paired slug changes. Image previews show the replacement beside the existing list thumbnail; applied history shows both images, not raw gallery JSON. Ten or more fields, five or more items, and text removals receive impact notices. **Apply to N fields** is the final explicit confirmation; no mandatory separate review page or redundant checkbox.

A receipt covers the operation, connection, scan, central version/value and exact displayed payload, including frozen slug updates. Changing values/selection immediately invalidates it. Ignore late preparation responses, block duplicate clicks and require regeneration for expired/rejected previews. Ambiguous confirmation retries retain the same operation ID. The server reconstructs the authorized plan from saved evidence, not browser-supplied provider payloads.

## Durable queue and write safety

Confirmation validates/locks the immutable plan, reserves quota once, audits and admits a FIFO operation. At most 20 confirmed operations per account, including administrators. A leased, paused or retrying head blocks later operations for that account/site; independent accounts may progress. Multiple simultaneous versions of a Managed Value cannot bypass version/binding checks. Earlier queued edits can conflict with later frozen previews; there is no automatic rebase.

The worker runs independently of the browser. Before each field it revalidates current ownership, connection, site, collection, schema, item and locale, then compares the fresh source to expected evidence. If already correct, record `already_applied` without another write. Persist/audit dispatch before PATCH, verify afterward and store actual provider output. Lost/uncertain results are reconciled by reads, never blindly resent. Audit failure before dispatch prevents writing. Leases, idempotency and Retry-After remain authoritative.

Writes use staged content with `skipInvalidFiles=false`, preserve locale/draft/archive flags and never publish. Selected replacements in one field are combined; Unicode ranges apply right-to-left, HTML is escaped, and galleries preserve order/other entries/alt data while removing the substituted asset's old file ID. Webflow may import images with a new CDN URL; save actual returned evidence.

Failure/conflict/uncertainty can pause remaining work. Cancelling does not undo applied fields, and pending dispatch must reconcile first. Completion means processing ended, not every field succeeded. There is no distributed transaction or provider compare-and-swap; external edits between read/write remain a limitation.

## Partial application and sequential edits

Only verified occurrence IDs become read-only Reviewed; remaining group members stay Pending. Scan-bound operation routes resolve to the same scan review with scoped operation context; Managed Value sync without a scan has a dedicated view. Rendering does not duplicate stored operations.

`withAppliedSources` advances untouched ranges using durable prior `applied`/`already_applied` evidence. Gallery count/position/metadata must match; text requires exact response evidence and non-overlapping ranges. Never normalize URLs. Ambiguous evidence preserves the old baseline and fails safely against changed content.

`20260922000400_applied_scan_sources.sql` pins immutable prior evidence to each new preview so preview and worker construct the same plan. Deploy compatible schema and worker together. Old previews retain their baseline; regenerate them when necessary. Concurrent confirmed previews are not silently rebased.

## Side effects and recovery

- Empty replacement text removes only its exact range, preserving surrounding punctuation/spacing/HTML. Empty links, images or central values are not allowed by that mechanism; required provider fields can still reject empty text.
- Editing the system `name` field suggests a lowercase, accent-stripped, hyphenated slug from the full new name. Custom fields labeled Name do not trigger this. Freeze before/after slug in the preview; send/verify name and slug together. A changed slug consumes an extra field allowance. No unreviewed suffix, redirect or publication is created.
- Retry prepares a new preview for failed eligible fields only, not conflicts, uncertain dispatches, applied or unprocessed fields. It requires confirmation and respects cooldown.
- Revert prepares a new operation from the original snapshot and actual recorded applied output. Fresh-source mismatch blocks it; an already-restored source needs no write. Revert only eligible applied results with evidence, not manual flags or unknown outcomes. No reversal of a reversal in this flow; original audit remains.
- Managed Value ranges/versions remain protected. Independent text changes may preserve/reposition bindings only through the established verified range contract.

## Verification and operations

Fixtures, mocked providers and PGlite cover single/batch previews, receipt expiry/staleness, duplicate/ambiguous confirmation, Unicode/HTML/gallery preservation, FIFO/admission, leases, audit failure, 429, uncertain dispatch, sequential evidence, revert and isolation. They are not live-provider or multi-session concurrency tests. See [verification](verification.md), [worker setup](background-sync.md), [Managed Values](managed-value-sync.md) and [database deployment](../supabase/README.md).
