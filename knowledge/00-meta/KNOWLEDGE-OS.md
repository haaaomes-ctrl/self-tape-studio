# TapeCoach Knowledge OS — Founding Document (v2)

> **Superseded for architecture by `DESIGN.md` (v3.1).** This founding document is retained as the origin/constitution. Where it differs from `DESIGN.md` — notably the vault is now opened on the `knowledge/` subfolder, not the repo root — `DESIGN.md` is authoritative.

**Status:** founding spec for the TapeCoach knowledge layer.
**Language:** UK English.
**Scope:** governs the _knowledge layer only_. Does not override `README.md`. If anything here ever conflicts with a controlling product fact, the spine wins (§2).
**v2 changes:** corrected spine anchors to match real headings; added the tolerant, self-checking anchor convention (§4); added the hard write-boundary that keeps the live spine and code untouched (§2, §9); added the full logic breakdown (§11).

---

## 1. What this is

TapeCoach already has a strong knowledge **spine**: `README.md`, `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, the ADRs under `docs/architecture/adr/`, and the `docs/tapecoach/s10-*` specs. These are deliberately small because they are _controlling contracts_ that must fit inside an AI's working context and resolve conflicts deterministically ("README wins").

That size ceiling has a cost: the research, the reasoning behind each rule, the rejected alternatives, the discipline rubrics, and the parallel ChatGPT/Claude conversations that never got written down have no home in the spine, and are being lost.

The Knowledge OS adds a second tier without disturbing the first:

- **Spine (controlling layer):** the repo files above. Small, in-context, authoritative. Stays lean on purpose.
- **Corpus (knowledge layer):** an unbounded vault of evidence, reasoning, research and history, living under `knowledge/`. This is what the vault adds.

The corpus is the _why_ and the _full record_ behind the spine's _what_. It never competes with the spine.

---

## 2. The two rules that never bend

**Rule 1 — Authority.** No corpus note, at any status, ever overrides a controlling fact in the spine. On conflict the hierarchy is: `README.md` → `AGENTS.md` → `docs/architecture/` (topology) → `docs/tapecoach/s10-*` → roadmap → Monday → PRs.

**Rule 2 — Write-boundary.** The Knowledge OS and its skills **only ever create or modify files under `knowledge/`.** They never edit spine files (`README.md`, `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, anything under `docs/`) and never edit application code. When something needs to land in the spine, the skill drafts a _proposal_ inside `knowledge/` and hands it to the operator to apply via the normal PR process.

Rule 2 is what makes "keep everything, including stale parallel conversations" safe, and it is the guarantee that this system **cannot cause errors in the live repo**: an inaccurate anchor or an over-eager note can only ever produce a less-useful file under `knowledge/`, never a change to a controlling document or to code.

---

## 3. Physical layout

The corpus lives **inside the repo** so every tool that already reads the repo inherits it for free — Claude Code and Codex read it natively, and a Claude Project reaches it through the GitHub connector. No human has to ferry knowledge between tools (§10).

```
self-tape-studio/
├── README.md  AGENTS.md  CLAUDE.md  MEMORY.md     ← spine (NEVER modified by this system)
├── docs/architecture/  docs/tapecoach/            ← spine (NEVER modified by this system)
├── knowledge/                                     ← the corpus (this system writes here only)
│   ├── 00-meta/
│   │   ├── KNOWLEDGE-OS.md         (this document)
│   │   ├── IMPLEMENTATION-GUIDE.md (the rollout steps)
│   │   ├── INDEX.md                (GENERATED — do not hand-edit)
│   │   └── DELTA-REGISTER.md       (GENERATED — do not hand-edit)
│   ├── 10-research/             discipline rubrics, calibration research, coaching/casting research
│   ├── 20-decisions-context/    the "why" behind ADRs and README rules
│   ├── 30-conversations/        distilled Claude/ChatGPT/Codex threads
│   ├── 40-product-ideas/        proposals not yet decided
│   ├── 50-marketing/            positioning, messaging, landing-copy thinking
│   └── 90-archive/              raw transcripts kept whole; NOT notes
└── .claude/skills/             ← the four skills (project-scoped, committed)
    ├── tc-vault-note/SKILL.md
    ├── tc-conversation-ingestion/SKILL.md
    ├── tc-knowledge-index/SKILL.md
    └── tc-delta-register/SKILL.md
```

Open the **`knowledge/` subfolder** as the Obsidian vault (not the repo root — see `DESIGN.md` §6; this keeps the spine and code outside the vault). Add `knowledge/.obsidian/` to `.gitignore` so Obsidian's local config does not pollute the repo. The generated `INDEX.md` and `DELTA-REGISTER.md` may be committed (they are shareable), but because the repo runs `prettier --check` on changed files, either run Prettier on them before commit or add them to `.prettierignore` to avoid format-vs-churn friction.

**Alternative layout:** if you want to decouple knowledge cadence from code cadence, make `knowledge/` its own repo and add it as a submodule, or open it as a second vault. The in-repo default is recommended because it maximises the courier-elimination benefit (§10).

---

## 4. Note schema, status, and the anchor convention

Every corpus note carries YAML front-matter. The full schema and authoring rules live in the **`tc-vault-note`** skill; this is the summary.

```yaml
---
id: score-calibration-professional-rationale # stable, unique, never reused or renamed
title: Why Professional scoring uses stricter 0–100 thresholds
tier: corpus
status: decided # exploratory | current | superseded | decided
spine_anchor: ["README §1.6 Calibration doctrine"]
decided_ref: "README §1.6 Calibration doctrine" # set only when status: decided
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "2026-05-30 calibration thread"
tags: [scoring, calibration, discipline-research]
confidence: high
created: 2026-05-30
updated: 2026-06-05
---
```

**Status meanings:**

- `exploratory` — an idea, research-in-progress, or a captured parallel conversation. Never authoritative; safe to keep forever. Default for most ingested threads.
- `current` — the best present understanding of a corpus topic (e.g. the discipline research rubric as it stands). Authoritative _within the corpus_, still subordinate to the spine.
- `superseded` — replaced by a newer note; sets `superseded_by` + `supersession_reason`. Kept as history.
- `decided` — ratified into the spine; defers to `decided_ref`. Records the _why_ behind a spine fact.

**Anchor convention (corrected in v2).** Spine anchors are tolerant, human-readable labels — not fragile auto-generated URL fragments:

- Spine docs: `"<FILE> §<section label>"`, e.g. `"AGENTS §Core doctrine"`, `"README §3 Input model and submission context"`, `"roadmap §Track H Audition take lifecycle"`.
- ADRs: `"ADR-XXXX"`, e.g. `"ADR-0003"`.

`tc-knowledge-index` resolves each label by case-insensitive substring match against the real headings it scans from the spine. **A label that matches nothing is reported as an "unresolved anchor" in `INDEX.md`** — a prompt to fix the note, never a change to the spine. (Real headings exist for these examples: `## Core doctrine` in AGENTS; `### 1.6 Calibration doctrine` and `## 3. Input model and submission context` in README; `### Track H — Audition take lifecycle and admin reports` in the roadmap; `ADR-0003`.)

**The two deltas:**

- _Backward (lineage):_ `supersedes` / `superseded_by` / `supersession_reason` record how an idea evolved and why the current version replaced the historic one.
- _Forward (gap):_ the gap between target (spine) and current reality (code + `current` notes) is **computed** by `tc-delta-register`, never stored in the note — so it cannot go stale.

---

## 5. The generated index

`knowledge/00-meta/INDEX.md` maps each spine anchor to its supporting corpus evidence. **Generated, never hand-maintained**, so the spine stays lean. It also surfaces: **documentation gaps** (controlling facts with no live evidence), **orphan notes** (notes with no anchor — sometimes legitimate research), and **unresolved anchors** (labels that match no heading). Regenerated by `tc-knowledge-index`.

---

## 6. The delta + drift engine

`knowledge/00-meta/DELTA-REGISTER.md` compares **target** (spine: README, roadmap, ADRs) against **current reality** (code + `current` notes). One engine, two questions: **forward gaps** (where current falls short of target — the work) and **drift** (spine-vs-spine or spine-vs-code contradictions). It **reports; it never resolves**, and it reads code **read-only**. Regenerated by `tc-delta-register`.

---

## 7. The four skills

| Skill                       | Job                                                                  | Fires when                               | Writes                                                            |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `tc-vault-note`             | Canonical note schema + status lifecycle. Foundation for the others. | Creating/updating any `knowledge/` note. | `knowledge/**` only                                               |
| `tc-conversation-ingestion` | Distil a Claude/ChatGPT/Codex thread into status-tagged notes.       | Capturing a conversation/export.         | `knowledge/**` only                                               |
| `tc-knowledge-index`        | Regenerate `INDEX.md`.                                               | Rebuilding the index / checking gaps.    | `knowledge/00-meta/INDEX.md` only                                 |
| `tc-delta-register`         | Regenerate `DELTA-REGISTER.md`.                                      | Asking current-vs-target / drift.        | `knowledge/00-meta/DELTA-REGISTER.md` only (reads code read-only) |

Every skill states the write-boundary (Rule 2) in its own body, so the guarantee holds even when a skill is loaded in isolation.

---

## 8. Install summary

Project-scoped (Claude Code / Codex): commit the four folders under `.claude/skills/`. Claude looks in `.claude/skills/` (project, highest priority) and `~/.claude/skills/` (personal). `SKILL.md` is case-sensitive; restart Claude Code after adding skills. On Claude.ai: enable Skills in Settings → Features (paid plans) and upload each `.skill` file. The format is identical across surfaces. Full steps in `IMPLEMENTATION-GUIDE.md`.

---

## 9. Why this is safe for the live repo

1. **Write-boundary (Rule 2):** skills touch `knowledge/` only — never the spine, never code.
2. **Additive install:** adding markdown under `knowledge/` and skill folders under `.claude/skills/` changes no TypeScript, tests, build, or runtime. The verification gates (`tsc`, `vitest`, `build`, `dry-run:analysis-worker`) are unaffected.
3. **Branch + PR:** the rollout never commits to `main` directly; everything goes through a branch and PR, matching the repo's existing flow.
4. **Inaccuracy fails soft:** a wrong anchor or an over-eager note degrades a generated file under `knowledge/`, surfaced as an "unresolved anchor" — it never corrupts a controlling document.
5. **Generated files are marked and isolated:** `INDEX.md`/`DELTA-REGISTER.md` carry a "generated — do not hand-edit" header and can be `.prettierignore`d to avoid churn.

---

## 10. Roles: kill the courier, keep the operator

When you copy a Claude Code prompt and paste its output back into a Claude Project, you are a **courier** — pure transport overhead, the thing to delete. When you confirm an uncertain assumption or make a release call (as `AGENTS.md` already requires), you are an **operator** — valuable, and to be kept.

The git-backed corpus is a shared dead-drop: Claude Code writes to it, a Claude Project reads it via the GitHub connector, neither needs you as the carrier. The skills make the _rules_ portable so you never re-explain them per session. The goal is not "no human in the loop" — it is "no human as the USB stick", with you promoted to operator/approver.

---

## 11. Full logic breakdown (the reasoning, end to end)

This records the design reasoning so it survives as knowledge, not just conclusions.

**11.1 The problem.** Knowledge is fragmented across ChatGPT, Claude, Claude Code, Codex, GitHub, Monday and docs. No single AI session can hold it all. The instinct to centralise it is correct; the question was _where authority sits_ and _how tools share it_.

**11.2 Why the corpus is not a second source of truth.** The original plan proposed "Obsidian = source of truth for knowledge." Rejected: the repo's markdown (README/AGENTS/CLAUDE/ADRs/s10-\*) is already the knowledge source of truth, with an enforced hierarchy ("README wins"). A second store would manufacture drift — the very problem the plan warned about, but worse, because the duplicate would sit outside version control and PR review. Resolution: a **two-tier model** — a small controlling spine and an unbounded corpus — that do not claim the same territory.

**11.3 Why authority and volume are separable.** The challenge raised: the spine is lean _because of a context-window ceiling_, and that ceiling discards valuable material (discipline rubrics, reasoning, rejected ideas, parallel threads). Correct. The fix is not to enlarge the spine but to give that material a home in the corpus, with the spine acting as a thin authoritative **index over a deep corpus**. Authority stays in the spine; volume moves to the corpus.

**11.4 Why the graph does not power AI retrieval.** Obsidian backlinks and the graph are human-navigation conventions. An AI reading raw markdown sees literal `[[wikilinks]]`; it does not traverse the graph. Retrieval keys off headings, front-matter and explicit indexes. Therefore the system invests in **metadata discipline** and a **generated index**, and treats the graph as a human bonus.

**11.5 Why MCP is not the linchpin.** Claude Code and Codex read the repo natively; Claude.ai reaches it via the GitHub connector; ChatGPT is the weakest live consumer and is treated as an export _source_, not a live reader. Making the corpus a **git-backed repo of markdown** means every tool that already reads the repo inherits the knowledge, demoting MCP from linchpin to nice-to-have.

**11.6 Index vs inline links.** Hand-maintained inline links in the spine reintroduce the size pressure we are escaping. So the spine carries only lightweight anchors; a **generated index** does the comprehensive linking, and is regenerated rather than curated.

**11.7 The two deltas.** Backward lineage (how an idea evolved and why current beat historic) is stored in front-matter. Forward gap (current vs target = the work) is **computed**, not stored, to avoid stale gap text. Drift detection (spine-vs-spine, spine-vs-code) is the _same comparison engine_ pointed sideways instead of forward — built once.

**11.8 Skills as the consistency layer.** Skills are markdown that load only when relevant and work across Code, Claude.ai and the API. Encoding the schema, ingestion rules, index and delta logic as skills makes knowledge management consistent across every surface and removes the need to re-explain rules each session — directly attacking the courier role.

**11.9 Courier vs operator.** The manual copy-paste relay is transport overhead to delete; the operator's confirmation/approval role (already in AGENTS.md) is to keep. The shared git corpus + skills delete the courier and preserve the operator.

**11.10 Sequencing.** Skills + shared corpus first (kills the courier, proves retrieval). Then subagents / Agent Teams for the themed specialists — _after_ retrieval is trusted, because agents amplify whatever retrieval quality exists. Then Cowork as the operator cockpit for non-code knowledge ops. Design on a parallel marketing track. Doing all at once recreates the "dump everything, no structure" failure at the tooling level.

**11.11 Safety as a design property.** The write-boundary (Rule 2) was added so the system is provably incapable of editing the spine or code. Combined with branch+PR install and soft-failing inaccuracy, the live repo is protected by construction, not by carefulness.

---

## 12. Ingestion discipline (guardrails)

- Not every conversation deserves a note. Capture net-new decisions, requirements, research, gaps and open questions. Raw transcripts go to `90-archive/` whole, or nowhere.
- Items that affect code/product behaviour do **not** become free-standing authoritative notes — they become a `decided` note whose `decided_ref` points to a _proposed_ README/ADR change the operator applies. The skill never writes the spine itself.
- One note per distinct idea, not one per chat dump.
- Set `spine_anchor` whenever a note relates to a controlling fact; otherwise tag it research/history and let it stand alone.
- Never hand-edit `INDEX.md`/`DELTA-REGISTER.md`; rerun the skill.
