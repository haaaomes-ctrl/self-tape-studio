# CLAUDE.md — TapeCoach Claude Code Operating Contract

@AGENTS.md
@MEMORY.md

## Project identity
- Product: TapeCoach (self-tape-studio) — AI-led professional self-tape critique. The performer-facing report IS the product.
- Repo: haaaomes-ctrl/self-tape-studio. Default branch: main. UK English for product copy.
- Stack: TanStack Start + Vite → Lovable deploy → Cloudflare Workers + Queues → Supabase (Postgres/Storage/PostgREST) + Mux (media) + Brevo (email).
- Monday board: "Tape Coach Development Roadmap" (board 5097223350, workspace Kanban Team) — verify via Monday MCP before relying on IDs.

## Source hierarchy (if these conflict, STOP and report)
1. README.md — controlling product contract.
2. AGENTS.md — implementation operating contract (imported above).
3. docs/tapecoach/s10-* — architecture, prompt map, calibration, same-video, fixtures.
4. docs/tapecoach/s10-analysis-pipeline-flow.md — live pipeline/flow + known-issue memory.
5. Monday items — sequencing + acceptance criteria.
6. GitHub PRs — implementation proof.

## Mandatory task-start procedure (no edits before this)
1. Identify the Monday item key, slice, and acceptance criteria.
2. Read README.md, AGENTS.md, the relevant docs/tapecoach/*, and the existing code + tests.
3. Produce a plan: scope, non-goals, files to touch, proof commands, validation gates, branch name.
4. Use plan mode for report/prompt/score/Supabase/route/PDF/queue/Lovable-sensitive work.

## Verification baseline (the REAL gates)
```bash
npm exec tsc -- --noEmit         # hard contract
npx vitest run                   # ~1.4k tests
npm exec prettier -- --check <changed files>
npm run build
