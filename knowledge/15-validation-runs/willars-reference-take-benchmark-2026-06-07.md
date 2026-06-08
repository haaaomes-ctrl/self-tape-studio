---
id: willars-reference-take-benchmark-2026-06-07
title: Willars reference take — canonical positive validation benchmark (high score / no cap / advance)
tier: corpus
status: current
spine_anchor:
  ["AGENTS §Score terminology alignment", "README §Performer Level Calibration Architecture"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-project
source_ref: willars-reference-take-benchmark-2026-06-07
discipline: musical_theatre
monday_ref: "2967682223"
tags: [validation, benchmark, reference-take, score-model, ground-truth, positive-case]
confidence: high
created: 2026-06-07
updated: 2026-06-07
---

## Purpose

The canonical POSITIVE end-to-end validation case — the real-world inverse of the
`s10-canary-a-incomplete-package` fixture. Tape: `Willars__Hannah.mp4`; brief: `Hannah_brief.docx`;
role: Young Tam, _Don't Forget_ (new musical development workshop), Jim Arnold Casting. Three
independent assessment methods converge on "high / no cap / advance". The benchmark has three
explicitly separated layers: (A) objective measured layer (reproducible signal facts), (B) human
craft ground truth (Om), (C) expected live-system output under R=D (ADR-0008). When the live app
scores this tape, check its output against all three. See the companion run note
[[gemini-flash-lite-assessment-learnings-2026-06-07]] for the live-model behaviour, including a
first-pass truncation failure.

## Tape structure (measured — corrects the first-pass guess)

Measured from audio energy/tonality + frame sampling: SONG first (~0:08–2:13; sustained, tonal,
projected) then ACTING SIDE second (~2:20–4:06), ending on the scripted final beat "Wait — quick
swig." (performer raises a bottle prop on the closing line). 1280×720 landscape; 246 s; single file.

## A. Objective measured layer (reproducible; environment-verified)

Container/technical: 1280×720 H.264 landscape; 246.4 s; AAC stereo 32 kHz; integrated loudness
−18.8 LUFS, range 16.2 LU (healthy/present/dynamic — NO low-audio cap applies); consistent
head-and-shoulders framing; even lighting, plain backdrop; single file that COMPLETES on a scripted
prop beat (no truncation — the opposite of the canary).

Singing — measured (librosa pYIN, song 0:08–2:13): 82% voiced over 125 s; vocal range C3–C♯5
(~25 semitones, ~2 octaves), median ~E4; intonation median 21¢ / mean 24¢ / 90th-pct 41¢ off nearest
semitone — IN TUNE (well-centred ~15–30¢; gross faults push median >45–50¢); 49 sustained notes
(longest 3.5 s = real breath support); 42 dB dynamic range (phrasing, not a flat belt). Measured
verdict: in tune, supported, dynamically phrased, ~2-octave range. Directly satisfies the brief's
"show your range".

Acting side — measured + observed (scene 2:20–4:06): ~340 vocal onsets over 106 s (active, varied
delivery — not monotone); 70 dB dynamic range (vocal variety); dense frames show full animated
expression, gesture, and character-driven prop work (the bottle) — committed, comically alive,
matches the role's "easy-going warmth and wit". (Fine beat-by-beat craft = continuous-viewing
judgement; see Limits.)

## B. Human craft ground truth (Om — reviewer)

High-quality professional take; 100% brief-compliant; 100% brief-adherent; 100% material-compliant;
should score high (vocal/acting/audio); a score <50 would be indefensible. This is the authoritative
qualitative benchmark; the measured layer corroborates every measurable component and nothing
measured contradicts it.

## C. Expected live-system output (the R=D contract test)

Under ADR-0008 (canonical score = deterministic D; every surface derives from it), a correct live run
must: produce a HIGH overall (≥50 is the floor; a defensible result sits well above it — a sub-50
here indicates a model/scoring defect, not the take); render NO cap (no blocker, no missing mandatory
material, no truncation, no low-audio); show material compliance = full and brief adherence = full; be
CONSISTENT across surfaces (report-detail headline = list/dashboard/ranking value for this take); and
return high vocal and audio sub-scores (measured basis above).

Brief compliance matrix (expected): Side 1 present ✅ (scene completes on "quick swig"); contemporary
legit MT song ✅ present (identity/legit-category = human-judged); Side 1 + song only ✅; landscape ✅;
head-and-shoulders ✅; one continuous file ✅; own accent ✅ (identity = human-judged); naming
LASTNAME_FIRSTNAME ✅ (Willars\_\_Hannah.mp4).

## Triangulation result (the headline)

Three independent methods agree post-correction: Om (high/advance, <50 indefensible) · measured layer
(high; no cap supportable; in-tune ~2-octave vocal; clean dynamic audio) · Gemini 3.1-flash-lite 2nd
pass (overall 90; acting 85; vocal 80; audio 90; brief 100; advance). Gemini independently observed
the bottle prop and "character-driven focus" and praised breath support/phrasing — corroborating the
measured layer. (Gemini's FIRST pass scored 35/"do not advance" on a truncation error — see the
companion run note.)

## Limits (what is NOT machine-verified here)

Spoken-line fidelity to the printed Side 1 — NOT verified (speech-to-text unavailable in-environment;
all model-weight hosts and inference APIs blocked, HTTP 403; only pypi/github code endpoints reachable;
no transcript could be produced — human-judged item, not a defect). Song identity / "contemporary
legit" classification — human-judged. Beat-by-beat acting craft / comic timing — approximated by
frames + audio dynamics, not continuous audio-visual viewing — human (or live multimodal model)
judgement. The production app uses a multimodal model (Gemini) that watches footage with sound, so the
measured layer (A) is best used as an objective anchor UNDER the live model's judgement and Om's craft
verdict — three independent reference points for the same take.

Measurement provenance: ffprobe (container/orientation/duration); ffmpeg EBU R128 (loudness); librosa
0.11.0 pYIN (pitch/intonation/range), RMS/spectral-flatness (structure/dynamics/phrasing), onset
detection (delivery); frame sampling across full runtime. Reproducible from Willars\_\_Hannah.mp4.

## Links

- [[gemini-flash-lite-assessment-learnings-2026-06-07]] — the live-model run + first-pass truncation finding.
- Pairs with code fixtures: src/test-fixtures/s10-strong-complete-professional.ts (positive sibling) and
  src/test-fixtures/s10-canary-a-incomplete-package.ts (the harsh inverse).
- ADR-0008 (canonical-score R=D) — the contract this benchmark tests.
- Monday: Δ6 2967682223.
