---
id: gemini-flash-lite-assessment-learnings-2026-06-07
title: Gemini flash-lite assessment run — first-pass truncation failure and lessons (Willars reference take)
tier: corpus
status: current
spine_anchor: ["AGENTS §Score terminology alignment"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: gemini-flash-lite-assessment-learnings-2026-06-07
discipline: null
monday_ref: "2967682223"
tags:
  [validation, research, gemini, model-selection, prompt-engineering, ai-catalogue, rubric, lessons]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## What happened

The Willars reference take ([[willars-reference-take-benchmark-2026-06-07]]) was run through Gemini
3.1-flash-lite in the web interface (the closest available match to the production model, **Gemini
2.5-flash-lite**), with the tape and brief supplied directly and a structured assessment prompt.

- **First pass:** the model watched only the FIRST segment, declared the acting Side 1 "completely
  absent", scored Acting 0 / material compliance 20 / **OVERALL 35**, verdict **"Do not advance"** —
  on a tape that is 100% compliant. It also misidentified the structure.
- **Corrective prompt** ("the acting scene was provided; did you watch the full video?"): the model
  re-watched, confirmed the scene IS present, and scored Acting 85 / Vocal 80 / Audio 90 / Technical
  95 / brief 100 / **OVERALL 90**, verdict **"Advance"** — which matches Om's verdict and the measured
  layer.
- On being asked why it missed it first time, the model admitted it "relied on an incomplete initial
  scanning process rather than performing a comprehensive review of the entire video file."

  3.1-Pro was tried and was UNABLE to analyse audio+video together ("limitations"). Production runs
  2.5-flash-lite (older/lighter than the 3.1-flash-lite tested).

## Why this matters (the critical finding)

This is the `s10-canary-a-incomplete-package` failure mode happening LIVE on a real strong tape: a
fabricated missing-material verdict driven by not ingesting the full media. Key consequences:

1. **It is an UPSTREAM defect distinct from Δ6.** Δ6 fixes scoring/render correctness (R=D). This is a
   perception defect — the model not watching the whole tape before judging. The honest 35 was
   internally consistent; it correctly scored what it wrongly perceived. R=D cannot help if the
   deterministic inputs are built on a half-watched tape.
2. **Production gets ONE shot.** The corrective second pass is a chat-interface luxury; the pipeline
   runs once. A real performer would have received the 35 and "do not advance" on a fully compliant
   tape.
3. **The production model is older/lighter than the one that failed.** If 3.1-flash-lite truncated a
   4-minute tape, 2.5-flash-lite is at least as likely to — and tape length makes it worse (the 35→90
   swing on a 4-min tape; a 10-min tape is higher risk).
4. **Both the failure AND the recovery corroborate TapeCoach's thesis** — AI audition assessment is
   unreliable in specific, correctable ways. This run is direct evidence of the problem the product
   exists to prevent.

## Lessons / opportunities

- **Forced full-duration ingestion protocol (highest leverage):** prompts must state the tape's exact
  duration, require the model to enumerate every segment with start/end timestamps covering the WHOLE
  runtime, and refuse a verdict until the timeline accounts for the full length. The model's own
  second-pass "updated protocol" (scrub the entire duration; map each segment to the brief;
  self-correct on discrepancy) is essentially the spec — bake it into the prompt.
- **Material-absence requires positive confirmation:** the rubric must forbid scoring material as
  "missing" without confirming the full file was scrubbed (a false "missing" caused a 55-point swing).
- **Chain-of-thought before verdict** and a **completeness gate** ("if any required element appears
  absent, re-scan the full file before concluding absence").
- **Model selection is an open empirical question:** is 2.5-flash-lite fit for purpose? Map a model
  capability/modality matrix (which models do full audio+video, at what tape length, at what cost —
  noting 3.1-Pro could NOT do AV here). Lite tiers are throughput-optimised and demonstrably miss
  whole segments on nuanced long media.
- **AI Prompt Catalogue is the home for the fix:** the full-ingestion protocol belongs IN the AI
  Prompt Catalogue (the decided single source of truth across model calls) so every call inherits it.
- **Tape-length robustness:** longer tapes raise truncation risk; the pipeline must be duration-aware
  (and a 10-minute tape is a known upcoming case).

## Recommended response

A dedicated **AI assessment reliability workstream** (distinct from Δ6): full-media ingestion
protocol, model capability/modality matrix incl. fitness of 2.5-flash-lite, prompt + AI-Prompt-
Catalogue + rubric hardening, and tape-length robustness — justified by this run. Tracked on Monday
as a backlog item referencing this note.

## Links

- [[willars-reference-take-benchmark-2026-06-07]] — the reference take and its three-layer benchmark.
- ADR-0008 — the (separate) scoring/render contract; this is an upstream extraction-quality concern.
- Monday: Δ6 2967682223; AI-reliability workstream backlog item (to be created).
