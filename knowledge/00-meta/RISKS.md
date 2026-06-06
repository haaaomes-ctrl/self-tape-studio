# TapeCoach Knowledge OS — Risk Record

**Status:** risk register of record. Review when the design changes or at each phase boundary.
**Language:** UK English.
**Format:** each risk has a likelihood and impact (Low/Med/High), the mitigation built into the design, and the residual risk that remains after mitigation. Ordered roughly by severity. R3 is the risk this review surfaced and is the most important to act on deliberately.

---

### R1 — The corpus becomes a dumping ground

**Likelihood:** High · **Impact:** High (retrieval degrades; the system loses trust)
**Mitigation:** ingestion discipline is a hard rule — capture only net-new decisions/requirements/research/gaps; one note per idea; raw transcripts to `90-archive/` or nowhere; the ingestion skill keeps the bar high (two–three sharp notes from a long thread, not fifteen). Validated in Phase 1 before scale.
**Residual:** Med — depends on sustained discipline; the gap/orphan reports help spot bloat early.

### R2 — The corpus is treated as a source of truth; drift with the spine

**Likelihood:** Med · **Impact:** High (controlling decisions get made from non-authoritative notes)
**Mitigation:** the authority rule (README wins) and status lifecycle; `decided` notes defer to `decided_ref`; the design states plainly that Obsidian is not the source of truth (DESIGN §2).
**Residual:** Low — provided the authority rule is respected in practice.

### R3 — Live Obsidian write bypasses the write-boundary (surfaced by this review; now resolved by default)

**Likelihood:** Low (after the default below) · **Impact:** High (an agent with REST/MCP write access to a _repo-root_ vault could edit the spine or code, bypassing PR review)
**Mitigation:** the repo is private, so the **default layout opens the vault on the `knowledge/` subfolder**, leaving the spine and code physically outside the vault and unreachable by the Local REST API/MCP (DESIGN §6). The MCP is read-primary and corpus writes flow through skills → git → PR. Never symlink spine/code into the vault.
**Residual:** Low by construction once the `knowledge/`-scoped vault is used (the settled default). The earlier "High until scoped" window is closed.

### R4 — Anchor rot (labels break as the spine is renamed/renumbered)

**Likelihood:** High (S10 docs are in active flux) · **Impact:** Med (index links degrade)
**Mitigation:** label by section _name_ not number; substring matching tolerates minor change; unresolved anchors are reported (never break the spine); A→B plan promotes referenced sections to explicit markers when breakage is frequent; Cowork automates seeding and link-forcing.
**Residual:** Low–Med — fully addressed once explicit anchors (B) are seeded for referenced sections.

### R5 — Stale or incorrect delta verdicts

**Likelihood:** Med · **Impact:** Med (the roadmap is fed bad signal)
**Mitigation:** incremental baseline invalidated exactly by git diff; per-row "last verified at SHA/date"; "never assert what you cannot verify" → mark `unverified`; periodic full re-baseline.
**Residual:** Low — bounded by the dependency-map accuracy (see R6).

### R6 — Dependency-map inaccuracy (incremental delta skips a changed requirement)

**Likelihood:** Med · **Impact:** Med (a real change is missed because the map didn't link it)
**Mitigation:** treat the requirement→dependency map as a first-class deliverable (Phase 3); periodic full re-baseline catches map drift.
**Residual:** Low–Med — inherent to any caching scheme; the periodic full pass is the backstop.

### R7 — MCP / REST security exposure

**Likelihood:** Med · **Impact:** High (vault contents are sensitive product reasoning)
**Mitigation:** API key is local and never committed; prefer Tailscale Funnel over public exposure for remote access; self-signed cert trusted locally; vault kept private; read-primary by default.
**Residual:** Low–Med — standard local-service hygiene; revisit if remote access widens.

### R8 — Over-reliance on Obsidian-specific features for AI retrieval

**Likelihood:** Med · **Impact:** Med (retrieval built on the graph/wikilinks fails for agents that don't traverse them)
**Mitigation:** the design states retrieval keys off front-matter, headings and the generated index; graph/Bases are human-only; metadata discipline is the AI path.
**Residual:** Low — provided the division of labour is kept.

### R9 — Obsidian lock-in / single point of failure

**Likelihood:** Low · **Impact:** Low–Med
**Mitigation:** the corpus is plain Markdown in git; Obsidian is a replaceable lens; every other tool reads the files directly without Obsidian.
**Residual:** Low — by construction.

### R10 — Skills mis-trigger or retrieval quality is weak → agents amplify it

**Likelihood:** Med · **Impact:** High (bad agent output at scale)
**Mitigation:** eval/iterate the skills in Phase 1 on real threads; do not build themed agents (Phase 6) until P1–P3 retrieval is trusted; skill descriptions tuned for triggering.
**Residual:** Low–Med — managed by sequencing.

### R11 — Generated-file churn / Prettier conflicts / accidental `.obsidian` commit

**Likelihood:** Med · **Impact:** Low
**Mitigation:** `.obsidian/` gitignored; generated files carry "do not hand-edit" headers and are `.prettierignore`d or formatted; install is additive and unaffected by the gates.
**Residual:** Low.

### R12 — Vault privacy

**Likelihood:** Low · **Impact:** High (leak of product strategy/research)
**Mitigation:** vault is private and (in the default layout) inside the private repo; no public share/export of the corpus; remote access via Tailscale only.
**Residual:** Low — provided the repo and vault stay private.

### R13 — The system rots from neglect (maintenance burden)

**Likelihood:** Med · **Impact:** Med (an unmaintained vault loses value, the classic failure mode)
**Mitigation:** automation (Cowork seeding/link-forcing, incremental delta) removes most manual upkeep; the gap/drift registers make the next action obvious; low-ceremony additive workflow.
**Residual:** Med — the human still owns ingestion judgement and periodic full passes; the automation reduces but does not eliminate this.

### R14 — Operator effort at scale is unquantified until live

**Likelihood:** Med · **Impact:** Med (effort could exceed the benefit if it doesn't scale well)
**Mitigation:** phased rollout (commit only to the cheap foundation); instrument the actual time spent on capture/handoffs in the first weeks; gate each amplifier on observed effort-vs-benefit; automation reduces effort over time.
**Residual:** Monitored — genuinely unknown until the system runs; right-size on lived data, not the plan.

### R15 — Multi-agent specification failures (the largest failure category)

**Likelihood:** Med-High · **Impact:** High (ambiguous roles / missing termination → duplicated work, gaps, loops)
**Mitigation:** role contracts with objective, output format and **termination conditions**; the README atomisation as living requirements (the top failure mitigation); no duplicate roles (Business Change deferred).
**Residual:** Low-Med — depends on spec quality, which is why the BA/atomisation is early and load-bearing.

### R16 — Multi-agent coordination failures (collusion, loops, lost context)

**Likelihood:** Med · **Impact:** Med-High (agents rubber-stamp, loop, or drop context at handoffs)
**Mitigation:** native Agent Teams structured messaging (not Slack); escalate-on-uncertainty + max-iteration caps; the corpus + spine as shared ground truth (not agent-to-agent memory); persistent handoff notes; sequential evaluator-optimizer for review rather than parallel agents deciding the same thing.
**Residual:** Low-Med.

### R17 — Multi-agent cost and verification gaps

**Likelihood:** Med · **Impact:** Med (token cost ~15× single-session; single-stage checks miss errors)
**Mitigation:** instrument token cost from day one (pairs with Slack monitoring); cost-gate each tranche; multi-level independent verification (reviewer + automated PR review + SRO); never premature termination.
**Residual:** Low-Med — bounded by monitoring and the verification layers.

---

## Summary

R3 (live-write bypass) is **Low by construction** (private repo + `knowledge/`-scoped vault). The largest live risks are now **R15** (multi-agent specification quality) and **R1** (dumping-ground bloat) — both answered by clear specs, the README atomisation as living requirements, and the Phase-1 ingestion discipline; with **R16/R17** (coordination, cost, verification) handled by native coordination, multi-level verification, termination caps and cost instrumentation, and **R14** (operator effort) monitored on lived data. The benefits in `BENEFITS.md` hold only while these mitigations hold.
