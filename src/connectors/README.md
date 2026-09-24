# Platform connectors

Platform integration code lives here. Connectors implement provider transport, authentication and typed adapters; domain decisions belong in `src/modules`, not React or transport code.

Writes exist and must reuse the persisted preview → validation → explicit confirmation → audit contract. Preserve fresh ownership/source checks, idempotent dispatch and verified results; never resend uncertain writes or publish automatically. Read discovery does not prove an occurrence is editable.

Metadata caches/coalescing are scoped optimizations, never authorization or write-validation evidence. See [architecture](../../docs/architecture.md) and [engineering rules](../../AGENTS.md).
