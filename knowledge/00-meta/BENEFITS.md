# TapeCoach Knowledge OS — Benefits Record

**Status:** benefits of record, for tracking realisation over time.
**Language:** UK English.
**How to read this:** each benefit names who it accrues to, the mechanism that delivers it, and an indicator — a concrete signal that tells you it is actually working, so this stays a record rather than a wish-list. Benefits are deliberately tied to mechanisms already in the design; speculative upside is excluded.

---

## A. Benefits to the project

| Benefit                                                                                          | Mechanism                                                                                                | Indicator it is working                                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Institutional memory** — reasoning, research and decisions survive beyond chat history         | Corpus notes with status/lineage; ingestion discipline                                                   | New work cites existing notes instead of re-deriving; the discipline rubric and calibration reasoning are findable months later |
| **Courier elimination** — no human ferries prompts/results between a chat and Claude Code        | Always-loaded `CLAUDE.md` pointer (work in Code directly) + `tc-handoff` work orders + git-backed corpus | Operator stops copy-pasting between a chat and Code; development stops being relay-bound (the top-priority win)                 |
| **Sustained capture** — knowledge accrues instead of evaporating at session end                  | Collaborative end-of-session ritual via `tc-conversation-ingestion`; Capture-log Base                    | A capture pass happens each session and lands a few sharp notes; open questions are visible                                     |
| **Traceability** — every controlling fact links to its evidence                                  | `spine_anchor` + generated `INDEX.md`                                                                    | You can answer "why does this rule exist?" from the index in seconds                                                            |
| **Gap detection** — undocumented rules and unlinked notes surface automatically                  | `INDEX.md` documentation-gap / orphan / unresolved-anchor sections                                       | The gap list shrinks deliberately; no controlling fact stays silently undocumented                                              |
| **Drift detection** — contradictions between docs, and between docs and code, are caught         | `DELTA-REGISTER.md` (spine-vs-spine, spine-vs-code)                                                      | Drift is found in review, not in production                                                                                     |
| **Roadmap feed** — the work is computed, not guessed                                             | Forward-delta gaps in `DELTA-REGISTER.md`                                                                | High-severity gaps become roadmap slices with evidence                                                                          |
| **Decision provenance** — decisions carry their reasoning and lineage                            | Decisions notes; `supersedes`/`supersession_reason`                                                      | A year on, you can see not just what was decided but why, and what it replaced                                                  |
| **Faster onboarding** — a new collaborator (or agent) reads the corpus, not the founders' memory | Corpus + Bases dashboards                                                                                | Time-to-context for a new contributor drops                                                                                     |
| **Consistent operating contract** — the same rules apply on every surface                        | Skills (Code / Claude.ai / API)                                                                          | Behaviour is identical whether work happens in Claude Code or a Project                                                         |
| **Human comprehension at a glance**                                                              | Obsidian Bases dashboards over the schema                                                                | The operator reads the state of knowledge from a board, not by opening files                                                    |
| **Resilience / no lock-in**                                                                      | Corpus is plain Markdown in git; Obsidian is a replaceable lens                                          | Removing Obsidian leaves the corpus fully usable by every other tool                                                            |

## B. Benefits to Claude / the agents (the reasoning layer)

| Benefit                                                                                     | Mechanism                                                     | Indicator it is working                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Reduced context load** — retrieve the relevant slice instead of holding everything        | Git/MCP retrieval over a structured corpus                    | Tasks succeed without pre-loading large context; less truncation                                 |
| **Grounded answers, less confabulation** — reasoning sits on retrieved evidence             | Front-matter + headings + `INDEX.md` as retrieval targets     | Answers cite corpus notes; fewer invented specifics                                              |
| **One operating contract, not re-explanation** — rules live as skills                       | Portable SKILL.md files                                       | The operator stops re-stating the schema/ingestion rules each session                            |
| **Reliable change scoping** — know exactly what a task depends on                           | Requirement→dependency map + git-diff incremental delta       | An agent re-reads only what changed; runs stay fast and focused as the repo grows                |
| **Self-checking knowledge** — stale or mislinked knowledge is visible, not silently trusted | Status lifecycle + unresolved-anchor reporting                | Agents distinguish `exploratory` fossils from `decided` contracts; no acting on superseded notes |
| **Drift awareness** — agents can flag contradictions rather than propagate them             | `DELTA-REGISTER.md` engine                                    | Agents surface spine-vs-code conflicts during work                                               |
| **Safer autonomy** — agents can act without risking the live repo                           | Write-boundary + read-primary MCP + vault scoping + branch/PR | Agents propose spine/code changes via PR; never edit them directly                               |

## C. Compounding benefits (realised once A and B hold together)

- **Themed agents become viable** — Product/Architecture/Dev/Research/Marketing agents are only as good as retrieval; a trusted corpus is the precondition that makes them worth building.
- **The system improves itself** — the gap and drift registers continuously point at the next-most-valuable thing to capture or fix, so the corpus gets more complete and more accurate over time rather than rotting.
- **Operator promotion** — with the courier role gone, the human's time concentrates on the high-value operator role (confirming uncertain assumptions, making release calls) that `AGENTS.md` already defines.

---

## Notes on calibration

These benefits are conditional on the disciplines that protect them: ingestion bar-raising (or the corpus floods and retrieval degrades), the write-boundary (or drift and live-repo risk return), and skill iteration before agents (or agents amplify weak retrieval). The benefits and the risks (`RISKS.md`) are two sides of the same mechanisms — the value is real only while the mitigations hold.
