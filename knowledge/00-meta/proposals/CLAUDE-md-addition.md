# PROPOSAL — CLAUDE.md addition (apply via Claude Code, do not auto-apply)

> This is a _proposed_ edit to the spine file `CLAUDE.md`. Per the write-boundary, this system does not edit the spine. Apply it yourself via Claude Code on a branch and merge by PR. It is the single highest-leverage "memory" commit: because `CLAUDE.md` is always loaded, this is what makes every Claude Code session aware of the corpus without you re-explaining it — and it is what lets you work in Code directly instead of relaying through a separate chat.

## Suggested block to add to `CLAUDE.md`

```markdown
## Knowledge corpus (knowledge/)

This repo carries a knowledge corpus under `knowledge/` — the reasoning, research, decisions and history behind the spine. It is NOT the source of truth: the spine (`README.md`, `AGENTS.md`, this file, `docs/`) is controlling, and on conflict README wins. The corpus is the _why_; the spine is the _what_.

Before starting non-trivial work, consult the corpus for relevant context (decisions, research, prior threads). The design of record is `knowledge/00-meta/DESIGN.md`.

Operating rules for the corpus:

- **Write-boundary:** only create or modify files under `knowledge/`. Never edit the spine or application code directly — propose those changes for a reviewed PR.
- **Notes follow the schema** in `.claude/skills/tc-vault-note`. Status is one of `exploratory | current | superseded | decided`; treat `exploratory`/`superseded` notes as non-authoritative.
- **Generated files** (`knowledge/00-meta/INDEX.md`, `DELTA-REGISTER.md`) are produced by skills — do not hand-edit; rerun the skill.
- **Skills** available: `tc-vault-note`, `tc-conversation-ingestion`, `tc-knowledge-index`, `tc-delta-register`, `tc-handoff`.
- **Cross-surface work:** tasks handed from a chat surface arrive as handoff notes under `knowledge/05-handoffs/` (see `tc-handoff`). Read the open handoff, do the work, record results back to the note and link the PR — instead of expecting copy-pasted instructions.
- **At session end:** offer to capture the session via `tc-conversation-ingestion` (decisions, research, open questions, completed handoffs).
```

## Why this block and not more

`CLAUDE.md` is always-loaded context, so every line costs budget on every session. This block is deliberately short: it tells an agent the corpus exists, where the design lives, the five rules that keep it safe, and the two routines (handoffs in, capture out) that remove the manual relay. Everything else lives in `knowledge/` and is read on demand. Do not paste the full DESIGN into `CLAUDE.md` — point to it.
