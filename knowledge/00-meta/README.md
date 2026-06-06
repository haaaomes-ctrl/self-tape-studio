# TapeCoach Knowledge OS — Start Here

**This is the front door.** It pulls together the whole system: the two-tier knowledge model with Obsidian as the operational core, the five skills, the SRO operating model, the cooperating agent ecosystem, the lessons that de-risk it, and the rollout. Every other document is linked below.

**Status:** integrated overview. Authoritative design is `DESIGN.md`; this is the map.
**Language:** UK English. **Repo:** private. **Vault:** opened on the `knowledge/` subfolder.

---

## 1. The idea in one paragraph

TapeCoach's knowledge is fragmented across ChatGPT, Claude, Claude Code, Codex, GitHub, Monday and docs. This system makes it durable and consistent by splitting it into a small, controlling **spine** (the repo's README/AGENTS/CLAUDE/ADRs — the source of truth) and an unbounded **corpus** (a git-backed Markdown vault under `knowledge/` — the reasoning, research and history). **Obsidian is the operational core**: the cockpit you work in and the hub agents connect through — without being the source of truth or how the AI retrieves. On top of this sit **skills** (a consistent operating layer) and a **cooperating agent team** that lets you operate as an **SRO**: you set direction, decide escalations, and review outcomes, while the agents do the technical round-trips that used to make you the copy-paste pipeline.

## 2. The two tiers and the one boundary

- **Spine (controlling):** README/AGENTS/CLAUDE/MEMORY/ADRs/s10. On conflict, README wins. Never written by this system.
- **Corpus (knowledge/):** portable Markdown — the _why_ behind the spine. Status lifecycle (`exploratory → current → superseded → decided`) keeps fossils distinguishable from contracts.
- **Write-boundary (structural):** the vault is opened on `knowledge/`, so the Local REST API/MCP physically cannot reach the spine or code. At the team level there is **one write path to code** (the Developer agent, via PR) and **one proposal path to the spine** (proposals applied via PR). This is what keeps the whole thing safe.

## 3. Obsidian as the core

- **Cockpit (you):** Properties (the note schema), **Bases** dashboards, graph, Canvas, Templater.
- **Hub (agents):** Local REST API + built-in MCP; Claude Code/Codex read the vault natively; Cowork/Desktop via MCP; Claude.ai via the GitHub connector.
- **Sync:** Obsidian Git keeps vault = repo live.
- **Dashboards to build:** status board · capture log · handoff board · evidence-by-anchor · research queue · supersession history. Configuration in `OBSIDIAN-SETUP.md`.

## 4. The five skills (the consistency layer)

| Skill                       | Job                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tc-vault-note`             | The note schema, status lifecycle, anchors (by name), and the `discipline`/`monday_ref` fields.                             |
| `tc-conversation-ingestion` | Distil sessions into selective, fully-formed notes for your approve/commit cycle; powers the end-of-session capture ritual. |
| `tc-knowledge-index`        | Regenerate the spine→evidence index plus gap/orphan/unresolved-anchor signals.                                              |
| `tc-delta-register`         | Forward gaps (against the atomised README requirements) + drift; report-only, prioritised, honesty-first.                   |
| `tc-handoff`                | Carry an SRO-approved plan to Code and results back — the bridge that removes the relay.                                    |

Per-skill intent, steps and nuance are in `SKILLS-SPEC.md`.

## 5. The SRO operating model — your three gates

You operate at three gates; everything between them runs agent-to-agent:

1. **Approve the day/week PR backlog** (planning).
2. **Decide escalations** (the ADR/significance test).
3. **Review what the team achieved** (via the dashboards + merged PRs).

The capture ritual at session end is your debrief; the handoff board and delta register are your live oversight. You do this from **Slack** (the SRO observability/control plane) without living in the terminal.

## 6. The cooperating agent ecosystem

Agents are the layer above the skills (role + skills + scoped tools). Built in tranches:

- **Tranche 1 — Engineer pair:** Developer (implementer) + Senior-Dev reviewer, looping as an _evaluator–optimizer_. This is what removes you as the pipeline. (Plus the automated PR review = multi-level verification.)
- **Tranche 2 — Business Analyst + Project Manager:** the BA owns the atomised requirements, acceptance and _proposed_ priority (item **content**); the PM maintains Monday's flow and health — sequencing, status, grooming, blockers — and automates gate-1 planning and gate-3 reporting. You own priority. Together they keep Monday a healthy backlog, and the BA's living requirements are a _safety_ mitigation, not a feature.
- **Tranche 3 — Solutions Architect:** architecture review + ADR authoring (deferred because the architecture is mature).
- **Then:** Marketing (parallel). **Deferred:** Business Change (duplicate-role risk).

Full role contracts (with output formats and termination conditions) in `AGENT-ECOSYSTEM.md`; the external research behind the design in `agent-lessons-identified.md`.

## 7. What de-risks it (lessons identified)

Multi-agent systems fail predictably: ~42% specification, ~37% coordination, ~21% verification. The mitigations are built in: clear role specs + the README atomisation (living specifications kill the top failure category); structured, persistent handoffs + the corpus as shared ground truth; multi-level independent verification (reviewer + automated PR review + SRO); native Agent Teams for agent coordination (not Slack); and observability + token-cost monitoring from day one. Detail in `agent-lessons-identified.md`.

## 8. What gets committed to the spine (via Claude Code)

Two reviewed proposals, applied by hand via PR (the system never edits the spine itself):

- `proposals/CLAUDE-md-addition.md` — the always-loaded pointer that makes Code corpus-aware (the enabler for working in Code).
- `proposals/AGENTS-md-pr-cycle-and-adr-rule.md` — the consistent PR/merge cycle, the ADR creation rule, and decision escalation.
  And the **README atomisation** (a requirements appendix) — a deliberate spine pass, load-bearing for the reviewer and the delta register.

## 9. Rollout

Phased and additive (branch + PR throughout). Cheap foundation first; heavy amplifiers opt-in. Full sequence with dependencies and exit criteria in `IMPLEMENTATION-PLAN.md`; the command-by-command runbook in `IMPLEMENTATION-GUIDE.md`.

## 10. Document map

- **Design:** `DESIGN.md` (authoritative) · `KNOWLEDGE-OS.md` (origin)
- **Build:** `IMPLEMENTATION-PLAN.md` (phases/tranches) · `IMPLEMENTATION-GUIDE.md` (runbook) · `OBSIDIAN-SETUP.md` (config)
- **Skills:** `SKILLS-SPEC.md` + the five `.claude/skills/tc-*`
- **Agents:** `AGENT-ECOSYSTEM.md` · `10-research/agent-lessons-identified.md`
- **Records:** `BENEFITS.md` · `RISKS.md` · `20-decisions-context/knowledge-os-decisions-2026-06.md` · `30-conversations/knowledge-os-design-rationale.md`
- **Spine proposals:** `proposals/`
