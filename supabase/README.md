# Persistence

No database migrations have been applied. The next persistence milestone includes workspaces, memberships, sites and RLS, with tenant-isolation tests.

Before introducing any business mutation, implement the preview/validation/confirmation/audit workflow and transactional idempotency. Credentials and privileged keys must remain server-side.
