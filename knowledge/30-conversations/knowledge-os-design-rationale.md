---
id: knowledge-os-design-rationale
title: TapeCoach Knowledge OS — design conversation and rationale
tier: corpus
status: current
spine_anchor: []
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "Knowledge OS design conversation, 2026-06-05"
tags: [knowledge-management, meta, architecture, skills, obsidian, mcp, process]
confidence: high
created: 2026-06-05
updated: 2026-06-05
---

## Summary

TapeCoach adopts a **two-tier knowledge architecture**: a small, in-context, authoritative **spine** (the repo's README/AGENTS/CLAUDE/MEMORY/ADRs/s10 docs) plus an unbounded **corpus** (a markdown vault under `knowledge/`) that holds the reasoning, research, history and parallel conversations the spine cannot fit. Obsidian is the human lens over this; skills are the consistency layer; the git-backed corpus is the shared substrate that removes the human "courier" role between AI tools. The full spec is in `knowledge/00-meta/KNOWLEDGE-OS.md`; the rollout is in `IMPLEMENTATION-GUIDE.md`.

## Context / why

Knowledge is fragmented across ChatGPT, Claude, Claude Code, Codex, GitHub, Monday and docs, beyond what any one AI session can hold. The original proposal made Obsidian the "source of truth for knowledge." That was corrected over the conversation, because the repo markdown is _already_ the source of truth with an enforced hierarchy ("README wins"), and a second store would create drift outside version control.

## Detail — the logic, end to end

1. **Authority vs volume are separable.** The spine is lean because of a context-window ceiling, not because knowledge is unwelcome. Fix: keep authority in the spine; move volume to the corpus. The spine becomes a thin authoritative index over a deep corpus.
2. **Corpus is not a second source of truth.** Authority rule: no corpus note ever overrides a controlling fact; README wins. This dissolves the apparent conflict — the tiers never claim the same territory.
3. **The graph does not power AI retrieval.** Obsidian backlinks/graph are human-navigation only; an AI sees literal `[[wikilinks]]`. Retrieval keys off headings, front-matter and a generated index. Invest in metadata, not the graph.
4. **MCP is not the linchpin.** Making the corpus a git repo of markdown means Claude Code and Codex read it natively and Claude.ai reaches it via the GitHub connector. ChatGPT is an export _source_, not a live reader. MCP becomes nice-to-have.
5. **Index is generated, not authored.** Hand-maintained spine links reintroduce size pressure; a generated index (spine anchor → evidence) does the linking and is regenerated.
6. **Two deltas.** Backward lineage (`supersedes`/`superseded_by`/`supersession_reason`) is stored in front-matter; forward gap (current vs target = the work) is _computed_, not stored. Drift detection (spine-vs-spine, spine-vs-code) is the same engine pointed sideways — built once.
7. **Status metadata is the safety mechanism.** `exploratory | current | superseded | decided` lets the corpus keep stale parallel conversations forever without an agent mistaking a fossil for a contract.
8. **Skills are the consistency layer.** The schema, ingestion rules, index and delta logic become SKILL.md files that work across Claude Code, Claude.ai and the API — removing per-session re-explanation and attacking the courier role directly.
9. **Courier vs operator.** Manual copy-paste relay between tools is transport overhead to delete; the operator's confirm/approve role (already in AGENTS.md) is to keep and elevate.
10. **Sequencing.** Skills + shared corpus first (prove retrieval) → subagents/Agent Teams for themed specialists → Cowork as the operator cockpit → Design on a parallel marketing track. Not all at once.
11. **Safety by construction (v2 hardening).** A write-boundary restricts the system and its skills to writing under `knowledge/` only — never the spine or code. Anchors use tolerant labels resolved by substring match, with unmatched labels reported as "unresolved" rather than breaking anything. Install is additive, branch + PR, so the live repo cannot be corrupted by this system.

## Deltas captured here

- _Backward:_ this supersedes the earlier draft of the design (v1) where the corpus was wrongly framed as a possible source of truth and where example anchors were invented. The v1 framing was superseded once the two-tier authority model and the write-boundary were established.
- _Forward:_ the implemented state is "spec + four skills installed"; the target state adds (a) a populated corpus from real thread ingestion, (b) trusted retrieval, then (c) themed agents. Tracked operationally, not in this note.

## Open questions

- Should spine sections gain explicit stable anchor comments (more robust than heading-derived labels) as a future, reviewed spine PR — or is substring matching sufficient?
- How should `tc-delta-register` bound how much code it reads per run to stay fast as the repo grows?
- Where does marketing knowledge (positioning, landing copy) sit relative to `src/config/brand.ts`, and should Claude Design read from `50-marketing/`?

## Links

- Spec: `knowledge/00-meta/KNOWLEDGE-OS.md`
- Rollout: `knowledge/00-meta/IMPLEMENTATION-GUIDE.md`
- Skills: `.claude/skills/tc-vault-note`, `tc-conversation-ingestion`, `tc-knowledge-index`, `tc-delta-register`
