---
title: "Real State Website text history consolidation"
status: evidencia
tags: [replaceall, qa]
---

# Real State Website text history consolidation

Applied on 2026-09-28 to Supabase project `nxibjpprjorchjeoudss`, workspace `kazama-test`, site `real-state-website`, after explicit user approval to include identical text searches in this one-off merge.

| Existing scan numbers | Final versions | Latest |
| --- | --- | --- |
| 1, 2 | V1, V2 | 2 |
| 12, 13 | V1, V2 | 13 |
| 14, 15, 16, 17 | V1, V2, V3, V4 | 17 |

Preflight verified site/account ownership, exact JSON plan equality within each group, actor/connection/truncation equality, terminal scans and no confirmed CMS changes. The existing schema was installed; the manual migration ledger still ended at `20260928000300`. No migration was replayed.

Used the atomic transaction structure from [media maintenance](../../scripts/sql/merge-media-scan-history.sql), with exact plan equality, a distinct operation key `exact-text-history-20260928`, the existing private audit table, and assertions for the eight exact public scan numbers. Locks, active-work checks, split-series rejection and unchanged-column assertions remained in place. Only series/version/latest metadata changed. Public numbers, URLs, occurrences, operation history and `repeated_from` remain intact.

This is historical data maintenance, not a change to automatic grouping rules. Automatic text grouping was not enabled. Remote verification checked all eight final version mappings against the persisted audit. No application code changed and no runtime tests were rerun. No Webflow calls, credential access, Edge invocation, AI generation or scan quota consumption occurred.
