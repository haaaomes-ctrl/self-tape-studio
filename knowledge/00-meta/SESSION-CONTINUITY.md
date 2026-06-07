# Session continuity & the repo-review bridge

**Status:** current operating doctrine for cross-surface session continuity (capture-out / brief-in).
**Version:** 1.0.
**Language:** UK English.
**Scope:** the knowledge layer only. Does not override `README.md`. On conflict, the spine wins.

---

## Why this exists

We pair two surfaces: **Claude Code** as implementer (full, live read/write of the repo
and vault) and **claude.ai chat** as reviewer/strategist (thinking and decision review).
Two facts shape how they work together:

- claude.ai cannot read the live repo. It only ever sees a bounded snapshot (see the
  surface map below), so it can't review or continue from the vault directly.
- Conversations are finite. A long chat fills up, and its working context is lost unless
  it is made durable.

The vault solves both — but only with a disciplined way to move state between the vault
and a chat that cannot read it. That movement is what this document defines.

## The principle

The **vault (in the repo) is the durable memory; Code is the bridge.** Chat never reads
the repo directly. Instead Code — which can — writes session state _into_ the vault and
projects state _out_ of it as a bounded briefing chat can consume. The repo stays
canonical; chat always works from a faithful, current projection of it, never from its
own fading recollection.

The key consequence: the vault is the **integrity checkpoint** between sessions. A new
chat is primed from Code's vault-sourced briefing — i.e. from reviewed, committed state —
not from the previous chat's raw summary. Anything that matters has to land in the vault
to survive, which is the behaviour we want.

## Surfaces and capabilities

| Surface                             | Reads the vault                                                                                                                                                                | Writes the vault                                        | Runs the skills                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------- |
| **Claude Code** (CLI / Desktop app) | Full, live — filesystem + git                                                                                                                                                  | Yes — via branch + PR                                   | Yes — they are repo-resident              |
| **claude.ai** (web / app)           | Bounded snapshot only — the GitHub connector loads files into a Project's knowledge (subject to the knowledge limit, with retrieval degrading past it); not live, not complete | No — can draft content, cannot file it                  | No                                        |
| **Cowork / desktop + Obsidian MCP** | Live, via the Obsidian Local REST API (localhost)                                                                                                                              | Yes — through the MCP, within the `knowledge/` boundary | Only if it has repo access                |
| **Obsidian** (the app)              | It _is_ the vault view                                                                                                                                                         | Yes — manual editing                                    | n/a (operator cockpit, not an AI surface) |

claude.ai web cannot reach a localhost server, so the Obsidian MCP does not extend its
reach — its vault access is the bounded snapshot, by any route.

## The session-bridge loop

The round-trip, in the order it runs:

1. **Chat produces a session summary.** At the end of a working chat, ask it to summarise
   the session's decisions, rationale, and open threads — structured for capture, not
   prose for a human.
2. **Code writes it into the vault.** Hand that summary to Code, which runs
   `tc-conversation-ingestion` to turn it into schema-conformant notes (decisions,
   handoffs, open-question tags), commits on a branch, and opens a PR for review. This is
   the durability + integrity step.
3. **Code projects a briefing out of the vault.** Once captured (and reviewed), Code
   generates a self-contained, reviewer-shaped briefing _from the vault_ — bounded to fit
   a fresh chat, not a repo dump.
4. **The briefing seeds a new chat.** Paste it into a fresh conversation; the
   review/analysis continues from where the last one left off.
5. **The loop closes.** The new chat's decisions are captured back via Code (step 2
   again), so the next briefing reflects them and nothing drifts.

Steps 1–2 are **capture-out** (debrief a session into the vault). Step 3 is **brief-in**
(prime a session from the vault). They are complementary halves of the same loop; the
capture-out half was built first (the ingestion skill), and this document makes brief-in
equally first-class.

## How this overcomes the repo-review limitation

Chat's inability to read the repo is bypassed rather than fixed: it does not _need_ to
read the repo, because Code produces exactly the slice it needs, sized to fit. The
limitation becomes a discipline — everything load-bearing must pass through the vault —
which is the same discipline that makes the knowledge durable. The constraint and the
design pull in the same direction.

## What a good briefing contains

A brief-in projection is:

- **Bounded** — a couple of pages, sized to fit a fresh chat; never the whole corpus (a
  full dump recreates the overflow it is meant to avoid).
- **Reviewer-shaped** — state + the criteria/intent to judge against + open questions +
  the specific next decision, not just a narrative.
- **Self-contained** — everything needed is _in_ the text; no "see DESIGN.md" references,
  because the receiving chat cannot open them.

## Limitations & where this is heading

- The briefing is a **snapshot.** Mid-session, chat cannot pull more from the repo without
  a relay (ask Code for the specific piece and paste it). A well-built briefing front-loads
  enough to keep that rare.
- Chat-as-reviewer reviews from what it is handed; **Code — or a reviewer subagent running
  inside Code — reads the repo live** and sees more. So this loop is the **manual interim**
  for code-level review. Once the Tranche-1 engineer pair exists, live code review moves
  into Code, and chat is freed for the strategic/SRO review it does well from a briefing.
  The loop remains the mechanism for that strategic continuity.

## Reusable prompts

**Capture-out — ask the ending chat:**

> Summarise this session for vault capture: the decisions made and their rationale, any
> open questions or unresolved threads, and the current state of the work in progress.
> Structure it for ingestion into the corpus, not as prose for a human — flag what is a
> decision, what is an open question, and what is a handoff.

**Capture-out — then tell Code:**

> Here is a session summary to capture. Run tc-conversation-ingestion: file it as
> schema-conformant notes (decisions to 20-decisions-context, handoffs to 05-handoffs, tag
> anything unresolved open-question), respect the knowledge/-only boundary, verify any ADR
> references against docs/architecture/adr/, commit on a branch, and PR-and-hold. Rerun
> tc-knowledge-index after so the new notes' anchors resolve.

**Brief-in — tell Code:**

> I'm continuing our review in a fresh claude.ai chat that cannot read the repo. Produce a
> self-contained context briefing I can paste in to bring it up to speed as my reviewer.
> Draw from the corpus (the latest decision, open-question, and handoff notes) plus the
> current repo/PR state, and include: where we are now; the decisions and acceptance
> criteria the work should be reviewed against; the open questions and what is being
> decided; the specific point the reviewer should weigh in on next; and any DESIGN/ADR
> context needed to review competently — summarised inline, not just referenced. Keep it
> tight and self-contained (a couple of pages, not the whole repo). Output as text for me
> to copy — do not commit it.
