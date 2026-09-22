# Dashboard URLs

Public addresses use the account namespace and stable site slug already assigned by the application. Site resources add a permanent positive number per resource type and site. IDs in PostgreSQL, actions, API calls and audit records remain UUIDs.

| Resource | Public address |
| --- | --- |
| Scan | `/dashboard/{account}/sites/{site}/scans/1` |
| Scan review operation | `/dashboard/{account}/sites/{site}/scans/1?filter=reviewed&operation=2` |
| Managed Value | `/dashboard/{account}/sites/{site}/managed-values/1` |
| Managed Value preview | `/dashboard/{account}/sites/{site}/managed-values/preview/1` |
| CMS operation entry / Managed Value sync | `/dashboard/{account}/sites/{site}/operations/1` |
| Static page operation | `/dashboard/{account}/sites/{site}/changes/1` |
| Global Facts preview | `/dashboard/{account}/sites/{site}/facts/preview/1` |
| Global Facts version | `/dashboard/{account}/sites/{site}/facts/versions/1` |
| Site connection preview | `/dashboard/{account}/setup/sites/1` |
| Workspace preview | `/dashboard/{account}/setup/workspaces/1` |
| Primary workspace settings | `/dashboard/{account}/settings/webflow` |
| Additional workspace settings | `/dashboard/{account}/workspaces/{workspace}/settings/webflow` |

Apply `20260921000400_dashboard_resource_routes.sql` before using the updated dashboard. It registers existing records deterministically by creation/expiry timestamp and UUID tie-breaker, then registers new records transactionally. Separate sites can each have scan 1. Deletion, archiving, pagination or changes to search filters never renumber resources. A locked counter and unique constraints prevent concurrent allocations from colliding; record IDs remain unchanged.

The authenticated proxy resolves public routes to the original internal handlers. Legacy GET/HEAD links redirect to public addresses with query parameters preserved. Legacy POSTs keep their handlers; public POSTs rewrite internally without changing form payloads, CSRF handling, permission checks or idempotency keys. The operation query parameter is resolved within the site and verified against the exact scan. Invalid, missing or inaccessible resource mappings fail closed instead of falling back to another site's record.

The scan and resource lists, overview and process panel generate public resource links directly. Older saved bookmarks and internal action redirects continue to work through the proxy. CMS operations tied to a scan retain the existing redirect into its review; Managed Value sync operations remain standalone because they have no scan. Connection callback entry URLs retain the OAuth contract and immediately redirect into workspace settings. API endpoints and external Designer handoff identifiers are outside the public dashboard URL numbering contract.

`dashboard_resource_routes` stores routing metadata only; it does not duplicate scans, reviews or content. It is read-only to authenticated clients and filtered by account through RLS. Source handlers retain their authorization checks. No migration writes to Webflow.
