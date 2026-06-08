---
id: knowledge-os-decisions-2026-06
title: Knowledge OS — resolved design decisions
tier: corpus
status: decided
spine_anchor: ["CLAUDE §Knowledge corpus"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Knowledge OS design conversation, 2026-06-05/06"
discipline: null
monday_ref: null
tags: [knowledge-management, meta, decisions, obsidian, agents, slack, courier]
confidence: high
created: 2026-06-06
updated: 2026-06-06
---

## Summary

The resolved design decisions for the Knowledge OS, including the agent ecosystem and the lessons-driven guardrails added after research.

## 1 — Anchors

Tolerant labels by section **name** (not number); substring-resolved; unmatched reported as "unresolved", fixed on the note. A→B (explicit markers) later, Cowork-automated. Orphans reconciled by the operator as the graph grows; initial connection automated.

## 2 — Delta register

Incremental baseline keyed on `git diff`; requirements = the **atomised README appendix**; prioritised by requirement priority (drift bumped above unbuilt gaps); current judged from tests/types, reading implementation/PRs where uncertain; report-only; honesty-first (no debt); periodic full re-baseline.

## 3 — Marketing

`50-marketing/` = strategy (corpus); `brand.ts` = applied truth (code); Design reads both, proposes via PR.

## 4 — Vault scoping (repo private)

Corpus = `knowledge/` subfolder in-repo; Obsidian opened on `knowledge/`, so the spine/code are physically outside the vault. Makes the write-boundary structural (R3 Low by construction). Never symlink spine/code into the vault.

## 5 — Courier elimination, re-tiered to the foundation

The pain is agent-to-agent with the operator as the wire. Fixed by: the always-loaded `CLAUDE.md` pointer (Code corpus-aware) + the `tc-handoff` convention + the **Tranche-1 engineer pair** (Developer + Senior-Dev reviewer). Gap analysis and the incremental-delta optimisation sit below this.

## 6 — Capture ritual

Collaborative end-of-session capture via `tc-conversation-ingestion`; **selective but fully-formed notes** for the approve/commit cycle; the **session briefing is on-screen only**, not committed (it summarises existing notes). Surfaced in the capture-log Base.

## 7 — Context/memory commits

Via Code: the `CLAUDE.md` pointer and the **PR cycle + ADR rule + decision escalation** (proposals in `00-meta/proposals/`), applied by hand via PR. The `CLAUDE.md` write-boundary line is **scoped to corpus work** with an explicit carve-out for normal development — because the file is always-loaded, an absolute "never edit code" would risk a coding agent (e.g. the Developer) misreading it as a global ban. The boundary constrains corpus tooling; code is edited via branch + PR.

## 8 — SRO operating model

The operator is a non-technical SRO at three gates: approve the day/week PR backlog; decide escalations (the ADR/significance test); review outcomes (dashboards + merged PRs). Handoff approval is at the **backlog level**, not per-handoff. Everything between the gates runs agent-to-agent. The SRO steers from **Slack**.

## 9 — Agent ecosystem and tranche order

A cooperating team (role + skills + scoped tools), grown in tranches: **T1 Engineer pair** (evaluator–optimizer) → **T2 Business Analyst + Project Manager** → **T3 Solutions Architect** (deferred, architecture is mature) → later Marketing. **Business Change deferred** (duplicate-role risk). Each role contract declares an **output format** and **termination conditions**. **Monday backlog boundary:** the BA owns item _content_ (well-formed items, acceptance, proposed priority); the PM owns board _flow/health_ (sequencing, status, grooming, blockers, reporting); the **SRO owns priority**. The BA never sequences; the PM never redefines acceptance or changes priority.

## 10 — Coordination vs monitoring (Slack)

Agents coordinate via **native Agent Teams** (shared task list + mailbox), not Slack. **Slack is the SRO observability/control plane** (escalations, plan approval, status). Added from Tranche 1.

## 11 — Lessons-driven guardrails (MAST etc.)

Multi-level independent verification (reviewer + automated PR review + SRO); clear role specs + living requirements (top failure mitigation); structured persistent handoffs + corpus as shared ground truth; escalate-on-uncertainty + max-iteration caps; instrument token cost (~15× single-session). See `10-research/agent-lessons-identified.md`.

## 12 — README atomisation (load-bearing)

The README is the north star; the roadmap is the sequence. Atomise the README into a **requirements appendix** (id + acceptance + priority) — the checklist the reviewer and delta register measure against, and the source of prioritisation. A deliberate spine pass (proposal/PR).

## Links

- [[knowledge-os-design-rationale]] — the design rationale these decisions record. · Design `DESIGN.md` · Plan `IMPLEMENTATION-PLAN.md` · Agents `AGENT-ECOSYSTEM.md` · Lessons `10-research/agent-lessons-identified.md` · Proposals `00-meta/proposals/`
