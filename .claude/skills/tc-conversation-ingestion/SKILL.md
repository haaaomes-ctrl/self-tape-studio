---
name: tc-conversation-ingestion
description: Distil a Claude, ChatGPT, Claude Code, or Codex conversation (pasted, exported, or referenced) into structured TapeCoach corpus notes under knowledge/, so reasoning and decisions are captured before they are lost. Use this whenever the user pastes a conversation, points at a chat export, says they want to capture/save/ingest a thread, or runs the end-of-session capture ritual. Prefer this over free-form note-taking; do not dump raw transcripts as notes.
---

# Ingest a conversation into the corpus

Turn sessions into durable, retrievable knowledge without flooding the vault. Apply the `tc-vault-note` schema for every note.

## Two rules that never bend

1. **Authority:** corpus notes never override the spine (README wins).
2. **Write-boundary:** create/modify files **under `knowledge/` only**. Spine-affecting items become a `decided` note + proposal, never a spine edit.

## Steps

1. **Read & classify** the distinct items worth keeping: decision / requirement / research / product-idea / open-question. Discard pleasantries, dead-ends, and anything already captured.
2. **Route by tier:** spine-affecting-and-decided → `decided` note + proposal (flag to operator); research/reasoning → `current` or `exploratory`; proposal → `exploratory` in `40-product-ideas/`; contradicts the spine → `exploratory` + flag as drift.
3. **Write notes** in the right folder with full front-matter (set `discipline`/`monday_ref` where relevant; lineage if superseding).
4. **Archive the raw thread** verbatim to `90-archive/` if it should be kept — not as a note.
5. **Report.**

## Link wiring (every ingested note feeds BOTH indexes)

Apply the `tc-vault-note` **Link wiring** rules and pre-save checklist to every note you create here — they are what make a note retrievable through both the `tc-knowledge-index` script and Obsidian's graph:

1. **Spine connections in the `spine_anchor` frontmatter array** (`"ADR-XXXX"`, `"<FILE> §<section name>"`). When ingestion yields a `decided` note, its `decided_ref` is the spine clause it ratifies; mirror that clause in `spine_anchor` too so the index resolves it. Deliberate orphans (`spine_anchor: []`) are fine for standalone research.
2. **Note→note connections as body `[[note-id]]`** — ingestion usually produces a cluster (a decision + its open question + a research note); wire that cluster together with `[[...]]` links and a `## Links` section so the graph reflects the thread, not just isolated notes.
3. **ADR/README/AGENTS in the body as PLAIN TEXT, never `[[...]]`** — they live outside the vault and a wikilink dangles. Anchor them in frontmatter; mention them by name in prose.

Apply `tc-vault-note`'s **auto-derive before saving** rule too — deterministically scan each body and back-fill `spine_anchor` (every `ADR-NNNN` / `<FILE> §section`) and `## Links` (every inline `[[note-id]]`) so the cluster is born fully wired. Run the pre-save checklist from `tc-vault-note` before proposing the notes for review.

## Open-question tagging convention

When a note you create still carries unresolved questions (i.e. it has content under `## Open questions`), add the tag `open-question` to its front-matter `tags`. This is how open questions surface in the dashboards — the "Open questions" view filters on `tags contains open-question` (Bases filters on properties, not body text, so the tag is what makes them findable). When a question is later resolved (in a future capture or note update), **remove the `open-question` tag** so the view stays a live list of what's genuinely still open.

## Selective but fully-formed (the approval cycle)

Be **selective** about _which_ notes to create (a few sharp ones from a long thread, not fifteen), but generate each selected note **in full** — complete reasoning, well-structured body — so the operator's approve/commit cycle is easy: they review a finished artifact, edit if needed, and approve, rather than fleshing out a stub. Nothing is lost because the raw transcript is archived.

## Always propose → review → approve → commit

Never write silently. Present the proposed notes for the operator to review, edit and approve; this review step is their debrief and oversight.

## The end-of-session ritual and the briefing

At session/day end, run this skill over the session: propose the notes, and also produce a short **on-screen briefing** (decisions / open questions / handed-off / completed). The briefing is **shown, not committed** — it summarises notes that already exist, so it is not written as a corpus note. After approval, recommend rerunning `tc-knowledge-index` (and `tc-delta-register` if targets/current state changed).

## Example

A thread agreeing Professional 90+ scores should be rare → one `decided` note (`decided_ref: "README §Calibration doctrine"`), fully written with the reasoning; flag to the operator that the README wording change is a proposal for a PR; one open question extracted; raw thread archived. A good run yields two or three sharp, complete notes.
