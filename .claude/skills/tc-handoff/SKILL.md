---
name: tc-handoff
description: Standardise the handoff of work between a chat surface and Claude Code by writing and updating a work-order note under knowledge/05-handoffs/, so the operator stops copy-pasting plans and results between tools. Use this whenever a task/plan is handed to Claude Code for implementation, when recording the results of a Code session back for the chat to read, or when the user asks to "hand this to Code", "pick up the handoff", or check what work is queued. Prefer this over pasting raw prompts between surfaces.
---

# Handoff between chat and Claude Code

Removes the manual relay: the plan and its results live as a note in the corpus that both surfaces read.

## Write-boundary

Writes only under `knowledge/05-handoffs/`. Implementation is done by Claude Code through the normal branch + PR flow (the PR cycle), never by editing the spine/code from outside it.

## The work-order note

One note per task, `knowledge/05-handoffs/<YYYY-MM-DD>-<slug>.md`:

```yaml
---
id: handoff-<slug>
title: <task title>
tier: corpus
type: handoff
status: requested        # requested | in_progress | done | blocked
target: claude-code
source: claude-project
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
pr: null                 # set by Code when the PR opens
spine_anchor: []
monday_ref: null
tags: []
---

## Plan
The approved plan (not just a task) — enough for Code to act without the chat present.

## Context
Pointers into the corpus/spine Code should read first (note ids, README sections, ADRs).

## Acceptance
Concrete, checkable conditions. Implementation completion is NOT acceptance.

## Constraints
What Code must not do (no spine edits; files off-limits).

## Results (filled in by Claude Code)
- Branch / PR:
- What changed:
- Deviations / decisions made:
- Follow-ups / new open questions:
```

## Approval is at the backlog level (SRO gate 1)

The operator approves the **day/week PR backlog** (gate 1). Handoffs that are part of that approved backlog are picked up by the engineer pair **without per-item sign-off**; only ADR-class decisions or `blocked` items escalate to the operator. Do not wait for per-handoff approval on work already in the approved backlog.

## Two directions

**Chat → Code:** write the work-order with `status: requested` and a complete Plan/Context/Acceptance; tell the operator it is queued at the path. In Code, "pick up the open handoff" reads the oldest `requested` note (and its Context), works on a branch, fills **Results**, sets `pr` and `status`, opens the PR.

**Code → chat:** set `in_progress` at start, `done` at end (or `blocked` with reason). The chat reads results via the GitHub connector — no paste-back.

## Report

State the path and status; on completion, summarise the change and PR, and recommend an end-of-session capture if decisions/open questions resulted.
