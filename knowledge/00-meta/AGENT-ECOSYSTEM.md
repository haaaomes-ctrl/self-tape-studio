# TapeCoach Knowledge OS — Agent Ecosystem

**Status:** design. The cooperating subagent team that lets the operator work as SRO.
**Language:** UK English.
**Builds on:** the five skills (below), the PR cycle + ADR rule (`proposals/AGENTS-md-pr-cycle-and-adr-rule.md`), the SRO model, and the lessons in `10-research/agent-lessons-identified.md`. Agents = role definition + relevant skills + scoped tools.

---

## Principles (lessons-applied)

1. **Earn its place.** Distinct function (own inputs, outputs, decisions) + recurring need, or it's removed. Multi-agent costs ~15× the tokens of a single session, so cost-vs-value gates each tranche.
2. **Grow one tranche at a time;** validate before adding the next.
3. **One write path.** Only the Developer mutates code (branch + PR); every other agent _proposes_ (spine) or writes the _corpus_ only.
4. **Escalate, don't rubber-stamp,** with explicit termination conditions (max-iteration caps that bubble to the SRO). Verification is multi-level and independent.
5. **Native coordination, not Slack.** Agents coordinate via Claude Code Agent Teams (shared task list + mailbox); the SRO observes/steers via Slack.
6. **The SRO is the constant** — three gates only (approve the day/week plan; decide escalations; review outcomes).

## Write-boundary at the team level

| Writes to…            | Agent(s)             | How                                                              |
| --------------------- | -------------------- | ---------------------------------------------------------------- |
| Code                  | Developer only       | Branch + PR                                                      |
| Spine                 | none directly        | Proposals (Architect → ADRs; BA → requirements appendix), via PR |
| Corpus (`knowledge/`) | all reasoning agents | `tc-vault-note`, `tc-handoff`                                    |

## Role contracts

Each role now declares an **output format** and **termination conditions** (the two fields the failure research showed are most often missing).

### Developer (implementer)

- **Purpose:** implement approved work. **Inputs:** approved handoff/plan, spine, corpus. **Output format:** code on a branch + filled Results in the handoff note + PR. **Authority:** routine/reversible decisions. **Escalates:** ADR-class decisions, blockers. **Terminates:** when acceptance is met (PR opened) or blocked. **Tools/skills:** repo, `tc-handoff`, PR cycle. **Writes:** code (PR), corpus (results).

### Senior Developer / Code Review — **Tranche 1 (with Developer)**

- **Purpose:** independent review of plan and diffs. **Inputs:** plan/diff, acceptance, spine, ADR rule. **Output format:** structured findings + verdict (approve / changes / escalate). **Authority:** approve or block at code-quality level; iterate with Developer. **Escalates:** uncertainty, ADR-class concerns, repeated failure to meet acceptance. **Terminates:** approve, or escalate at the max-iteration cap (never silently). **Tools/skills:** review criteria, ADR rule, `tc-knowledge-index`. **Writes:** corpus (review notes).

### Business Analyst — **Tranche 2**

- **Purpose:** turn business intent into discrete, checkable requirements + acceptance; own the README atomisation. **Inputs:** README, SRO direction, corpus, Monday. **Output format:** the requirements appendix (proposed) — each requirement with id, acceptance, priority. **Authority:** draft/maintain requirements/acceptance. **Escalates:** ambiguous/conflicting intent. **Terminates:** appendix updated and proposed. **Tools/skills:** `tc-vault-note`, `tc-conversation-ingestion`. **Writes:** corpus (requirements); proposes the README appendix. **Monday boundary:** owns backlog item **content** — well-formed items, acceptance, and _proposed_ priority (fed from the requirements appendix); never reorders or schedules. **Note:** living specifications are the #1 failure mitigation — this raises the quality of the reviewer _and_ the delta register.

### Solutions Architect — **Tranche 3 (deferred — architecture is mature)**

- **Purpose:** architecture review + ADR authoring. **Inputs:** plan/diff, ADRs, topology, data model, ADR rule. **Output format:** architecture review + drafted ADRs. **Authority:** approve/block at architecture level. **Escalates:** architecturally significant/contested calls. **Terminates:** approve or escalate. **Tools/skills:** `tc-delta-register`, ADR rule. **Writes:** corpus; proposes ADRs.

### Project Manager — **Tranche 2 (with the BA)**

- **Purpose:** plan and orchestrate; report to the SRO. **Inputs:** Monday, roadmap, requirements appendix, corpus, handoff statuses. **Output format:** the day/week PR backlog (for gate 1), the handoff queue, the gate-3 achievement report. **Authority:** sequence/queue/track. **Escalates:** prioritisation conflicts, slippage. **Terminates:** backlog produced / report delivered. **Tools/skills:** `tc-handoff`, Monday MCP, Bases. **Writes:** corpus (plans, handoffs). **Monday boundary:** maintains the board's **health and flow** — sequencing, scheduling, status, grooming stale/done items, surfacing blockers, reporting; **never redefines acceptance or changes business priority** (escalates priority conflicts to the SRO). **Note:** the BA owns item content, the PM owns board flow, the SRO owns priority — together they keep Monday a healthy backlog.

### Marketing — **later (parallel)**

- **Purpose:** positioning, messaging, copy. **Inputs:** `50-marketing/`, `brand.ts`, corpus. **Output format:** strategy/copy notes + proposed brand/landing changes. **Escalates:** brand/positioning decisions. **Terminates:** drafts/proposals ready. **Tools/skills:** `tc-vault-note`, Claude Design. **Writes:** corpus; proposes `brand.ts` changes.

### Deferred — Business Change

Overlaps PM + Marketing (a documented duplicate-role failure mode). Fold in until genuine organisational change warrants splitting it out.

## Sequence (confirmed)

| Tranche | Agent(s)                                       | Pattern                       | Why here                                                                                                                                                                                                           |
| ------- | ---------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**   | Engineer pair: Developer + Senior-Dev reviewer | evaluator–optimizer           | Removes the operator from the wire; delivers the SRO model.                                                                                                                                                        |
| **2**   | Business Analyst **+ Project Manager**         | (BA defines; PM orchestrates) | BA: living specifications are the top failure mitigation and unlock the delta register. PM: maintains Monday's flow and automates gate-1 planning / gate-3 reporting. Together they make Monday a healthy backlog. |
| **3**   | Solutions Architect                            | —                             | Deferred: architecture is mature, so its marginal value is lower (operator's call).                                                                                                                                |
| later   | Marketing                                      | —                             | Parallel; when marketing work intensifies.                                                                                                                                                                         |
| —       | Business Change                                | —                             | Deferred / folded.                                                                                                                                                                                                 |

## Caveats (from the research)

Cost/latency (~15× tokens — instrument it); collusion/loops (escalate-on-uncertainty + max-iteration caps + independent backstops); responsibility diffusion (clear contracts + single write path); context drift (corpus + spine as shared ground truth, not agent-to-agent memory). Use sequential evaluator-optimizer for review, not parallel agents deciding the same thing.

## Relationship to the rest

Agents are the layer above the skills. Building them changes neither the write-boundary, the two-tier model, nor the SRO gates. Lessons behind the design: `10-research/agent-lessons-identified.md`.
