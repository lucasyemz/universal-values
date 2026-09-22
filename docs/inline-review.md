# Inline CMS review

The common scan editor (individual or repeated-value group) and Managed Value editor now show persisted, validated previews directly below the editable fields. Changes update the preview after one second without typing; AI batches wait until generation finishes before preparing it. Group input fills the individual draft fields immediately. Preparing does not confirm an operation, change a Managed Value, write to Webflow or publish a site.

The preview displays complete before/after fields, affected CMS items (including locale variants), image previews, paired slug changes and the central value when relevant. Changed slugs count as extra fields. Ten or more fields, five or more items, and text removals receive an impact notice. The final **Apply to N fields** button is explicit authorization; no additional checkbox or mandatory review page is used. Slug URL/redirect implications and partial conflict handling are shown before confirmation.

## Consistency and safety

- The server loads the owner-authorized persisted operation and builds its full plan, including frozen slugs. No incomplete slug preview can be confirmed.
- A SHA-256 receipt covers the operation, connection, scan, central version/value and exact displayed field payloads. Confirmation requires `confirmed: true` and a matching receipt from a fresh authorized load.
- Persisted changes are RPC-only and idempotent by operation ID; prepared slugs are immutable. The existing confirmation RPC locks the operation, rechecks connection/binding/version constraints, reserves quota once, records the audit and schedules the worker. The existing worker still rereads each source, prevents conflicting writes and reconciles uncertain dispatches.
- The editor state machine invalidates a receipt immediately when the effective values or occurrence selection change, ignores late preparation responses and blocks duplicate clicks. Expired or definitively rejected previews require regeneration. Ambiguous confirmation failures retry the same operation ID.
- Fields are disabled during confirmation. Progress and conflict/failure counts remain inline, with an optional link to full results. Legacy operation URLs and specialized reversal/divergence workflows remain available.
- Preparation continues to count toward existing preparation quotas. A stable draft reuses its operation ID on retry. No quota bypass or new migration was introduced.

## Verification

Tests cover single and batch field counts, slug side effects and digest changes, late/stale previews, expiry, duplicate clicks, ambiguous retry, denied access, database rejection and Managed Value version checks. Existing database tests verify confirmation/dispatch idempotency and audit transactions; executor tests verify conflicts and no writes before confirmation. All verification uses fixtures, mocked connectors and local PGlite databases, never customer websites.

Scan operation URLs now redirect to `/dashboard/scans/:scanId?filter=reviewed&operation=:id` after ownership validation. The scan review is the canonical destination for completed changes, reversals, progress and conflict details. The duplicate operation-details panel is removed from scans. Each occurrence displays its latest outcome, while verified before/after history remains separate from failed attempts. Only necessary preview, active progress and cancellation controls are rendered above the cards; failed/conflicting pending items remain accessible. The controls verify that the operation belongs to the displayed scan. Rendering these views performs no inserts: scan snapshots, change requests and audit events retain their existing roles; the unique confirmed-operation index still enforces one active application per site. Managed Value syncs without a scan retain their dedicated operation view. Existing action redirects remain compatible through the old route, including their error context.
