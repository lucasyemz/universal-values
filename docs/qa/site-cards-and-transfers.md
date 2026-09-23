# Compact site cards and workspace transfers

## UI

- Light cards with a linked thumbnail/name, truncated domain and connection status.
- Responsive 1/2/3/4-column grid. Native popover contains current product destinations, explicit metadata refresh and Transfer site.
- No Webflow reads from opening the list or menu. Opening the transfer dialog reads destination workspaces from CopyReplace only.
- Native dialog traps focus; Escape/cancel and focus restoration are supported. Transfer confirmation disables duplicate submission.

## Transfer contract

Transfers are between CopyReplace workspaces owned by the same account, not Webflow project ownership transfers. The target needs an existing ready Webflow authorization for the same provider site. Authorizing the site there is sufficient; do not create a duplicate local site. Preparation checks up to 20 recent target authorizations with read-only provider calls; confirmation rechecks the selected authorization. A provider error stops immediately, with no retry loop. Completed confirmation retries skip provider access.

`20260923000900_site_transfers.sql` adds owner-scoped previews/confirmation audit and transactional RPCs. Selected composite scope foreign keys become DEFERRABLE INITIALLY IMMEDIATE, so the transfer can update the existing graph atomically; outside this transaction their checks remain immediate. No record IDs, resource numbers, account slugs, site slugs, content, binding ranges or usage counters are recreated.

The transaction locks the preview, memberships, site and existing scan/change rows; uses the existing site advisory lock; revalidates current ownership, connection, names and expiry; refuses active/paused scans, confirmed/dispatched CMS work, uncertain bindings and duplicate destination sites. The old and new workspace/connection identifiers and names remain in the transfer audit row. Confirmation is idempotent by preview ID.

Pending previews expire, Designer sessions are revoked with audit, and the existing metadata invalidation trigger clears connection-specific cached structure. Saved scan/Managed Value/change records move together. Historical records whose policies follow a site retain that relationship. Destination access follows existing RLS, and members of only the source lose access.

No Webflow writes, publishing, AI changes or worker/polling changes.

## Validation

- Browser: authenticated site list, compact cards, menu destinations, Escape closing, transfer modal and destination-workspace list. Checked narrow viewport and 1440px desktop; no provider refresh, preview submission or real transfer was performed.
- PostgreSQL/PGlite: seven synthetic tests covering atomic history/occurrence movement, stable public routes, idempotence, cross-account denial/RLS, expired previews, revoked connections, active scans/confirmed changes, duplicate destinations, lost membership, preserved Managed Value bindings and completed changes, Designer session revocation, source-member access removal.
- Lint/typecheck/full suite: passed (792 tests).
- Production build: passed (`next build --webpack`).
- Remote migration: 20260923000900 applied with explicit user approval on 2026-09-23. Dry run confirmed it was the only pending migration. Verified migration history, enabled RLS, denied anonymous SELECT/confirmation, and authenticated confirmation grant. No real site was transferred. Real provider transfer confirmation remains untested intentionally.
