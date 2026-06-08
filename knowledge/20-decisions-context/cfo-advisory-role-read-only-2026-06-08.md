---
id: cfo-advisory-role-read-only
title: Why the CFO is a read-only, advisory role (not an actor on money)
tier: corpus
status: current
spine_anchor: ["ADR-0005", "AGENTS §Minimal env/config principle"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: PR-234 (feat/cfo-advisory-role)
discipline: null
monday_ref: null
tags: [finance, cfo, agent-ecosystem, ds-16, ds-17]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Summary

The agent ecosystem gained a **CFO** role on 2026-06-08 (PR #234). It is deliberately
**advisory and read-only**: it reads the owned finance data, tells the SRO the truth about
money, and recommends — it never moves money, pricing, Stripe or config. The contract is in
`00-meta/AGENT-ECOSYSTEM.md` §CFO; the finance area it serves is [[finance-area-readme]].

## Context / why

TapeCoach already had the finance **data** (DS-04 credit ledger, DS-06 partner pools,
DS-13 consumer revenue, DS-16 AI-cost baseline, DS-17 CFO dashboards) and an in-app
`cfo-dashboard.server.ts`, but no agent to read it, no place to keep the finance picture
over time, and no contract keeping that read honest. The role fills that gap without
widening the blast radius: the ecosystem's "one write path" (only the Developer mutates
code, via PR) is preserved, and the CFO adds a **read** path, not a second write path.

## Detail (the design choices and why)

- **Advisory, not an actor.** Money and pricing are the highest-blast-radius changes in the
  product. Keeping the CFO advisory means a finance recommendation flows SRO → BA item →
  engineer-pair PR — the same reviewed path as everything else — rather than an agent
  moving money directly. The CFO never grants credit, allocates pools, edits the catalogue,
  or touches Stripe/app-config.
- **The honesty rule is the point.** A finance role that flatters is worse than none. The
  contract forces: every figure cites its source query; the downside leads (burn,
  break-even gap, subsidy, unused-credit liability, sub-0.70 partner margins); never
  estimate ungrounded; measured figures are separated from planning constants; synthetic/
  canary runs (`synthetic_usage`, `commercial_metrics_excluded`) are excluded or flagged.
- **Read-only is structural where it can be, interim where it can't.** The agent's tool
  grant omits every mutation lever (no Edit/Write/Bash, no `apply_migration`, no edge
  deploy, no branch/merge) — that part is structural. But the Supabase MCP `execute_sql`
  is dual-use, so SELECT-only is currently a **contract**, not a DB-enforced guarantee. The
  structural fix (a dedicated read-only Postgres role, or the Supabase MCP `--read-only`
  mode) needs a migration via the merge protocol, so it is a follow-up BA item — tracked as
  the open question in [[finance-area-readme]], not restated here to keep the dashboard a
  single live list.
- **Grounding discipline.** The skill (`tc-finance-snapshot`) was written against the
  **live** schema, not migration files: this surfaced that the DS-17 views live in `public`
  (private by grant, not a separate schema) and that p50/p95 + cost-by-partner/source/
  duration already exist as columns. Those corrections live in [[finance-area-readme]].

## Links

- [[finance-area-readme]] — the finance corpus area, grounding corrections, and the
  structural-read-only open question.
- Contract: `00-meta/AGENT-ECOSYSTEM.md` §CFO; subagent `.claude/agents/cfo.md`; skill
  `tc-finance-snapshot`.
- Spine: ADR-0005 (submission quota and credit model); AGENTS §Minimal env/config
  principle.
- Sibling ecosystem decisions: [[engineer-pair-subagents-reviewer-keeps-bash-2026-06-08]].
