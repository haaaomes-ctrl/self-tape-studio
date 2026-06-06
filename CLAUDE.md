# CLAUDE.md — TapeCoach Claude Code Operating Contract

@AGENTS.md
@MEMORY.md

## Project identity

- Product: TapeCoach (self-tape-studio) — AI-led professional self-tape critique. The performer-facing report IS the product.
- Repo: haaaomes-ctrl/self-tape-studio. Default branch: main. UK English for product copy.
- Stack: TanStack Start + Vite. The app (UI/editor/upload/auth/Mux-webhook-receive/analysis-dispatch/report-viewing) is hosted by Lovable; owned Supabase (Postgres/Storage/PostgREST) is the system of record; Mux = media; Brevo = email.
- Runtime topology: durable S10 analysis runs in a SEPARATE Cloudflare analysis Worker (`analysis-worker/`) — `/dispatch-analysis` + the `tapecoach-analysis-jobs` queue consumer + direct OpenRouter `runAnalysisJob` writing to owned Supabase. The Lovable app does NOT run the analysis pipeline. Full detail + invariants: `docs/architecture/` (ADR-0003 is the current topology).
- Monday board: "Tape Coach Development Roadmap" (board 5097223350, workspace Kanban Team) — verify via Monday MCP before relying on IDs.

## Source hierarchy (if these conflict, STOP and report)

1. README.md — controlling product contract.
2. AGENTS.md — implementation operating contract (imported above).
3. docs/architecture/ — authoritative for runtime topology, ownership boundaries, deployment, and where analysis executes (ADRs + runbooks). Does NOT override README's product contract; it governs HOW/WHERE, not WHAT the report says.
4. docs/tapecoach/s10-\* — architecture, prompt map, calibration, same-video, fixtures.
5. docs/tapecoach/s10-analysis-pipeline-flow.md — live pipeline/flow + known-issue memory.
6. Monday items — sequencing + acceptance criteria.
7. GitHub PRs — implementation proof.

## Mandatory task-start procedure (no edits before this)

1. Identify the Monday item key, slice, and acceptance criteria.
2. Read README.md, AGENTS.md, the relevant docs/tapecoach/\*, and the existing code + tests.
3. Produce a plan: scope, non-goals, files to touch, proof commands, validation gates, branch name.
4. Use plan mode for report/prompt/score/Supabase/route/PDF/queue/Lovable-sensitive work. For runtime-topology, analysis-execution, deployment, or queue-consumer changes, FIRST read docs/architecture/ (ADRs + runbooks) and honour its invariants: the dedicated analysis Worker (`analysis-worker/`), the one-consumer rule for `tapecoach-analysis-jobs`, the TanStack-free worker constraint, and "no ANALYSIS_RUN_ENDPOINT / Worker→Lovable bridge." Changes that contradict an ADR require a new ADR.

## Verification baseline (the REAL gates)

```bash
npm exec tsc -- --noEmit         # hard contract
npx vitest run                   # ~1.4k tests (3 known pre-existing failures)
npm exec prettier -- --check <changed files>
npm run build
npm run dry-run:analysis-worker  # ONLY when analysis-worker/ (or its deps) changed
```

## Knowledge corpus (knowledge/)

This repo carries a knowledge corpus under `knowledge/` — the reasoning, research, decisions and history behind the spine. It is NOT the source of truth: the spine (`README.md`, `AGENTS.md`, this file, `docs/`) is controlling, and on conflict README wins. The corpus is the _why_; the spine is the _what_.

Before starting non-trivial work, consult the corpus for relevant context (decisions, research, prior threads). The design of record is `knowledge/00-meta/DESIGN.md`.

Operating rules for the corpus:

- **Write-boundary (corpus work only):** when working on the knowledge corpus (the tc-\* skills, capture, indexing), only create or modify files under `knowledge/`, and propose any spine change as a note plus a reviewed PR. This scopes the corpus tooling — it does NOT restrict normal development, where application code is edited through the usual branch + PR workflow.
- **Notes follow the schema** in `.claude/skills/tc-vault-note`. Status is one of `exploratory | current | superseded | decided`; treat `exploratory`/`superseded` notes as non-authoritative.
- **Generated files** (`knowledge/00-meta/INDEX.md`, `DELTA-REGISTER.md`) are produced by skills — do not hand-edit; rerun the skill.
- **Skills** available: `tc-vault-note`, `tc-conversation-ingestion`, `tc-knowledge-index`, `tc-delta-register`, `tc-handoff`.
- **Cross-surface work:** tasks handed from a chat surface arrive as handoff notes under `knowledge/05-handoffs/` (see `tc-handoff`). Read the open handoff, do the work, record results back to the note and link the PR — instead of expecting copy-pasted instructions.
- **At session end:** offer to capture the session via `tc-conversation-ingestion` (decisions, research, open questions, completed handoffs).
