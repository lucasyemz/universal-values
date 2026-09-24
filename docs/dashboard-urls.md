# Dashboard URLs

Site resource addresses and workspace lists/settings use the same workspace folder namespace, resolved inside the signed-in account. Site slugs and resource numbers remain stable. Site resources add a permanent positive number per resource type and site. IDs in PostgreSQL, actions, API calls and audit records remain UUIDs.

| Resource | Public address |
| --- | --- |
| Scan | `/dashboard/{workspace}/sites/{site}/scans/1` |
| Scan review operation | `/dashboard/{workspace}/sites/{site}/scans/1?filter=reviewed&operation=2` |
| Managed Value | `/dashboard/{workspace}/sites/{site}/managed-values/1` |
| Managed Value preview | `/dashboard/{workspace}/sites/{site}/managed-values/preview/1` |
| CMS operation entry / Managed Value sync | `/dashboard/{workspace}/sites/{site}/operations/1` |
| Static page operation | `/dashboard/{workspace}/sites/{site}/changes/1` |
| Global Facts preview | `/dashboard/{workspace}/sites/{site}/facts/preview/1` |
| Global Facts version | `/dashboard/{workspace}/sites/{site}/facts/versions/1` |
| Site connection preview | `/dashboard/{account}/setup/sites/1` |
| Workspace preview | `/dashboard/{account}/setup/workspaces/1` |
| Workspace site list (all workspaces) | `/dashboard/{workspace}/sites` |
| Workspace Webflow settings (all workspaces) | `/dashboard/{workspace}/settings/webflow` |

Apply `20260921000400_dashboard_resource_routes.sql` before using the updated dashboard. It registers existing records deterministically by creation/expiry timestamp and UUID tie-breaker, then registers new records transactionally. Separate sites can each have scan 1. Deletion, archiving, pagination or changes to search filters never renumber resources. A locked counter and unique constraints prevent concurrent allocations from colliding; record IDs remain unchanged.

The authenticated proxy resolves public routes to the original internal handlers. Legacy GET/HEAD links redirect to public addresses with query parameters preserved. Legacy POSTs keep their handlers; public POSTs rewrite internally without changing form payloads, CSRF handling, permission checks or idempotency keys. The operation query parameter is resolved within the site and verified against the exact scan. Invalid, missing or inaccessible resource mappings fail closed instead of falling back to another site's record.

The scan and resource lists, overview and process panel generate workspace-scoped resource links directly. Older saved bookmarks and internal action redirects continue to work through the proxy. CMS operations tied to a scan retain the existing redirect into its review; Managed Value sync operations remain standalone because they have no scan. Connection callback entry URLs retain the OAuth contract and immediately redirect into workspace settings. API endpoints and external Designer handoff identifiers are outside the public dashboard URL numbering contract.

`dashboard_resource_routes` stores routing metadata only; it does not duplicate scans, reviews or content. It is read-only to authenticated clients and filtered by account through RLS. Source handlers retain their authorization checks. No migration writes to Webflow.

## Workspace folders and stable names

Examples: `/dashboard/kazama-test/sites` and `/dashboard/outros-sites/sites`. The primary workspace has no special canonical format. `workspace_routes` allocates stable names within the account; identical names in different accounts do not force suffixes. A flat slug is resolved only under the verified current account. Never fall back to a global slug lookup.

Old `/dashboard/{account}/sites` remains a primary-workspace compatibility alias only when no actual workspace slug matched. Old `/dashboard/{account}/workspaces/{workspace}/sites` must match the current account. GET/HEAD redirects preserve query strings; POST rewrites preserve action bodies. The flat format needs no additional schema migration.

Account slugs are stable names derived from the email prefix (never the full email), globally disambiguated at allocation and unchanged by email updates. Site slugs are unique within the account across its workspaces; rename/reconnect/transfer does not rename them. Workspace transfers change the workspace segment; site slugs/resource numbers remain stable. Old account/site aliases resolve the current workspace. A prior workspace path does not silently resolve a site now in another workspace. Public names and numbers never replace ownership checks.

Site cards link to `/dashboard/{workspace}/sites/{site}/overview`. The bare site entry currently redirects to `/scans`; use an explicit section URL when that destination matters. Other sections include `/scans/new`, `/managed-values`, `/changes` and `/cms`.

## Implementation and regression contract

Use `src/modules/routes/resources.ts` for resources, `links.ts` for server links, `resolve.ts` for resource resolution, `site-resolve.ts` for site/workspace scope, `workspace-resolve.ts` for workspace lists and `src/modules/sites/workspace-url.ts` for workspace formats. The authenticated proxy handles compatibility. Test both workspaces, foreign-account rejection, ambiguous legacy aliases, query preservation and POST rewrites, plus stable/concurrent resource allocation and site/scan operation ownership.

## Compatibility and integration rollout

`/dashboard/lucasmatrixx/sites/universal-test/overview` redirects to `/dashboard/kazama-test/sites/universal-test/overview` when that is the authorized site's current workspace. The same contract covers scans, CMS, Managed Values, static changes and Global Facts. Canonical workspace routes take precedence over legacy account aliases: if that workspace exists but does not contain the site, return not found. Never fall back to another workspace/account.

Account-level setup previews still use `/dashboard/{account}/setup/...` because workspace creation has no destination workspace yet. Internal UUID handlers, action payloads and API/security identifiers are unchanged. MCP tool input `account` remains its authorization contract; returned dashboard links use the authenticated token's workspace.

Migration `20260923001000_workspace_site_urls.sql` updates Designer-generated URLs and adds the workspace slug to the existing MCP authentication response. It changes only presentation metadata, not authorization/quotas/dispatch, tables, saved IDs or numbering. Applied to the linked project on 2026-09-23 with explicit user authorization. Old integration links remain usable via authenticated redirects. The dashboard change itself uses the existing workspace routes without a migration.

## Verification — 2026-09-23

Lint, typecheck, 806 tests (141 files), production webpack build and diff checks passed. Added account/workspace isolation, namespace collision, moved-site alias, resource-family and POST/query tests. Local PGlite covers the complete migration chain and Designer/MCP scoped links, revoked access and unchanged read-only behavior. Automated tests used local databases; the authorized remote deployment is recorded below.

Authenticated browser checks: old `lucasmatrixx` overview redirected to `kazama-test`; scan list and scan 19 Reviewed loaded with the filter preserved; `outros-sites` opened Fluency Plus with its own workspace-scoped overview and links. No scans, provider refreshes, confirmations, site transfers or customer-content writes were triggered. Runtime provider request delta: W/I/E/G +0. The deployed gateway definitions now return workspace routing metadata. A real Designer/MCP client reconnection was not performed during deployment; compatibility redirects were verified in the browser.

Remote activation (2026-09-23): applied only `20260923001000` to `nxibjpprjorchjeoudss`. The CLI dry-run stalled and was interrupted without applying migrations. Executed the unchanged migration through the linked SQL command with its history insert in one transaction; did not repair/replay historical migrations. Verified version/name, exact stored-source checksum, Designer workspace path definition, MCP workspace-slug metadata, unchanged EXECUTE grants/security-definer/empty search path, and `AUTH_REQUIRED` without an MCP token. No customer content or provider was changed.
