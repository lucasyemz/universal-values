---
title: "Webflow sign-in setup"
status: atual
tags: [replaceall, guia]
---

# Webflow sign-in setup

The app supports `custom:webflow` through Supabase's custom OAuth2 provider. It is **disabled by default** until the following external configuration and live tests are complete. No database migration is needed.

## Separate Webflow login app

Use the dedicated **ReplaceAll Login** app for sign-in, with `authorized_user:read` and the exact callback displayed by Supabase. The current Webflow form accepts one redirect URI. Preserve the original CMS app, its credentials and `/api/connectors/webflow/callback` redirect. Enter the login app's Client ID/Secret directly in Supabase, not in the CMS environment variables.

Supabase manages identity/session. Login never installs a CMS credential or manually merges accounts by email.

## Supabase provider

Open Authentication → Providers → New Provider → Manual configuration (OAuth2):

| Field | Value |
| --- | --- |
| Identifier | `custom:webflow` |
| Name | `Webflow` |
| Client ID / Client Secret | ReplaceAll Login app credentials, entered directly in Supabase |
| Authorization URL | `https://webflow.com/oauth/authorize` |
| Token URL | `https://api.webflow.com/oauth/access_token` |
| UserInfo URL | `https://nxibjpprjorchjeoudss.supabase.co/functions/v1/webflow-userinfo` |
| Scopes | `authorized_user:read` |
| Email optional | Off |
| Attribute mapping | Leave empty; the adapter already maps `id` to `sub` |

Keep PKCE enabled initially. Webflow's public OAuth documentation does not establish PKCE support; verify the actual exchange. If interoperability fails, inspect the safe provider error and confirm the cause before changing this setting. Do not disable security options speculatively. The dashboard-to-Supabase leg uses SSR PKCE regardless.

Copy the **exact custom-provider callback** displayed by Supabase into the dedicated login Webflow app. Do not assume it matches the built-in-provider callback. Keep `APP_ORIGIN` and Supabase's allowed redirect `/auth/callback` aligned with the dashboard where the user starts the flow.

## Public adapter and enablement

Supabase calls UserInfo server-to-server. The hosted `webflow-userinfo` Edge Function works while the dashboard stays on localhost; no tunnel is required. It bundles the same connector and HTTP handler as the optional Next.js route, with dependencies resolved from the repository lockfile.

Build with `node scripts/build-webflow-userinfo.mjs`, then deploy only `webflow-userinfo` to the intended project. `supabase/config.toml` sets `verify_jwt=false` because the incoming bearer is a Webflow token, not a Supabase JWT. The connector validates that token with Webflow before returning identity. No function secrets, database access or service-role key are needed. Only GET is allowed. Tokens in query parameters are not accepted. The function does not log request headers or identities.

Set `WEBFLOW_LOGIN_ENABLED=true` in the dashboard environment after configuring the provider, then restart. This controls the button and optional Next route; the deployed Edge endpoint validates Webflow tokens independently. To roll back availability, disable the provider/button; remove the function if it is no longer needed.

The adapter accepts a bearer token, calls only Webflow's fixed `token/authorized_by` endpoint, and returns stable `sub`, email and display name. It never stores/logs tokens, follows redirects, copies upstream error bodies or uses service-role credentials. Responses are no-store. Missing ID/email fails closed.

Webflow does not return an email-verification claim. The adapter deliberately returns `email_verified: false`. Keep Supabase email confirmation enabled; configure SMTP and test any additional verification Supabase requests, including same-email existing accounts. Never force this claim to `true` to bypass a failed login.

## Acceptance tests before enabling for users

- New user: authorize → any required email verification → valid ReplaceAll session → normal workspace setup.
- Existing user: repeat login returns to the correct account. A matching email must not bypass Supabase's identity-linking/verification policy.
- User cancels authorization: generic login error, no session granted.
- Invalid/replayed authorization code: no session granted.
- Existing CMS connection still reads normally after login/relogin. Confirm consent scopes when reusing the same Webflow app.
- No site is connected, modified or published merely by logging in.

Automated tests cover identity mapping, unverified email, malformed credentials, missing identity, upstream failure redaction and explicit enablement. Live OAuth/token-exchange compatibility is **not yet verified**; it needs registered callbacks, provider configuration and a public adapter.

## Request budget

No application DB queries, credential-store reads, worker invocations or AI calls are added by the adapter: Q/I/G = 0. The hosted endpoint adds E = 1 per invocation (including rejected requests); the old Next route used E = 0. Each valid UserInfo request performs W = 1 Webflow read, without retries, with a five-second timeout. Invalid credentials/disabled adapter perform W = 0. Supabase performs OAuth and identity persistence internally. Do not poll this endpoint.

References: [Webflow OAuth](https://developers.webflow.com/data/reference/oauth-app), [authorized user](https://developers.webflow.com/data/reference/token/authorized-by), [custom Supabase providers](https://supabase.com/docs/guides/auth/custom-oauth-providers).
