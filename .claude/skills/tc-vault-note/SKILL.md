---
name: tc-vault-note
description: The canonical schema, front-matter and status lifecycle for any note in the TapeCoach knowledge corpus (the knowledge/ vault). Use this whenever you create, write, update, or restructure a note under knowledge/ — including capturing research, recording the reasoning behind a decision, or marking a note as superseded or decided. Always use this skill before writing any knowledge/ note so the metadata stays consistent across every tool; do not invent your own front-matter fields or status values.
---

# TapeCoach Corpus Note Schema

Every note in `knowledge/` is part of the **corpus tier** — the unbounded knowledge layer recording the _why_, research and history behind the controlling spine (`README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/architecture/`, `docs/tapecoach/s10-*`).

## Two rules that never bend

1. **Authority:** a corpus note never overrides a controlling fact in the spine. On conflict, README wins.
2. **Write-boundary:** only create/modify files **under `knowledge/`**. Never edit the spine or code. If a note should change the spine, write it `decided` with a `decided_ref` and describe the proposed change for a reviewed PR.

## Required front-matter

```yaml
---
id: <stable-unique-slug> # e.g. discipline-rubric-singing-v2. Never reuse or rename.
title: <human-readable title>
tier: corpus
status: exploratory # exploratory | current | superseded | decided
spine_anchor: [] # tolerant labels by section NAME — see below
decided_ref: null # set ONLY when status: decided
supersedes: []
superseded_by: null
supersession_reason: null
source: <origin> # claude-code | claude-project | chatgpt | codex | github-pr | monday | research | meeting | manual
source_ref: <identifier>
discipline: null # null | acting | mt | singing | dance | commercial (or a list)
monday_ref: null # Monday item key/URL, if this relates to tracked work
tags: []
confidence: medium # high | medium | low
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

## Status — the safety mechanism

- **`exploratory`** — idea, research-in-progress, captured thread. Not authoritative; default for most captures.
- **`current`** — best present corpus understanding; authoritative within the corpus, still below the spine.
- **`superseded`** — replaced; set `superseded_by` + `supersession_reason`. Keep as history.
- **`decided`** — ratified into the spine; set `decided_ref`.

## Anchor convention (by name, not number)

`spine_anchor`/`decided_ref` use tolerant labels: `"<FILE> §<section name>"` (e.g. `"AGENTS §Core doctrine"`, `"README §Calibration doctrine"`) or `"ADR-XXXX"`. Use the section **name**, not its number — numbers churn on renumbering. Resolved by substring match by `tc-knowledge-index`; unmatched labels are reported as "unresolved" and fixed on the note, never by editing the spine. Orphan notes (no anchor) are allowed for standalone research.

## Domain fields

`discipline` and `monday_ref` make the corpus queryable along TapeCoach's real axes (the five disciplines; tracked work). Set `discipline` whenever a note is discipline-specific (e.g. a rubric); set `monday_ref` when a note relates to a Monday item.

## Deltas

- **Backward (lineage):** `supersedes` / `superseded_by` / `supersession_reason`.
- **Forward (gap):** computed by `tc-delta-register`, never stored.

## Body (one idea per note)

`## Summary` · `## Context / why` · `## Detail` · `## Open questions` · `## Links`. `[[wikilinks]]` help humans; AI retrieval keys off front-matter and headings, so always set `spine_anchor`/`tags`/`discipline`. **Convention:** if a note has content under `## Open questions`, add the tag `open-question` so it surfaces in the open-questions dashboard view; remove the tag once the questions are resolved.

After writing a note that relates to the spine, recommend rerunning `tc-knowledge-index`.
