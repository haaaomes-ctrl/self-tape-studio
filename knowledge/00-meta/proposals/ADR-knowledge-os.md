# PROPOSAL — ADR: Adopt the TapeCoach Knowledge OS (apply via Claude Code, do not auto-apply)

> This is a _proposed_ ADR for the spine, to live at `docs/architecture/adr/`. Per the write-boundary, this system does not write the spine. Apply via Claude Code and assign the next number (records show ADRs 0005–0010 exist, so this is likely **ADR-0011** — confirm before committing). Recording the adoption at the controlling tier means future agents and contributors see it as a first-class architectural decision, not just corpus content.

---

## ADR-00XX: Adopt a two-tier Knowledge OS with an Obsidian cockpit

**Status:** Proposed
**Date:** 2026-06-06
**Deciders:** operator (Om)

### Context

Knowledge for TapeCoach is fragmented across ChatGPT, Claude, Claude Code, Codex, GitHub, Monday and docs, beyond what any single AI session can hold. The spine documents are deliberately small (context-bounded controlling contracts), so research, reasoning, rejected alternatives and parallel conversations have no home and are being lost. The operator also acts as a manual relay, copy-pasting between a chat surface and Claude Code, which slows development.

### Decision

Adopt a two-tier knowledge architecture:

- **Spine (controlling):** existing repo docs (README/AGENTS/CLAUDE/MEMORY/ADRs/s10). Unchanged authority; README wins on conflict.
- **Corpus (knowledge):** a git-backed Markdown vault under `knowledge/`, holding the why/research/decisions/history, with a status lifecycle and tolerant spine anchors.

With these properties:

1. **Write-boundary:** automated tooling and skills write only under `knowledge/`; spine and code changes are proposed via PR.
2. **Obsidian as cockpit/hub, not source of truth.** The vault is opened on the `knowledge/` subfolder (repo stays private), so the spine and code are physically outside the vault and unreachable by any live-write path (resolves the live-write risk).
3. **Skills are the consistency layer** (`tc-*`), portable across Claude Code, Claude.ai and the API.
4. **Courier elimination is achieved cheaply**: a short always-loaded `CLAUDE.md` pointer makes Claude Code corpus-aware so work can happen in Code directly; a handoff-note convention (`tc-handoff`, `knowledge/05-handoffs/`) replaces copy-paste when a chat surface is used.
5. **Generated artifacts** (`INDEX.md`, `DELTA-REGISTER.md`) provide traceability, gap detection and drift detection; these and the themed-agent layer are deferred amplifiers.

### Consequences

**Positive:** institutional memory survives; the manual relay is removed; consistent rules across surfaces; traceability and drift detection (valuable given the known README-vs-implementation divergence); resilient (plain Markdown in git; Obsidian is replaceable).

**Costs / obligations:** an ongoing capture habit (end-of-session ingestion); periodic full passes for the delta register if the incremental optimisation is adopted; the corpus must stay private.

**Risks:** dumping-ground bloat, weak retrieval amplified by premature agents, and live-write bypass — mitigated respectively by ingestion discipline, sequencing agents after retrieval is trusted, and the `knowledge/`-scoped vault. Full register in `knowledge/00-meta/RISKS.md`.

### References

- Design: `knowledge/00-meta/DESIGN.md`
- Plan: `knowledge/00-meta/IMPLEMENTATION-PLAN.md`
- Decisions: `knowledge/20-decisions-context/knowledge-os-decisions-2026-06.md`
