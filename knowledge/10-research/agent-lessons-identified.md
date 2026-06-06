# Agent Ecosystem — Lessons Identified (external research)

**Status:** `current`. External best-practice and failure-mode research distilled into lessons for the TapeCoach agent ecosystem. This is _learning from others_, not our design — our design is `AGENT-ECOSYSTEM.md`; these lessons refine it.
**Language:** UK English.

---

## 1. Patterns — name what we're building

Anthropic's _Building Effective Agents_ defines five composable patterns (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer). Two map directly onto our design:

- **Evaluator–optimizer = the Tranche-1 engineer pair.** One agent generates (the Developer), another evaluates against criteria and sends it back to iterate until quality is met (the Senior-Dev reviewer). This is the canonical pattern for the implementer↔reviewer loop — so Tranche 1 is a known, recommended shape, not an experiment.
- **Orchestrator–worker = the Project Manager.** A lead decomposes work and delegates to workers operating on distinct scopes (parallel PRs), then synthesises. Anthropic's own coding agents use this for multi-file GitHub issues.

When multi-agent is worth it: Anthropic's multi-agent research system used ~15× the tokens of a single chat, with token usage explaining ~80% of performance variance. Lesson: multi-agent earns its cost on high-value, parallelisable work or where independent verification matters — not on everything. This is the empirical basis for our "earn its place" discipline.

## 2. Role-definition best practice

From Anthropic's multi-agent system: every agent needs an **objective, an output format, guidance on tools/sources, and clear task boundaries** — without detailed task descriptions, agents duplicate work or leave gaps. MAST (below) adds two: **explicit termination conditions** and **no duplicate roles**.

Lesson — strengthen our role contracts with two fields we don't yet have:

- **Output format/contract** per agent (so other agents don't have to infer what they'll receive — see coordination failures below).
- **Termination conditions** (when the agent stops, hands off, or escalates — the max-iteration cap is a termination condition).
  And the no-duplicate-roles rule directly vindicates deferring **Business Change** (it overlaps PM and Marketing).

## 3. The failure taxonomy (MAST) and our mitigations

MAST (Cemri et al., NeurIPS 2025) analysed 1,600+ execution traces across 7 frameworks and found 14 failure modes in three buckets. Production failure rates of 41–86% are common, and the failures are _systemic_ (design), not model weakness. Mapped to us:

| MAST category (~share)            | What goes wrong                                                                          | Our mitigation                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specification & design (~42%)** | ambiguous roles, poor decomposition, duplicate roles, **missing termination conditions** | Clear role contracts (§2); the README **atomisation + BA agent as living requirements** — research finds living specifications eliminate the requirement drift that drives the largest failure category                   |
| **Coordination (~37%)**           | fragile handoffs, context loss, agents ignoring/withholding info, theory-of-mind gaps    | Structured, persistent handoffs (`tc-handoff` notes); the corpus + spine as shared ground truth (agents read facts, not each other's memory); native Agent Teams messaging; explicit output formats                       |
| **Verification (~21%)**           | weak/single-stage checks, premature termination                                          | **Multi-level verification** — reviewer subagent + automated PR review + SRO are three independent checks; the no-debt honesty principle (don't rubber-stamp); termination caps that escalate rather than silently ending |

The headline lesson: ~79% of failures come from specification and coordination, and the highest-ROI fixes are **better specs and structured communication** — which is precisely the README atomisation, the role contracts, and the handoff/corpus substrate. The architecture is sound; the _spec quality_ is where the risk lives.

## 4. Coordination and monitoring — the Slack question

- **Agent-to-agent coordination: use native, not Slack.** Claude Code Agent Teams has a built-in shared task list, a mailbox, and direct messaging between teammates, with a team lead spawning teammates that own scopes. Native coordination is more reliable than routing agent chatter through Slack, and it produces the _structured_ communication MAST shows is critical (Slack threads are less structured). Do not use Slack as the agent message bus.
- **Human monitoring/control: Slack is worth it.** A Slack surface gives the SRO a persistent, mobile-friendly window to watch the team, receive escalations, approve plans, and issue direction without living in the terminal — which is exactly the SRO model's three gates. Claude Code's Slack integration and Claude-in-Slack support this (post status/escalations to Slack, accept instructions from Slack). The industry trend (Devin, Codex, Copilot) is chat-as-coordination-layer where the human steps in to review/validate.
- **Contrarian caution (Cognition, _Don't Build Multi-Agents_):** parallel agents making independent decisions on the _same_ problem produce conflicting outputs. Lesson: keep one decision-owner per scope (our single write path + clear boundaries), and use sequential evaluator-optimizer for review rather than two agents independently deciding the same thing.

**Recommendation:** agents coordinate via **native Agent Teams**; the SRO observes and steers via **Slack** (the human observability/control plane, not the agent bus). Add Slack from Tranche 1, once there is a running pair to monitor.

## 5. What this changes in our approach

1. Add **output-format** and **termination-condition** fields to every role contract in `AGENT-ECOSYSTEM.md`.
2. Treat the **README atomisation + BA agent** as a _safety mitigation_ (the #1 failure category), not just a feature — reinforcing BA early (Tranche 2) and atomisation as load-bearing.
3. Keep verification **multi-level and independent** (reviewer + automated PR review + SRO); never collapse to a single final check.
4. **Defer duplicate roles** (Business Change) — confirmed by the duplicate-role failure mode.
5. **Observability from day one:** Slack as the SRO plane; build in tracing/monitoring of agent interactions early, and **monitor token cost** (multi-agent is ~15× single-session).

---

## Sources

- Anthropic — _Building Effective Agents_ (five patterns; evaluator-optimizer; orchestrator-workers; guardrails, sandboxing).
- Anthropic — _How we built our multi-agent research system_ (orchestrator-worker; role-definition requirements; ~15× tokens; isolation boundary).
- MAST — _Why Do Multi-Agent LLM Systems Fail?_ (Cemri et al., NeurIPS 2025) (14 failure modes; spec/coordination/verification; multi-level verification).
- Cognition — _Don't Build Multi-Agents_ (caution on fragmented parallel decisions).
- Claude Code Agent Teams (native shared task list, mailbox, teammate lifecycle) and Claude Code/Claude Slack integrations (human coordination, monitoring, async triggers).
