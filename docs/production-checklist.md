# Production readiness — ReplaceAll

Initial assessment: 2026-09-28. Scope: prepare a closed beta; no deployment, remote changes or customer website writes authorized by this checklist.

## Current evidence

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Database migrations | User confirmed current | Confirmation in this conversation; remote schema and migration ledger were not independently checked in this assessment. Do not replay migrations blindly. |
| Local validation | Passed before this assessment | 935 tests, lint, TypeScript and webpack production build. This is not proof of production provider execution. |
| Dashboard hosting and domain | Not established | Confirm destination, HTTPS origin and deployment owner. |
| Authentication | Signup, social login and recovery implemented locally | Configure providers, SMTP and recovery template; validate live flows. See [authentication](authentication.md). |
| Webflow OAuth | Implemented | Production callback, permissions, cancellation and reconnection still need validation in the destination environment. |
| CMS worker | Deployment documented on 2026-09-23 | Current artifact, Cron, Vault/secret alignment and health require fresh read-only verification; migrations do not deploy worker code. |
| Designer extension | Build/bundle supported | Production build must explicitly set `DESIGNER_DASHBOARD_URL`; otherwise it defaults to localhost. Distribution and installation need verification. |
| Scans | Browser-scheduled | Dashboard must remain visible and online for execution. Explain this beta limitation. Confirmed CMS writes use the background worker. |
| Operations/conflicts | Implemented and tested locally | Verify new summaries after deployment using saved records; do not invent successful outcomes. |
| Secrets | Rotation not verified | Previously shared private credentials must be revoked/replaced if still active. Never copy secrets into this document. |
| Recovery and support | Not verified | Establish backup restoration, incident procedure, support contact and retention policy. |

## 1. Record the deployment decision

- [ ] Dashboard host and owner: **TBD**. User priority: free or low-cost hosting; no paid service or deployment has been approved.
- [ ] Production origin (HTTPS): **TBD**.
- [ ] Homologation origin and explicitly designated Webflow test site: **TBD**.
- [ ] Destination Supabase project and whether it is isolated from development: **TBD**.
- [ ] Beta entry: invitations/manual provisioning or self-service signup: **TBD**.
- [ ] Public release scope: CMS + Designer, or explicitly limited CMS beta: **TBD**.

Use a supported Node runtime consistent with `.nvmrc`, install from `package-lock.json`, and run a production build. The host must support the existing Next.js server actions, route handlers and proxy; static export alone is insufficient. Confirm host-specific configuration after selecting it.

## 2. Configure environment values by runtime

| Runtime | Values | Acceptance |
| --- | --- | --- |
| Dashboard | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same intended project; only public credentials use `NEXT_PUBLIC_`. |
| Dashboard server | `WEBFLOW_CLIENT_ID`, `WEBFLOW_CLIENT_SECRET`, `WEBFLOW_REDIRECT_URI` | Callback equals the registered HTTPS origin plus `/api/connectors/webflow/callback`. |
| Dashboard + worker | `WEBFLOW_TOKEN_ENCRYPTION_KEY` | Preserve the existing key when retaining encrypted integrations. Store securely; never regenerate casually. |
| Dashboard | `DESIGNER_ALLOWED_ORIGINS` | Exact origins used by the deployed extension. Remove development origins from production after confirming installation requirements. |
| Extension build | `DESIGNER_DASHBOARD_URL` | Explicit production origin in the build process; the script does not read it from `.env.local`. Inspect the generated bundle before distribution. |
| Edge worker | `CMS_WORKER_CRON_SECRET` | Matches Vault's `cms_worker_cron_secret`; hosted Supabase provides its reserved runtime credentials. |
| Local Node worker only | `SUPABASE_SERVICE_ROLE_KEY` | Private; not required in the browser and not a reason to grant the dashboard privileged access. |
| Optional MCP | `MCP_SERVER_ORIGIN` | Exact deployed origin if MCP is included; otherwise keep the feature disabled. |

See [environment template](../.env.example), [Webflow](webflow.md), [Designer](designer-dashboard.md) and [worker runbook](background-sync.md).

## 3. Validate access before inviting users

- [ ] Set the intended Supabase Auth site/redirect configuration for the chosen flow.
- [ ] Validate self-service onboarding: signup is implemented; confirm email delivery, provider settings and first-workspace creation with a designated test account.
- [ ] Provide and test a password-reset flow, or document a secure assisted-access process for a strictly invitation-only beta.
- [ ] If using email invitations/recovery, configure delivery and test receipt, expiry and invalid links with a new account.
- [ ] Test a non-admin account from workspace creation through Webflow authorization and site linking.
- [ ] Test a second account cannot open the first account's site, resources or operations, including legacy URLs.
- [ ] Confirm Free quotas and global admission policy fit the beta; do not use administrator accounts to validate commercial limits.
- [ ] Verify previously exposed private credentials are revoked; retain encryption compatibility when replacing credentials.

## 4. Verify infrastructure and recovery

- [ ] Confirm database schema/history at the exact target without replaying already-applied manual migrations.
- [ ] Compare worker release with the chosen application release; rebuild/deploy compatible artifacts explicitly.
- [ ] Read Cron activation, scheduling, worker health and pending/uncertain operations. A check diagnostic must not execute customer changes.
- [ ] Establish errors/queue-stall alerts without logging customer content or secrets.
- [ ] Confirm available backups and perform a restoration exercise in an isolated environment.
- [ ] Define retention/cleanup for expired previews and abandoned authorization records, preserving required audit and references.
- [ ] Document rollback: previous application artifact, compatible worker/schema and pause procedure. Do not treat destructive down-migrations as a default rollback.

## 5. Acceptance test in homologation

Use only synthetic content or an explicitly designated test site. Website changes require normal preview and final user confirmation.

- [ ] New ordinary account → login → workspace → Webflow → linked site.
- [ ] Text/link/image scan → individual/group replacement → exact preview → confirmation → verified result.
- [ ] Variable synchronization with one healthy source and one externally changed source → conflict review → confirmed resolution → correct attention summary.
- [ ] Supported revert, duplicate confirmation, revoked connection, timeout/uncertain outcome and Retry-After recovery.
- [ ] Close the browser after confirming a CMS change and verify the background worker completes it.
- [ ] Verify scan suspension/resumption when the dashboard is hidden/offline and communicate the limitation.
- [ ] Install the production-origin Designer bundle; test connection and supported text/link/image flows.
- [ ] Mobile/desktop navigation, persisted menu choices, readable errors and English/PT-BR.

Record environment, commit, date and outcome for each test. Local automated tests and a health HTTP 200 do not satisfy these end-to-end checks.

## Release gate

Invite beta users only after sections 1–4 are resolved and the chosen launch scope passes section 5. Have a reachable support contact, onboarding instructions and appropriate privacy/terms information before collecting real users' data. Billing and broader public launch remain separate work.

This assessment changed documentation only. No remote deployment, migrations, credentials or provider content were changed.

### Authentication release gate

Follow [authentication setup](authentication.md): configure APP_ORIGIN, Google/Apple/Microsoft, email confirmation, SMTP and the required recovery template. Local implementation does not establish live provider readiness.
