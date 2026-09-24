# Verification and maintenance

## Required checks

For code changes: `npm run lint`, `npm run typecheck`, `npm test`, then `npm run build` on Node 22. Run typecheck/build sequentially (shared generated Next types). Documentation-only edits require local link/reference checking and `git diff --check`; do not imply that they retested provider execution.

| Area | Regression cases |
| --- | --- |
| Routing | Primary/secondary workspace and site folders; site moved between folders; legacy alias ambiguity; account/site isolation; stable numbering; query retention; POST rewrite |
| Scan/review | Specific text/numbers; exact URLs; Unicode/HTML ranges; partial groups; manual vs applied/reverted state; protected ranges |
| Preview/apply | Single/batch; stale value/selection; slug side effects; duplicate/ambiguous confirmation; audit failure; no pre-confirmation write |
| Worker | FIFO, caps, leases, revoked access, 429, uncertain dispatch/no resend, conditional gate, idle health, kick deduplication, bounded batch |
| Cache | Cold/warm/expired, denied vs expired, reconnect/revoke, cross-account isolation, no hidden refresh |
| Designer | Checked scope vs focus, components, text/links/images, blank URL, review/back/edit, partial results, observed evidence |
| UI | Narrow/wide screens, keyboard/focus, loading/empty/error/long content, tabs/back/state restoration |
| MCP/AI | Token scope/expiry/revocation, limits, read-only tools, no provider reads for MCP, generated drafts never auto-apply |
| Transfer | Same-account target authorization, active-work blocks, atomic scoped graph, immutable history/URLs, stale previews/session invalidation |

Use synthetic fixtures/PGlite and mocked providers first. PGlite does not establish production multi-session locking behavior. Browser checks are not provider write tests; an HTTP 200 health diagnostic is not proof of an applied CMS change. Live writes require a designated test site and normal user confirmation. Never test mutations on real customer content.

Record date, commands, exact coverage, limitations and deployment separately. Store durable rules in current guides; put dated measurements/screenshots in `docs/qa/` or historical reports in `docs/archive/`. Do not continually append superseding instructions to a feature guide. Unimplemented proposals belong in `docs/design/`.

Database deployment requires explicitly authorized scope and actual target schema/history inspection. Preserve secrets and user changes. Build/deploy compatible worker artifacts when the migration changes execution evidence. [Database guide](../supabase/README.md).
