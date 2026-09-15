# Platform connectors

All platform integration code belongs here, starting with `webflow/`.

No remote writes are implemented yet. Before enabling writes, implement server-side preview, validation, explicit confirmation tied to the reviewed payload, persistent idempotency and an audit log. A client boolean is not sufficient authorization.

Read-only discovery and mutation capabilities must be explicit. Never assume a detected HTML occurrence is an editable source.
