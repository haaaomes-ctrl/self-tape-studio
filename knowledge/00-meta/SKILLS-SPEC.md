# Skills Specification — intent, steps, and decisions

**Status:** `current`. The reasoning behind each skill, so the _intent_ is captured alongside the skill itself. The skills are the operational files in `.claude/skills/`; this is why they work the way they do.
**Language:** UK English.

---

## tc-vault-note — the schema (foundation)

**Purpose:** the contract every corpus note obeys.
**Steps:** stable `id` → deliberate `status` → `spine_anchor` by section _name_ → lineage if it supersedes → `source`/`tags`/`confidence` → `discipline`/`monday_ref` where relevant → body.
**Intent / decisions:**

- Status is the safety mechanism. New captures default to `exploratory`; ingestion may propose `current` for settled findings and `decided` only when ratified into the spine (with `decided_ref`).
- Anchors use names, not numbers (numbers churn on renumbering).
- Orphan notes are allowed (research can stand alone); reconciling orphans as the graph grows is the operator's job, while _initial_ connection is automated.
- **Domain fields added:** `discipline` (acting | mt | singing | dance | commercial) and `monday_ref`, so the corpus is queryable along the axes TapeCoach actually works in.
  **Escalates / boundary:** writes `knowledge/` only.

## tc-conversation-ingestion — capture and debrief

**Purpose:** turn a session into durable notes without dumping; powers the end-of-session ritual.
**Steps:** read & classify items → route by tier → write notes → archive raw transcript separately → report.
**Intent / decisions:**

- **Selective but fully-formed:** few notes (signal only), but each one generated in full — complete reasoning, well-structured — so the approve/commit cycle is easy (you review a finished artifact, not a stub). Raw transcript to `90-archive/` so nothing is lost.
- **Propose → review → approve → commit**, never silent capture. The review step is your debrief and oversight.
- **The session briefing is on-screen only**, not a committed note — it summarises notes that already exist.
- Items that affect the spine become a `decided` note + a _proposal_, never a spine edit.
- **Open-question tag:** notes left with unresolved questions are tagged `open-question` (and untagged on resolution) so they surface in the open-questions dashboard view — Bases filters on properties, not body text.
  **Escalates / boundary:** writes `knowledge/` only; surfaces contradictions as drift.

## tc-knowledge-index — traceability and gaps

**Purpose:** regenerate `INDEX.md` (spine anchor → evidence) plus gap signals.
**Steps:** scan spine headings + note front-matter → resolve anchors by substring → group (only `current`/`decided` count as live) → compute documentation gaps, orphans, unresolved anchors → write the file.
**Intent / decisions:**

- Live evidence = `current`/`decided` only, so ideation never distorts gap analysis.
- Gaps are **advisory prompts** (they spark ideas / get refined), not mandates.
- **A prompted-and-approved gap resolves four ways**, then clears on reindex: capture the missing reasoning (a note with the right anchor); a spine proposal (if the spine itself lacks something); an `exploratory` idea note; or a "documented: not-required" marker for self-evident facts.
  **Escalates / boundary:** writes `knowledge/00-meta/INDEX.md` only; never edits the spine to fit an anchor.

## tc-delta-register — drift and "where are we vs intent"

**Purpose:** report forward gaps (current vs target) and drift; the SRO health-check.
**Steps:** read target → read current (read-only) → assess per requirement → mark `unverified` when unsure → write the register → report high-priority first.
**Intent / decisions:**

- **Requirement unit = the atomised README requirements appendix** (the BA agent's output). The register grades against that checklist.
- **Prioritisation** comes from each requirement's priority (set during atomisation), with **drift bumped above not-yet-built gaps** of equal priority and active-roadmap-section weighted first.
- **Current state** judged primarily from tests/types; where uncertainty exists, it reads implementation / PRs.
- **Report-only** (never edits spine/code) and **honesty-first** (an `unverified` row beats a wrong "implemented" — we take on no debt).
  **Escalates / boundary:** writes `knowledge/00-meta/DELTA-REGISTER.md` only.

## tc-handoff — the courier kill / work tracker

**Purpose:** carry an SRO-approved plan to Code and results back, removing the copy-paste relay.
**Steps:** chat → write work-order note (plan, context, acceptance, constraints) → Code picks up, implements on a branch, fills Results + PR + status → chat reads results via the connector.
**Intent / decisions:**

- The note carries the **plan** (not just a task), since the operator approves plans; and **Results** written back by Code.
- **Acceptance is concrete and checkable** (implementation completion is not acceptance).
- **Approval is at the backlog level (SRO gate 1), not per-handoff:** handoffs inside the approved day/week backlog are picked up by the engineer pair without per-item sign-off; only ADR-class or blocked items escalate.
- `blocked` status surfaces on the handoff board — part of your oversight.
  **Escalates / boundary:** writes `knowledge/05-handoffs/` only; implementation lands via the PR cycle.

---

These specs are the source of intent. If a skill's behaviour should change, update the skill _and_ the relevant entry here so the reasoning stays captured.
