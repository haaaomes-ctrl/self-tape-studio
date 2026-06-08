---
id: slack-control-plane-free-workspace-2026-06-08
title: Slack control plane runs on a free Slack workspace
tier: corpus
status: decided
spine_anchor: ["CLAUDE §Knowledge corpus"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "Session 2026-06-08, KOS-06 Slack control-plane scoping"
discipline: null
monday_ref: "KOS-06"
tags: [decisions, slack, control-plane, observability, agents, meta]
confidence: high
created: 2026-06-08
updated: 2026-06-08
---

## Summary

The E3 Slack layer — Slack as an **observability / approval control plane only** (monitor and
approve; agents coordinate in Code) — will run on a **free Slack workspace** plus a Claude Code
**Notification hook → incoming webhook**. **No paid Slack plan is needed.**

## Context / why

Slack here is a control plane, not a coordination surface. What that actually requires —
posting messages into a channel — is **not plan-gated**: incoming webhooks / bot posting work
on free Slack (rate ~1 message/second/channel, ample for notifications and approvals).

The paid tiers are only needed for things this layer does **not** use:

- The official **Claude-for-Slack app** needs a **paid Slack** plan, and
  **@Claude → Code** routing additionally needs **Team/Enterprise** — neither is required for a
  monitor-and-approve control plane.
- Free-tier limits **don't bite**: the **10-app cap** is fine (one app slot for the webhook),
  and the **90-day history** limit is irrelevant because **the vault is the archive**, not
  Slack.

Web-verified 2026-06-08.

## Detail

- Realistic solo path: Claude Code **Notification hook → Slack incoming webhook** → channel.
  Approvals come back through the operator, not through Slack-routed agent control.
- This keeps E3 cost-free and aligns with the principle that agents coordinate **in Code**;
  Slack is purely where the SRO observes and approves.

## Open questions

None for the free-tier control-plane scope. If @Claude → Code routing is ever wanted, that is a
separate, plan-gated decision (Team/Enterprise), out of scope here.

## Links

- [[knowledge-os-decisions-2026-06]] — the prior Knowledge OS decisions (Slack-as-observability).
- [[engineer-pair-subagents-reviewer-keeps-bash-2026-06-08]] — the Tranche-1 pair this control
  plane observes.
- Monday: KOS-06.
