# Product rules

Current contract consolidated on 2026-09-23. The definitive brand is **ReplaceAll**; legacy CopyReplace/Universal Values and managed-value identifiers remain where compatibility requires them.

## Scope and user control

The product finds supported CMS content and static-page content available through the active Webflow Designer extension. It does not crawl the whole published site, read embeds, validate SEO/JSON-LD or check broken links. SEO is coming soon. Business reference (legacy) is a versioned reference, not an automatic site audit.

Search, local drafts, preview and application are distinct. No provider write happens because a page opens, a tab changes, a draft is filled or an AI suggestion is generated. The final explicit apply action confirms a persisted validated preview. Show affected fields/items, before/after and side effects such as a CMS slug change. High-impact changes need visible consequences, not repeated checkboxes.

## Findings, selection and review

- Saved search searches only compatible completed/limited scans; always show timestamp and scope. No match means no match in that saved evidence. Offer a targeted scan when coverage or exact editable ranges are missing; never start it automatically or manufacture occurrences from surrounding text.
- Checkboxes define edit scope. Selecting one changes one; selecting several fills only those; selecting a group covers its eligible selected occurrences. Focus/background alone does not select anything.
- Pending, Reviewed and All preserve group identity. Applying part of a group moves only verified occurrences to Reviewed; remaining occurrences stay pending, even when only one remains.
- Applied history is read-only and shows actual recorded before/after context. Reverting is a separate preview/confirmation with current-source conflict checks. A failed, conflicting or uncertain attempt is not a successful review.
- Manual review flags are separate from application and Variables. Specific-term scans start pending rather than inheriting unrelated earlier reviews. Never calculate counters by naive subtraction from all raw detections.
- Preserve query, filters, pagination, scroll, expanded groups and valid drafts/selection when appropriate. Invalidate restoration when identity, source snapshot, ranges or eligibility change; browser storage is never authorization.

## Variables and providers

Centralizing creates bindings, not a Webflow write. Changing a central value requires preview and confirmation; successful field verification updates source evidence. Independent text outside protected ranges may be edited through the existing safe contract. Overlapping/uncertain/stale bindings remain protected. Archiving frees bindings without deleting history or changing Webflow.

CMS writes target staged content and never publish automatically. External edits are conflicts, not something to overwrite silently. A completed operation can contain partial failure; show each source outcome. A dispatched write with an unknown result must be reconciled rather than resent.

## Interface

Use a light, compact list + inspector for editing, shared before/after presentation and accessible focus/loading/error states. Selected tabs need an indicator beyond color. Site inventories use compact responsive cards; activity uses tables/lists. Show readable item/field/class/component context instead of UUIDs or raw image JSON. Original image thumbnails remain in the list; load the replacement preview when its URL changes.

English is the default; keep PT-BR translations. Integration connections/revocation belong in settings, language/reconnect controls in extension settings. Display extra controls only when useful. Keep meaningful scope, freshness and consequences visible; move secondary explanations into contextual help.

## Cost and capability boundaries

Gemini uses the user's own connection and explicit generation. Suggestions are drafts; local application limits are not Google's remaining quota. Administrators retain technical limits and all safety checks. No promise of unlimited free hosting/provider usage.

Phases A–D are implemented. Phase E includes shared agent services and read-only MCP (E1/E2) only. Group-aware result pagination remains a design proposal. Further agent writes, automatic auditing and other unimplemented roadmap items require a separate decision.

See [scans](scans.md), [CMS changes](cms-changes.md), [Variables](managed-value-sync.md), [Designer](designer-dashboard.md), [AI](ai-suggestions.md) and [limits](free-plan.md) for feature contracts.

## Shared terminology

Dashboard and Designer use ReplaceAll, Find, Review occurrences, Replace with, Preview changes, Apply changes, Variables, History and CMS Explorer. PT-BR: Buscar, Revisar ocorrências, Substituir por, Conferir alterações, Aplicar alterações, Variáveis, Histórico and CMS Explorer. Historical Global Facts is labelled Business reference (legacy). These are presentation changes only; domain, API/MCP, draft and security identifiers remain compatible. See [Slice 1](terminology-slice-1.md).
