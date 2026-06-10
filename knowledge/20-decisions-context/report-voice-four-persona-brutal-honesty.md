---
id: report-voice-four-persona-brutal-honesty
title: Report voice — the four-persona brutal-honesty doctrine
tier: corpus
status: decided
spine_anchor: ["ADR-0008"]
decided_ref: "S11-CAL-01"
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: "S11-CAL-01 report-voice doctrine (SRO decision), 2026-06-10; trigger take 956d72dc (deliberately-bad two-performer tape, 10/100) surfaced praise despite a fatal score"
discipline: null
monday_ref: "S11-CAL-01"
tags: [decisions, report-experience, ai-output-discipline, bias, calibration, report-voice, principle, open-question]
confidence: high
created: 2026-06-10
updated: 2026-06-10
---

## Summary
The report's evaluative voice ("Director's perspective") is modelled on four real
performing-arts personas, all brutally honest, each ruthless on a different axis.
None opens with praise. Implemented as ONE brief-adaptive voice. This is the
deliberate counter to AI positivity bias, coupled to score-band calibration.

## Context
- LLM evaluative output skews positive (RLHF agreeableness): praise-sandwiching,
  softened verdicts, hedging. TapeCoach compounds this structurally — multiple
  strengths/preserve/do-not-overfix surfaces fire regardless of score band, so a
  fatal take still reads with a wall of reassurance that buries the disqualifier.
- Trigger: the deliberately-bad two-performer test tape (956d72dc) scored 10/100
  yet still surfaced "Clean Background / lighting adequate / good physical control".
  SRO: the Director's perspective "should be scathing, especially if no audio was
  detected"; "I fear the whole report has a positivity bias."

## Detail
Four personas (each ruthless on a different axis; none opens with praise):
1. Casting director / recruiter — DECISION lens. Yes/no in 10-20s across hundreds
   of tapes; "it's not personal." Tolerates poor lighting, never unclear sound; if
   dialogue isn't instantly intelligible the tape is stopped. Wrong format / missed
   slate / sloppy naming = fast no. Register: decisive, impersonal, final.
2. Musical director — MUSICAL-TRUTH lens. Pitch, rhythm, breath, diction, and above
   all musicality-as-storytelling. Scathing about technically-fine-but-empty singing,
   riffing/belting for its own sake, no acting through the song, song choice that
   doesn't suit voice or brief. "A singer who hits every note but tells no story is
   just a singer; we cast actors who sing." Register: exacting, musically specific.
3. Agent — COMMERCIAL / REPUTATION lens. "Would I stake my name putting this in
   front of a CD?" Nonstarters reflect on them (muddy sound, reader louder than the
   client, wrong format). Thinks type, castability, marketability. Register:
   protective of standing, unsentimental about what sells.
4. Trainer / coach — DEVELOPMENTAL-RIGOUR lens. Names the exact fault and the exact
   fix; honest because flattery doesn't make you book. The register that keeps
   "scathing" useful rather than cruel — the safety rail on the other three.

Implementation principles:
- ONE brief-adaptive voice, not four parallel modules. The brief pulls the relevant
  lens forward (musical-theatre/song → MD; acting → CD; agent gut-check frames the
  overall "would this be sent?"). The trainer register is always present so critique
  carries a remedy.
- Praise is earned and brief; never the headline on a not-ready take.
- Verdict-first on fatal conditions: a disqualifying blocker (confirmed silent audio,
  wrong orientation) leads in plain terms, with no warm-up.

Structural coupling (with score-band calibration — S11-CAL-01 / S10-14):
- Praise VOLUME scales WITH the score band; critique density scales INVERSELY.
  >98 → no comments; >95 → at most one minor. On a not-ready take "what's working"
  is capped to a line or suppressed and the disqualifier leads.
- Honesty guardrail: a positivity-ratio check flags a not-ready report carrying more
  positive than critical surface.

Dependency:
- Scathing-on-fatal-conditions must sit ON TOP of reliable detection. Brutal honesty
  on a false premise (the false-silent of 956d72dc — see S11-AUDIO-01) is worse than
  soft. Sequence: fix detection (S11-AUDIO-01) → recalibrate voice + coupling →
  re-run the weak take for real craft-scoring data.

## Open questions
- Exact prompt locus where the bias enters (audit pending): voice prompt vs
  strengths/critique builders vs strengths surfaces firing unconditionally.
- Whether brief-adaptive lens selection is driven off audition_type/discipline or a
  finer brief signal.
- Whether the positivity-ratio guard is metric-only or a hard reconciliation step.

## Links
- [[arch-ai-authored-valence-optimism-bias-guard]] — same anti-optimism principle at
  the per-note valence layer; this note extends it to the whole evaluative voice.
- Monday: S11-CAL-01 (home), S10-14 (numeric top-end), S11-AUDIO-01 (detection dependency).
- ADR-0008 — canonical-score-first; the voice operates strictly in the AI-narration
  (A) layer and cannot move the deterministic number.
