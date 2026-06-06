# TapeCoach Knowledge OS — Design Document

**Status:** authoritative design of record for the TapeCoach knowledge layer.
**Version:** 3.2 (adds the SRO operating model and the cooperating agent ecosystem with the lessons that de-risk it; private-repo vault scoping settled).
**Supersedes:** the architecture content of `KNOWLEDGE-OS.md`; absorbs the Obsidian investigation. Configuration in `OBSIDIAN-SETUP.md`.
**Language:** UK English.
**Scope:** the knowledge layer only. Does not override `README.md`. On conflict, the spine wins.

---

## 1. Purpose

Make TapeCoach's fragmented knowledge (across ChatGPT, Claude, Claude Code, Codex, GitHub, Monday, docs) durable, retrievable and consistent across tools — with **Obsidian as the operational core** over a portable, git-backed corpus — and **remove the operator's manual copy-paste relay between a chat surface and Claude Code**, which is the most acute day-to-day pain.

## 2. Obsidian as the core — and the boundary that keeps it safe

Obsidian is the centre of this subsystem, with precise limits to prevent drift.

**Obsidian IS the core of:** human cognition (navigation, Bases dashboards, graph, Canvas, authoring); integration (the hub agents read through, via the Local REST API's MCP); synchronisation (Obsidian Git keeps vault = repo live).

**Obsidian is NOT:** the source of truth (the spine is; README wins); the system of record for the data (the corpus is plain Markdown in git — if Obsidian vanished, the corpus survives and every tool still reads it); how the AI retrieves (agents key off front-matter, headings and the generated index — not the graph or `[[wikilinks]]`, which are human-only).

Centring the _interface_ does not mean centring the _authority_ or the _durability_ — those stay distributed and resilient.

## 3. Architecture

Two tiers, with Obsidian as cockpit/hub/sync over the git-backed corpus. The corpus is the `knowledge/` subfolder _inside the (private) repo_; Obsidian is opened on that subfolder, so the spine and code sit physically outside the vault (see §6).

```
SPINE (controlling)   README · AGENTS · CLAUDE · MEMORY · ADRs · docs/tapecoach/s10-*
                          ▲ anchors (tolerant labels)         ▲ CLAUDE.md pointer → corpus
CORPUS (knowledge/)   research · decisions-context · conversations · ideas · marketing ·
                      05-handoffs · 90-archive · 00-meta/{INDEX,DELTA-REGISTER}(generated)
                          ▲ Obsidian opened HERE (vault = knowledge/)
OBSIDIAN (core)       Bases dashboards · Properties (=schema) · Git sync · Local REST API+MCP
SKILLS                tc-vault-note · tc-conversation-ingestion · tc-knowledge-index ·
                      tc-delta-register · tc-handoff
SURFACES              Claude Code/Codex (native fs) · Cowork/Desktop (MCP) · Claude.ai (GitHub conn.)
```

## 4. Data model

Front-matter on every note (full schema in `tc-vault-note`). Status lifecycle `exploratory → current → superseded / decided` is the safety mechanism. Lineage via `supersedes`/`superseded_by`/`supersession_reason`. Anchors are tolerant labels `"<FILE> §<section name>"` (by name, not number) or `"ADR-XXXX"`, resolved by substring match; unmatched labels are reported, never fixed by editing the spine. Forward delta (current vs target) is computed, not stored.

## 5. Components

- **Corpus (`knowledge/`)** — portable Markdown; layout in `KNOWLEDGE-OS.md` §3 plus `05-handoffs/` (work orders, see below).
- **Skills (`.claude/skills/`)** — the consistency layer: `tc-vault-note` (schema), `tc-conversation-ingestion` (capture), `tc-knowledge-index` (spine→evidence + gaps), `tc-delta-register` (forward gaps + drift), **`tc-handoff` (chat↔Code work orders that replace copy-paste)**.
- **Generated artifacts** — `INDEX.md`, `DELTA-REGISTER.md` (the AI/automation equivalents of the human dashboards).
- **Obsidian cockpit** — Properties (the schema), **Bases** dashboards (status board, evidence-by-anchor, research queue, supersession history, **capture log**, **handoff board**), graph/Canvas (human), Templater/QuickAdd (template enforcement).
- **Integration hub** — Local REST API + built-in MCP; per surface: Claude Code/Codex native filesystem; Cowork/Desktop via Obsidian MCP or Filesystem MCP; Claude.ai via GitHub connector (or Tailscale for live). Config in `OBSIDIAN-SETUP.md`.
- **Sync** — Obsidian Git auto-commit/pull.

## 6. Write model and safety (default settled by the private-repo decision)

The write-boundary is enforced both by instruction (skills write only `knowledge/`) and now **structurally**: because the repo is private and the **vault is opened on the `knowledge/` subfolder** (not the repo root), the Local REST API and its MCP cannot address the spine or application code — they are outside the vault. Corpus writes still flow through skills → git → PR. The Obsidian MCP is read-primary; any live write is confined to `knowledge/` by the vault boundary. Never symlink the spine or code into the vault. Result: even with Obsidian at the core, the system is structurally incapable of editing the spine or code outside a reviewed PR. (This makes risk R3 Low by construction.)

## 7. The SRO operating model and the agent layer

The manual relay is agent-to-agent with the operator as the wire. The fix is to let the agents communicate directly and put the operator at SRO altitude.

**The operator is a non-technical SRO at three gates:** (1) approve the day/week PR backlog; (2) decide escalations (the ADR/significance test); (3) review outcomes (dashboards + merged PRs). Everything between the gates runs agent-to-agent; the SRO steers from **Slack** (the observability/control plane — agents coordinate natively, not via Slack).

**The relay is removed by a cheap foundation plus the engineer pair:** the always-loaded `CLAUDE.md` pointer makes Code corpus-aware; the `tc-handoff` convention carries an SRO-approved plan and returns results; and the **Tranche-1 engineer pair** (Developer + Senior-Dev reviewer, an evaluator–optimizer) does the technical round-trips with the automated PR review and the SRO as the other two of three independent checks. The `CLAUDE.md` pointer is the single highest-leverage commit against the relay.

**The agent ecosystem** is the layer above the skills (role + skills + scoped tools), grown in tranches — Engineer pair → Business Analyst + Project Manager → Solutions Architect → Marketing — with each role contract declaring an output format and termination conditions, and a single write path (only the Developer mutates code, via PR). Full design in `AGENT-ECOSYSTEM.md`; the research that de-risks it (failure taxonomy, native-vs-Slack coordination, multi-level verification, cost) in `10-research/agent-lessons-identified.md`.

**End-of-session capture ritual:** a collaborative capture via `tc-conversation-ingestion` (selective but fully-formed notes; the briefing shown on-screen, not committed), surfaced in the capture-log Base — the habit that makes the corpus accrue value and the operator's debrief.

## 8. Key decisions (full record in `knowledge-os-decisions-2026-06`)

- **Vault scoping (settled):** private repo → vault opened on `knowledge/`; spine/code outside the vault (R3 Low by construction).
- **SRO model:** three gates; backlog-level approval (not per-handoff); steer from Slack.
- **Agent tranches:** Engineer pair → **BA + PM (Tranche 2)** → Architect (deferred, mature architecture) → Marketing; Business Change deferred (duplicate-role risk). **Monday boundary:** BA owns item content, PM owns board flow/health, SRO owns priority.
- **Coordination vs monitoring:** native Agent Teams for agents; Slack for the SRO.
- **README atomisation:** a requirements appendix (id + acceptance + priority) — the checklist the reviewer and delta register measure against.
- **Lessons-driven guardrails:** multi-level independent verification; clear role specs + termination conditions; instrument token cost.
- **Anchors / delta / marketing / capture / context commits:** as previously decided.

## 9. Non-goals / boundaries

Not a replacement for the spine or git as system of record; not public (the vault holds sensitive reasoning — repo stays private); not an AI-retrieval mechanism built on the graph; the system never edits the spine or code, only proposes via PR; no autonomous cross-surface dispatch.

## 10. Relationship to prior deliverables

Design of record. Absorbs `KNOWLEDGE-OS.md` (origin) and the Obsidian investigation. `OBSIDIAN-SETUP.md` = configuration; `IMPLEMENTATION-PLAN.md` = phased plan; `IMPLEMENTATION-GUIDE.md` = the step-by-step runbook; `BENEFITS.md` / `RISKS.md` = records; `00-meta/proposals/` = the spine changes to apply via Code. The five `tc-*` skills and the rationale/decision notes are referenced and current.
