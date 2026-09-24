# Resume work

1. Read [AGENTS](../AGENTS.md), [product rules](product-rules.md), [architecture](architecture.md) and [URLs](dashboard-urls.md).
2. Inspect `git status` and current branch before editing; preserve uncommitted work. Follow [local setup](../README.md) without printing private environment values.
3. Use the relevant [feature guide](README.md). Verify actual schema/deployment before operating on Supabase; historical migrations were not all necessarily recorded through the same CLI workflow.
4. Run the applicable [checks](verification.md) and explicitly report blocked/live-untested cases. Do not mutate customer content for validation.

## Current scope (2026-09-23)

Phases A–D implemented: persisted-data UX, narrow database projections, explicit provider metadata cache and efficient worker/polling. Phase E ships shared services and read-only MCP E1/E2; further agent mutation features are not implemented. Group-aware pagination is design only. SEO and embed reading remain unavailable.

CMS and Designer use selected-scope preview/confirmation with per-occurrence review state. Sites have compact cards and same-account workspace transfer. Workspace lists/settings and site/resource pages share workspace folder URLs scoped to the signed-in account. Site/resource identifiers stay stable; moving a site changes its workspace URL segment. Details are in their current guides, not this handoff.

The previous chronological handoff and original feature history are preserved in [the archive](archive/2026-09/README.md). Dates there record past checks, not a guarantee about today's remote environment. Remote migrations/deployment are separate authorized operations, never a side effect of tests or starting the app.
