# Workspace edit deployment — 2026-09-24

Applied `20260924000400_workspace_edit` after explicit user approval to linked Supabase project `nxibjpprjorchjeoudss`.

Preflight verified the existing route allocator, absence of the new tables, hosted default grants and the three preceding September 24 ledger entries. Applied only this migration with its history entry in one transaction; notified PostgREST to reload its schema. No historical migrations replayed.

Verified all three new tables have RLS, authenticated SELECT only and no anonymous SELECT. All three public RPCs allow authenticated execution and deny anonymous execution, with empty search paths. Preview/confirmation retain security-definer validation; overview counts remain security-invoker. All three read policies and the migration ledger entry are present.

No workspace was renamed during deployment verification. No customer content, Webflow calls, credentials, Edge invocations or Gemini requests were involved. Prior local verification: lint, typecheck, 851 tests, production webpack build, desktop and mobile UI inspection.
