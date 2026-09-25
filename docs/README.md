# Documentation

Current guides were consolidated on 2026-09-23. Start with rules, then the feature you are changing. Historical plans explain decisions and measurements; they do not override current behavior.

| Purpose | Source of truth |
| --- | --- |
| Contributor requirements | [AGENTS.md](../AGENTS.md) |
| Product scope, review and UX rules | [Product rules](product-rules.md) |
| Layers, data roles and request budgets | [Architecture](architecture.md) |
| Workspace/site/resource paths and compatibility | [Dashboard URLs](dashboard-urls.md) |
| Local setup and resuming work | [Root README](../README.md) · [Handoff](HANDOFF.md) |
| Search and result semantics | [Scans](scans.md) |
| Preview, queue, apply, sequential edits and revert | [CMS changes](cms-changes.md) |
| Central values and source protection | [Variables](managed-value-sync.md) |
| Static-page extension | [Designer](designer-dashboard.md) |
| Provider connection / executor | [Webflow](webflow.md) · [Background sync](background-sync.md) |
| Database lifecycle | [Supabase](../supabase/README.md) |
| Plans and personal AI | [Limits](free-plan.md) · [Gemini](ai-suggestions.md) |
| Read-only agent integration | [MCP](mcp.md) |
| Reference data | [Business reference (legacy)](global-facts.md) |
| Visual implementation | [Dashboard/Designer pattern](dashboard-designer-ui-pattern.md) · [Brand](brand-guide.md) |
| Language and public site | [Internationalization](internationalization.md) · [Landing page](landing-page.md) |
| Test expectations | [Verification](verification.md) |
| Site transfer and card validation | [Implementation and QA](qa/site-cards-and-transfers.md) |
| Unimplemented design | [Group pagination](design/group-pagination.md) |
| Dated plans and original evidence | [Archive](archive/2026-09/README.md) |

## Consolidation map

- `inline-review.md`, `cms-change-queue.md`, `sequential-scan-edits.md` → `cms-changes.md`.
- `text-search.md` → `scans.md`; `site-urls.md` → `dashboard-urls.md`.
- `static-text-designer-poc.md` → `designer-dashboard.md`.
- Old handoff/scans/CMS/Designer versions and the merged guides are retained together in [historical feature notes](archive/2026-09/feature-notes.md).
- Original optimization proposal, audit, Phase A–E reports and old UI inventories moved to the archive. Existing QA artifacts remain available. Group pagination moved to design because it is not shipped.

Keep one canonical rule per subject and link to it. Guides describe current contracts; reports describe evidence at a date. Do not infer current deployment, pricing or completion from an old report. If implementation and rules disagree, identify the difference and fix/document it rather than silently treating the archive as authority.

- [CMS Explorer UX, request budgets and session cache](cms-explorer-ux-plan.md)
