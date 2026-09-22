# Confirmed CMS change queue

Apply `supabase/migrations/20260922000300_cms_change_queue.sql` before using simultaneous confirmations. The existing worker/Edge schedule remains in place; no extra cron frequency or provider polling is added. This change was validated locally; the migration has not been applied to the remote Supabase project by this task.

- Each operation requires its own validated preview and explicit confirmation. Confirmation keeps the same immutable payload, receipt, permissions, binding checks and audit events.
- Confirmed operations receive an immutable sequence number, with account admission serialized even for administrators. A maximum of 20 confirmed operations per account bounds queue storage/work; this is a technical queue cap, not a monthly allowance.
- The existing worker claims the oldest confirmed operation for each account/site. A leased, paced, retrying or paused head blocks later work, including under `FOR UPDATE SKIP LOCKED`. Another account can still progress.
- Once completed/cancelled, the next operation becomes eligible. Closing the browser does not cancel the queue. An uncertain/dispatched operation still requires reconciliation before cancellation; the queue cannot bypass that rule.
- Worker execution re-reads CMS sources and validates the original field/slug against the confirmed preview. Earlier queued edits to the same source may cause a conflict; there is no automatic rebase or overwrite.
- Free quotas are reserved once at confirmation, including extra slug fields. Queuing does not increase the monthly field allowance or refund cancellations. Free scan/change overlap is still blocked. Administrators bypass commercial quotas, not sequential dispatch or queue capacity.
- Multiple simultaneous versions of the same Managed Value remain blocked. Its version/binding snapshot cannot be silently rebased. Existing Managed Value preview safeguards are retained.
- Progress displays queue position using persisted CopyReplace records. The existing 15-second progress cadence remains unchanged; this adds one database count to that existing progress read for confirmed requests, not a Webflow/Gemini/Edge request.

## Validation

PGlite migrations and tests exercise confirmation-order FIFO, admission cap, owner isolation, quota idempotency, expiry, lease exclusion, retry/paused heads, cancellation release and independent accounts. The real worker gateway tests now load all migrations and verify sequential operations, crash recovery, stale leases, durable dispatch, audit failure, revoked permissions and provider cooldowns with a fake Webflow connector. No real customer content was written.

PGlite uses a single embedded connection; these tests do not claim a separate multi-session PostgreSQL load test. Production concurrency protection relies on transaction advisory locks for admission, ordered eligibility and row leases for dispatch.
