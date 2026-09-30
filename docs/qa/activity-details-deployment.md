---
title: "Activity details deployment — 2026-09-28"
status: evidencia
tags: [replaceall, qa]
---

# Activity details deployment — 2026-09-28

Applied with explicit user authorization to Supabase project nxibjpprjorchjeoudss (Universal Value, main production) through the authenticated SQL Editor.

Preflight confirmed migrations 20260924000100–20260924000400, the existing eleven-column site_change_summaries projection, and security_invoker=true. Applied only 20260928000100_activity_details, registered its SQL/version/name in the migration ledger in the same transaction, and notified PostgREST to reload its schema. Historical migrations were not replayed.

Post-deployment checks returned true for migration registration, details JSONB column, security-invoker preservation, authenticated SELECT and denied anonymous SELECT. Evidence: activity-details-deployment.png. No customer content or Webflow writes were performed. Local validation before deployment: lint, typecheck, 876 tests and production build. Live card rendering and real-provider writes were not tested during this deployment.
