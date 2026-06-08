---
id: session-capture-rubric-research-import-2026-06-08
title: Session capture — Discipline Rubric Research imported as a corpus thread (2026-06-08)
tier: corpus
status: current
spine_anchor: ["ADR-0007"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: "PR #238 (haaaomes-ctrl/self-tape-studio); session 2026-06-08"
discipline: null
monday_ref: null
tags: [discipline-rubric-research, session-capture, corpus-import, decisions]
confidence: high
created: 2026-06-08
imported: 2026-06-08
updated: 2026-06-08
---

# Session capture — Discipline Rubric Research imported as a corpus thread

> Working-session record (Claude Code, 2026-06-08) under the two-tier Knowledge OS (ADR-0007). The research content itself lives in the imported thread [[drr-programme-overview]]; this note records the **decisions and outcome** of the import session so they are not lost.

## Summary

The `Research/Rubric Research Each Discipline` folder (73 files, ~29 MB, five discipline pipelines) was imported into the corpus as the **`discipline-rubric-research`** thread: 1 programme overview + 5 discipline overviews + 68 stage step-notes + 1 open-question gap note = **75 notes**. Delivered as PR #238 and squash-merged to `main` on 2026-06-08.

## Decisions taken

- **Structure — five threads + a programme overview** (not one linear thread): MT → Dance → Acting → Voice → Commercial, each a builds-on chain of its pipeline stages (S0 → B1–B4 → synthesis → audit → revision → final audit → output-spec → QA → maturity → lessons → handoff). Root: [[drr-programme-overview]].
- **Ordering by filename stage/batch convention, not filesystem dates.** No reliable creation date existed in any filename or content (the only date string was an example inside a cited audition listing); birthtimes were treated as unreliable and used only to set `created`. The filename convention + folder order were the ordering signal.
- **Conservative supersession** — only genuine redrafts marked superseded (MT S0 → S0-repair; MT B2 draft → final). Everything else is a `current` builds-on chain.
- **Voice filed under `discipline: commercial`** + a `voice` sub-area tag as an **operator taxonomy decision** — the research itself frames Voice as the sung/singing voice (Song/MT) with only a label-boundary to Commercial ("commercial" must never mean marketability). Left for expert ratification, not snap-decided: [[drr-voice-commercial-ratification-gap]].
- **Commercial late-stage order corrected to content-logical** (Final-Audit → Output-Spec): the Output-Spec consumes the Final-Audit (cites D01/D02), so the content dependency overrode the misleading file timestamps.
- **Provenance kept out of git** — the 5 Merged consolidations + raw RTF originals (~27.4 MB) were archived to `knowledge/90-archive/` then `git rm --cached` + gitignored, so they stay local provenance without bloating the repo; the canonical source remains the research folder and the verbatim step notes. The thread + archive were added to `.prettierignore` so `npm run format` cannot reformat the verbatim research/RTF.
- **RTF → markdown on import** — 35 source files were RTF-wrapped despite the `.md` extension; converted with `textutil` on import, raw RTF archived.

## Substantive findings surfaced (carried in the thread, not the live rubric)

- The shared **`vocal` score field is overloaded** across singing / speech-delivery / dance-technique — the programme's central architectural finding, mitigated only at the rule/wording layer in every discipline (the schema/field was never changed).
- The per-discipline rubrics are **research-grade but not live-validated**: QA was synthetic/adversarial only (no live discipline-specific outputs existed), so production sign-off is gated on live-output QA. See [[drr-mt-overview]] and [[drr-commercial-overview]].

## Links

- Thread root: [[drr-programme-overview]]
- Open question: [[drr-voice-commercial-ratification-gap]]
- Discipline overviews: [[drr-mt-overview]] · [[drr-dance-overview]] · [[drr-acting-overview]] · [[drr-voice-overview]] · [[drr-commercial-overview]]
