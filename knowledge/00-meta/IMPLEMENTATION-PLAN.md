# TapeCoach Knowledge OS — Implementation Plan

**Status:** phased plan of record. The _plan_; the runbook is `IMPLEMENTATION-GUIDE.md`. The agent tranches are woven into the knowledge-layer phases here.
**Language:** UK English.
**Cross-cutting:** all repo changes via branch + PR; the system never edits the spine/code (proposes via PR); validate skills/agents before scaling; the existing gates (`tsc`, `vitest`, Prettier on changed files, `build`) must pass; instrument token cost from the start.

---

## Sequencing

```
P0 Foundations + context commit
   └─▶ P1 Daily operation: Tranche-1 engineer pair (courier kill) + capture ritual + Slack (SRO plane)
          ├─▶ P2 Dashboards (Bases)
          ├─▶ P3 Tranche 2: README atomisation + BA + PM (Monday backlog)   ← load-bearing
          │       └─▶ P4 Index, then Delta register (graded against the requirements appendix)
          └─▶ P5 Solutions Architect (Tranche 3) ─▶ Marketing
```

Cheap foundation (P0–P2) carries most of the value and your top-priority courier fix. Heavy/optional work (atomisation, delta, further agents) is opt-in and cost-gated.

## Phase 0 — Foundations + context commit

**Goal:** structure exists and Claude Code is corpus-aware. **Deliverables:** `knowledge/` + `.claude/skills/` (five skills) committed; `knowledge/.obsidian/` gitignored; generated files `.prettierignore`d; the **`CLAUDE.md` pointer** and the **PR-cycle + ADR-rule** applied via Code (from `proposals/`); vault opened on `knowledge/`. **Exit:** additive PR merged; gates green; skills trigger; a fresh Code session knows the corpus exists. **Risk:** format churn (mitigated).

## Phase 1 — Daily operation: Tranche-1 engineer pair + capture + Slack (PRIORITY)

**Goal:** stop the relay; start accruing knowledge; give the SRO a control plane.
**Deliverables:** the **engineer pair** (Developer + Senior-Dev reviewer) running as an evaluator–optimizer via Agent Teams, with the automated PR review as the third check; the `tc-handoff` convention carrying SRO-approved plans; the **end-of-session capture ritual**; a one-time catch-up of parked threads; **Slack wired as the SRO plane** (escalations, plan approval, status — agents coordinate natively, not via Slack).
**Exit:** development happens agent-to-agent with you at the gates, not in the wire; capture runs at session end; you monitor/steer from Slack. **Risk:** dumping-ground bloat and weak review — mitigated by the ingestion bar, multi-level verification, and termination caps.

## Phase 2 — Dashboards (Bases)

**Goal:** the SRO cockpit. **Deliverables:** status board, capture log, handoff board, evidence-by-anchor, research queue, supersession history. **Exit:** knowledge state, capture cadence and queued/blocked work visible at a glance.

## Phase 3 — Tranche 2: README atomisation + Business Analyst + Project Manager

**Goal:** the requirements checklist everything measures against — and the top failure mitigation. **Deliverables:** the **BA agent** (requirements appendix — id, acceptance, proposed priority — proposed via PR; owns item _content_) and the **PM agent** (maintains Monday's flow/health — sequencing, status, grooming, blockers — and produces the gate-1 backlog and gate-3 reporting; the SRO owns priority); the roadmap re-examined as the sequencing of those requirements. **Dependencies:** P1. **Exit:** a living requirements appendix exists; acceptance/priorities defined. **Risk:** this is load-bearing for the reviewer's quality and the delta register — treat as a deliberate pass, not a side task.

## Phase 4 — Index, then Delta register

**Goal:** traceability, gaps, drift. **Deliverables:** `INDEX.md` (`tc-knowledge-index`); then `DELTA-REGISTER.md` (`tc-delta-register`) graded against the requirements appendix, prioritised, honesty-first, tests/types + PR oracle. **Dependencies:** P3 (the appendix). **Exit:** index shows evidence/gaps; delta register reports prioritised gaps and drift (notably README-vs-implementation divergence).

## Phase 5 — Solutions Architect (Tranche 3) → Marketing

**Goal:** complete the team as needs arise. **Deliverables:** the Architect (deferred — mature architecture); then Marketing (parallel). **Dependencies:** the loop trusted; cost-vs-value holding. **Exit:** each agent demonstrably reduces SRO escalations or improves decisions, else it is cut.

---

## Prerequisites this plan introduces

- The **README atomisation** (requirements appendix) — load-bearing; P3.
- **Slack as the SRO plane** — P1; agents coordinate natively.
- The **incremental delta + dependency map** remain the lowest-priority optimisation, added only if delta runs become slow at scale.

## Cheap vs heavy

- **Cheap/early (P0–P2):** structure, context commit, the engineer-pair courier kill, capture ritual, Slack, dashboards. Most of the value, including your priority.
- **Heavy/optional (P3+):** atomisation, delta, further agents. Each opt-in and cost-gated; none gate the priority.
