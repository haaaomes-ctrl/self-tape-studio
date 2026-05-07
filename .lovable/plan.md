# TapeCoach Report Pipeline — Current State (read-only audit)

This is an information-only deliverable. No code changes. Everything below cites the live files in the project so you can jump straight to source. Where prompts/schemas are long, the canonical source is named with line ranges and the operative wording is quoted verbatim.

---

## 1. Step 1 — Evidence prompt + tool schema

File: `src/server/evidence-pass.server.ts`
- Default model: `process.env.EVIDENCE_PASS_MODEL ?? "google/gemini-3-flash-preview"` (line 15-16).
- Call: `temperature: 0`, `top_p: 1`, `max_tokens: 6144`, multimodal (`type: "file_url"` for the tape), `tool_choice` pinned to `collect_audition_evidence` (lines 444-464).
- Tool name: `collect_audition_evidence` (line 21). Returned object is typed as `EvidencePass` (lines 309-373).

Schema (verbatim summary of `EVIDENCE_TOOL.parameters.properties`, lines 18-269):
- `evidence_version` (enum `"1"`)
- `audition_type` (enum: acting_scene, monologue, song, musical_theatre, dance, commercial, hybrid, unknown)
- `detected_components[]` `{type, weight, score 0-100, note}`
- `raw_scores` `{technical, audio, vocal|null, acting, brief_adherence, professional_presentation}` — all integers 0–100
- `core_strengths_evidence[≤5] {area≤80, evidence≤240}`
- `core_improvements_evidence[≤5] {area, evidence}`
- `fix_first_evidence` (string ≤240)
- `brief_adherence_evidence` `{material_compliance, technical_compliance, instruction_precision, professionalism_signals, score_material, score_technical, score_instruction, score_professional}`
- `category_notes_evidence` (one ≤240 string per category)
- `role_fit_evidence` (≤240), `role_fit_modifier_suggested` (-10..+5), `role_fit_confidence` (low/medium/high)
- `presentation_evidence[≤6]` (≤200 each)
- `risk_evidence[≤8] {severity low|med|high, flag, why, recall_impact: unlikely_to_affect|may_reduce|likely_to_block}`
- `timestamped_evidence[≤8] {timestamp MM:SS, observation≤220, why_it_matters≤220, linked_category}`
- `evidence_sufficiency` `{audio/video/acting/vocal/movement/brief/role_fit_assessable booleans, notes≤240}`

System prompt (`EVIDENCE_SYSTEM_PROMPT`, lines 271-307): observation-only collector, British English, MM:SS timestamp rules with explicit per-duration targets (e.g. 3–5 min multi-component → minimum 5, must cover beginning/middle/end + each component + transition + ≥1 improvement, hard cap 8). Bans page/line/"side"/"sides"/"book"/"script" references — moments must be timestamps or neutral descriptions. Bans appearance/body/age/race/class/disability/medical-device commentary; only technical outcomes if assessability is affected. Colour mentions only when the colour itself is the observation that matters. Defines `evidence_sufficiency` rules (audio_assessable=false suppresses vocal praise downstream, etc.).

Post-call defensive normalisation (lines 518-600): forces `evidence_version="1"`, validates each timestamp via `isValidTimestamp`, drops invalid timestamps, sorts chronologically, caps at 8, sorts `risk_evidence` by severity, fills missing `evidence_sufficiency`/`brief_adherence_evidence`/`category_notes_evidence` with defaults. Returns `timestamps_dropped` for logging.

`summariseEvidence(ev)` (lines 617-630) is the only thing persisted from Step 1 (folded into `score_breakdown.two_step`): just `timestamped_evidence_count` + the seven `evidence_sufficiency` booleans. Raw observation text is never stored.

---

## 2. Step 2 — Polish prompt + report tool schema

File: `src/server/report-polish.server.ts`
- Default model: `process.env.REPORT_POLISH_MODEL ?? "google/gemini-3-flash-preview"` (line 12-13).
- Call: `temperature: 0.2`, `top_p: 1`, `max_tokens: 8192`, **text-only** (no video), tool pinned to `submit_audition_report` from the existing `REPORT_TOOL` schema (lines 113-134).
- Locked-evidence input is built by `buildEvidenceBlock(ev)` (lines 69-92) — it serialises Step 1 verbatim under `LOCKED EVIDENCE (Step 1 — authoritative, do not contradict)`.

`POLISH_SYSTEM_PROMPT` (lines 15-36, verbatim) — operative rules:
- Use evidence as ground truth; do NOT invent observations.
- Do NOT change scores — orchestrator overwrites them anyway.
- Do NOT add new timestamped_notes / risk_flags / presentation_notes / role_fit claims that aren't in evidence.
- Do NOT introduce visual detail (clothing colour, "your top provides contrast", background colour) unless locked in `presentation_evidence`. Safe alternatives are listed: "the frame is clean and easy to read", etc.
- Prefer timestamps + neutral moment descriptions over page/line/"side" references **even when** the brief literally says "Side 1, pages 85–87". Specific replacements are spelled out (e.g. "the side and the song" → "the acting scene and the song").
- Ban frame-breaking on-camera coaching (stand up, walk, hold instrument/mic/prop, pack a bag) when the brief requires head-and-shoulders / static framing — only allowed if explicitly framed as "rehearsal-only" with a recorded-take alternative.
- British English. No appearance/body/age/race/class/disability/medical-device commentary. Respect `evidence_sufficiency`. `presentation_notes` may be empty. Final caps: strengths ≤3, improvements ≤3, presentation_notes ≤3, timestamped_notes ≤8.

### REPORT_TOOL schema (`src/server/process-take.server.ts`, lines 66-274)

`submit_audition_report` parameters (verbatim names):
- `mode` (brief|baseline)
- `audition_type` (string)
- `detected_components[]` `{type ∈ acting_scene|song|monologue|dance|commercial|slate|other, weight 0-1, score 0-100, note}`
- `consistency_modifier` int -10..+10
- `confidence` 0-100, `confidence_reason`
- `overall_score` 0-100
- `casting_headline` (one plain sentence), `casting_insight` (one-line castability read)
- `scores` `{technical, audio, vocal|null, acting, brief_adherence, professional_presentation}`
- `brief_adherence_breakdown` `{material_compliance, technical_compliance, instruction_precision, professionalism_signals, note}` — combined 35/35/20/10
- `category_notes` (string per category)
- `strengths` (1-3), `improvements` (1-3), `fix_first` (single sentence)
- `timestamped_notes[] {timestamp MM:SS, note}`
- `coaching_drills` (1-5)
- `submission_risk_flags[] {severity, flag}`
- `casting_risk_explanations[] {flag, casting_impact, recall_impact}`
- `role_fit_notes` (string; empty in baseline), `role_fit_modifier` int -10..+5, `role_fit_confidence` (low|med|high)
- `presentation_notes[≤3]`
- `at_risk` boolean

System prompt that originally produced this report (`buildSystemPrompt()`, lines 276-405) is still loaded; in the two-step flow it is the polish system prompt above that drives Step 2. The single-pass system prompt's full rule set (multi-component scoring, brief-adherence weights, audio caps tiered <35/<50/<60, accessibility-safe physicality, accent proportionality, socioeconomic fairness, recall_impact bands, level-calibrated tone, writing rules) remains the canonical reference — see lines 296-404.

Step 2 failure path: `enforceLockedFields(report, evidence)` (lines 206-259) overwrites `audition_type`, `detected_components`, `scores`, and rebuilds `timestamped_notes` from `timestamped_evidence` (preserving the polish phrasing per timestamp where present, otherwise `"observation — why_it_matters"`).

Total Step 2 failure → `renderFallbackReport(evidence, mode)` (lines 555-682) builds a minimal valid report directly from Step 1; same downstream caps/material/verdict pipeline runs over it.

---

## 3. Audition rules / `weightsForType`

File: `src/lib/audition-rules.ts` (already in context).

- `weightsForType(type)` (lines 41-79) — returns `CategoryWeights` per audition type. Note `vocal` is reused as "voice/speech delivery" for non-singing tapes, and as "technique proxy" for `dance`. Examples:
  - `acting_scene|monologue`: acting .45 / vocal .20 / brief .15 / technical .10 / audio .10
  - `song`: vocal .45 / acting .15 / audio .10 / brief .10 / technical .20
  - `musical_theatre`: acting .30 / vocal .30 / brief .15 / technical .15 / audio .10
  - `dance`: acting .25 / vocal .35 (technique proxy) / brief .10 / technical .25 / audio .05
  - `commercial`: acting .60 / brief .20 / technical .15 / audio .05
  - `hybrid|unknown`: acting .35 / vocal .25 / brief .15 / technical .15 / audio .10
- `bandsForLevel(level)` (lines 89-100): `learning {strong:80, ready:70, worth:58}`, `amateur {83,73,60}`, `emerging {86,76,63}`, `professional {89,80,68}`.
- `labelForScore(score, level)` (lines 108-114): maps to `"Strong for this level" | "Ready to submit" | "Worth another take" | "Not ready yet"`.
- `recomputeOverall(scores, weights)` (lines 120-141): drops missing categories, renormalises remaining weights, returns rounded weighted overall and the actually-used weights.
- `computeBlockers({scores, briefAdherence, mode, riskFlags})` (lines 156-217): hard blockers only when assessment is genuinely impossible. Audio <35, technical <35, brief <45 in brief mode, **two weak categories (<50) where ≥1 is a fundamental** (acting/vocal/brief_adherence) — pure presentation/audio stacking does NOT block. Any high-severity risk flag.
- `applyCapsAndLabel({overall, scores, briefAdherence, mode, level, blockers})` (lines 220-289): tiered audio caps (<35 → 60, <50 → 62, <60 → 75); blockers cap to "Worth another take"; brief <45 → "Not ready yet"; brief <60 cannot be Strong; "Strong for this level" requires no category <70 + no blockers + brief ≥60.
- `deterministicCompliance({extracted, signals})` (lines 295-345): orientation mismatch (high), duration over by >5s (medium), duration under (low), audio_peak<0.05 (medium).
- `toUKTerms(s)` / `ukifyDeep(value)` (lines 387-440): callback→recall (case-aware), -ize→-ise, behavior→behaviour, etc.

`process-take.server.ts` calls these in `computeSubmissionVerdict` (lines 490-560) and during finalise (1865-1880, 2640+). Note: caps are applied a second time after `role_fit_modifier` so the role-fit nudge cannot bypass the audio ceiling (lines 1960-1965).

---

## 4. Category label rendering (front-end)

File: `src/routes/audition.$auditionId.tsx` (lines 695-718).

- `scoreBand(score)` — one mapping for ALL numeric category renders:
  - `≥90`: "Submission-ready" / "Meets a professional bar — send as-is." / `text-success`
  - `≥80`: "Strong, refine if time" / "Solid work; small polish would lift it further." / `text-success`
  - `≥70`: "Usable, but needs work" / "Reads on tape, but has noticeable rough edges." / `text-warning`
  - `<70`: "Re-record recommended" / "Below the bar for a confident submission." / `text-destructive`
  - `null`: "Not scored" / muted.
- `briefFitBand(score)` — same numeric thresholds, casting-language labels: Fully aligned / Mostly aligned / Partially aligned / Off-brief. Used only when `r.mode === "brief"` and the row is `brief_adherence`.

Render sites (all in `audition.$auditionId.tsx`):
- Top action panel — overall score (lines 911-923) renders `scoreBand` label under the `text-7xl` overall score.
- Component breakdown (lines 1170-1212) — each component shows `score · band.label`.
- Supporting category scores (lines 1214-1256) — small typography, bar `bg-muted-foreground/60`, micro-copy "These scores explain why the overall lands where it does — they are not separate verdicts."
- Brief adherence breakdown sub-cards (lines 1258-1296) — shows weight (35/35/20/10), score, band label.
- Recommendation / ranked list (lines 1508-1548) — overall + band label per take.
- Comparison table (lines 1556-1666) — Overall row highlighted (`bg-primary/5`, `text-2xl`), supporting rows muted; brief_adherence row uses `briefFitBand` when in brief mode; confidence row prints raw number with no band.

`verdictTone(label)` (lines 680-693) maps verdict labels to colour classes (covers legacy "Strong submit" too).

---

## 5. Comparison-page rendering

Same file. Two components stacked.

`RecommendationView({ takes, onOpenTake })` (lines 1454-1554):
1. Top recommendation card — uses the highest `overall_score` take. `recommendation` text branches on `bestReady` / `bestBlockers`:
   - ready → `Submit Take {n}.`
   - has blockers → `Re-record — none of your takes are submission-ready yet.`
   - else → `Take {n} is your strongest, but worth another take if you can.`
   Includes the best take's `casting_headline` in quotes, plus an "Open Take {n} notes" button.
2. Ranked list — sorted by `overall_score` desc; each row shows rank, take number, verdict (toned), short headline, big primary score with band label, "Notes" button.
3. `<CompareView takes={takes} />` — table; rows in fixed order: Overall (primary, highlighted), Vocal, Acting, Audio, Technical, Brief / standards, Confidence. Header notes "Best take: Take {n}" + headline + "Overall score is the primary comparison metric. The rows below explain why."

Single-take path bypasses `RecommendationView` entirely — `TakeView` accepts `isSoleTake` and additionally renders `<SoleTakeDecisionPanel>` (lines 1387-1452) with the should-I-submit / fix-first / re-record drills block.

---

## 6. Timestamp validation, render, export

Validation (`evidence-pass.server.ts` 375-393): `TS_RE = /^([0-5]?\d):([0-5]\d)$/`. `isValidTimestamp(ts, durationSeconds?)` accepts MM:SS up to 59:59 and, when duration is known, rejects anything more than `ceil(duration)+1` seconds in. Step 1 normalisation (lines 522-540) drops invalid timestamps, sorts chronologically with `tsToSeconds`, caps at 8.

Step 2 enforcement (`report-polish.server.ts` 220-256, `enforceLockedFields`): rebuilds `timestamped_notes` from locked evidence keyed by timestamp; merges polish-rephrased note where the timestamp matches; otherwise uses `observation — why_it_matters`. Cap 8.

Post-Step-2 normaliser (`report-quality.server.ts` 384-426, `normaliseTimestampedNotes`): typed validation, dedupe by `timestamp|note.lower`, re-validate against duration, re-sort, cap 8, returns `{reordered, dropped, finalCount}` for logging.

Render (`audition.$auditionId.tsx` 1328-1342): list of `{timestamp, note}`, monospaced timestamp in primary colour, note text in foreground.

Export: there is **no** report export (no PDF/CSV/share endpoint in `src/`); search confirms timestamps are surfaced only via the in-app render. Their canonical persistence is `report.timestamped_notes` in the `takes.report` JSON column.

---

## 7. Presentation / accessibility / safety scrubs

Two layers, both deterministic, both mutate `report` in place after Step 2 (or after the fallback renderer).

Layer A — Polish-side (`report-polish.server.ts`):
- `enforceLockedFields` (lines 206-259) — overwrites scores, rebuilds timestamped_notes (above).
- `enforceUnsupportedClaims` (lines 327-475):
  - **Strict drop**: any `submission_risk_flags`, `presentation_notes`, `role_fit_notes` claim whose token-overlap with the matching evidence corpus < 0.4 (or <0.3 for role-fit) is removed.
  - `role_fit_notes` is also wiped when `role_fit_assessable=false` or `brief_assessable=false`.
  - **Soft rewrite** (`strengths` / `improvements`): if a line directly contradicts `evidence_sufficiency` (e.g. praises vocal detail with `audio_assessable=false`, or eyeline detail with `video_assessable=false`, or movement with `movement_assessable=false`) it is dropped; otherwise low-overlap lines are rewritten to the closest evidence line. Counts returned per field for telemetry.
- `enforceScoreAlignment(report, verdict)` (lines 494-545): re-tones `casting_headline` / `casting_insight` to match the locked verdict band. Never edits scores.

Layer B — Report-quality scrub (`report-quality.server.ts`, called from the orchestrator before persistence):
- `colourWordsLockedInEvidence(ev)` (62-82) builds the allow-list from Step 1 presentation/strength/improvement/timestamp text.
- `rewriteColourInString` (97-125): strips colour words not locked. If a clothing noun (`top|shirt|jumper|outfit|...`) survives, the line is dropped (caller may substitute a `COLOUR_NEUTRAL_REWRITES` line for `presentation_notes` only).
- `briefHasSourceMetadata` (173-193) + `PAGE_REWRITES` (139-153) + `SIDE_REWRITES` (155-170): page/line/script/book references are rewritten to neutral wording; "the requested side(s)" / "in the side" / "the side(s)" → acting-scene wording. Counts split into `page_total` (logged) and `side_total` (logged).
- `briefRequiresStaticFraming` (239-250) + `FRAME_BREAKING_PATTERNS` (252-277) + `REHEARSAL_LABEL_RE` (279-280): when the brief requires head-and-shoulders / close-up / fixed framing, any line matching frame-breaking patterns (walk around the room, stand up to record, hold instrument/mic/prop, record while moving, packing a bag, …) is replaced with a frame-safe rewrite from `FRAME_SAFE_REWRITES` unless it's already labelled rehearsal-only.
- `presentationClaimSupported` (449-473) + `PRESENTATION_VISUAL_CLAIM_RE` (433-434) + `PRESENTATION_NEUTRAL_NOTES` (438-442): `presentation_notes` claims about wardrobe/contrast/background must overlap Step 1 `presentation_evidence`. First unsupported entry is replaced with one neutral camera-readability line; subsequent unsupported entries are dropped. Capped at 3.
- `scrubReportQuality` (496-670) walks: `casting_headline`, `casting_insight`, `fix_first`, `role_fit_notes`, `strengths`, `improvements`, `coaching_drills`, `presentation_notes`, `next_take_plan`, `category_notes.*`, `brief_adherence_breakdown.note`, `timestamped_notes[].note`, `submission_risk_flags[].flag`, `casting_risk_explanations[].flag/.casting_impact`. Returns counters per field. Explicitly does NOT touch: `scores`, `overall_score`, `verdict_final`, `block_reasons`, `audition_type`, `detected_components`, `role_fit_modifier`, `compliance_flags`, `score_breakdown`.

Layer C — Forbidden-language guard (`process-take.server.ts` 1887-1936): regex set covers identity (attractive, weight, body, race, ethnic, gender presentation, masculine/feminine, age), disability/mobility/medical (wheelchair, crutch, prosthetic, mobility aid, medical device, neurodivergent, autistic), physicality proxies (limited movement, restricted, constrained, range of motion, etc.), period/medical proxies ("modern intrusion", "world-breaker", "device visible"), and class-coded ("look the part", "posh", "common accent", "uneducated", "cheap-looking"). Applied to `role_fit_notes`, `presentation_notes`, `strengths`, `improvements`, `coaching_drills`, `fix_first`. Forbidden hits trigger field-level removal AND, for role-fit, zeroing `role_fit_modifier`. Sets `safety_rewrite_applied` for telemetry.

`presentation_notes_disclaimer` is always set (line 1991-1992): "These do not affect your score unless they make the tape difficult to see or break a specific brief instruction." Surfaced in the UI panel (`audition.$auditionId.tsx` 1152-1168).

---

## 8. Role-fit logic

Generation rules (`buildSystemPrompt`, `process-take.server.ts` 326-337): brief mode only; judges the role's function/intent only — never likeness, race, age, body, gender, disability, class, imitation. Allowed dimensions: tone, energy, relationship, status, rhythm, vocal style, emotional world, interpretation. ONE short paragraph. Modifier range -10..+5 (asymmetric). 0 in baseline. `role_fit_confidence: 'low'` for thin briefs. Cannot compensate for weak fundamentals.

Schema (REPORT_TOOL, lines 220-237): three required fields, modifier int -10..+5, confidence enum.

Server enforcement (`process-take.server.ts` 1940-1974):
- Clamp modifier to `[-10, +5]`, round to int.
- Force 0 if `mode !== "brief"`.
- If `role_fit_notes` contains forbidden language (the safety regex set above), strip the note AND zero the modifier — opaque/appearance-based nudges never reach the score.
- Apply `overall + roleFitModifier`, then **re-apply** the audio caps (lines 1963-1965) so role-fit cannot beat the audio ceiling.
- Validate `role_fit_confidence`; default to `"low"`.
- Baseline mode forces `role_fit_notes=""` and confidence `"low"`.

Polish layer (`enforceUnsupportedClaims`): drops `role_fit_notes` entirely when `role_fit_assessable=false` or `brief_assessable=false`; otherwise replaces low-overlap text with `Role fit, based on observable evidence: <role_fit_evidence>`.

UI (`audition.$auditionId.tsx` 1120-1150): only renders when `mode === "brief"` and `role_fit_notes` non-empty. Shows the modifier (`+N to overall` or `-N to overall`), the confidence label, the note, plus the disclaimer "Role fit reflects alignment with the role's function and tone — never likeness or appearance."

---

## 9. Material-policy logic

Type (`src/lib/audition-rules.ts` 354): `MaterialPolicy = "fixed" | "choice" | "none"`.

Detection — `detectMaterialPolicy(rawBrief, materialRequested)` (`src/server/extract-brief.server.ts` 71-98):
- "choice" if the raw brief matches any `CHOICE_MATERIAL_PATTERNS` (e.g. `\b(of|your)\s+choice\b`, `\b(any|choose any)\s+(song|monologue|...)`, `free choice`, `performer's choice`).
- "none" if no `material_requested` and no choice phrasing.
- "choice" if `material_requested` itself contains "choice" / "any song" / "any monologue" / etc.
- otherwise "fixed".

Set on the extracted brief at lines 211 and 326. `extract-brief` writes `material_policy` alongside `material_requested`.

Enforcement — `process-take.server.ts` 2018-2132:
- Reads `extractedBrief.material_policy`; falls back to `materialRequested.length > 0 ? "fixed" : "none"` when missing (legacy briefs).
- `ALT_MATERIAL_PATTERNS` (2037-2048) detects both direct alternatives ("choose another song", "switch monologue") and SOFT replacement language ("not the best choice", "could showcase you better", "more suited", "different choice").
- Only when policy === "fixed" the scrub runs:
  - `stripAlt` rewrites matching phrases to `"Focus on strengthening the submitted material."` across `strengths`, `improvements`, `coaching_drills`, `fix_first`, `casting_headline`, `casting_insight`, every `category_notes.*`.
  - Final invariant: `assertNoMaterialSuggestions` walks the entire report tree once more to catch any residual phrasing — anything that slips past the targeted scrub is rewritten and a warn log is emitted with `takeId`.
  - Sets `safetyRewriteApplied = true`, logs `material_scrub_triggered`.
- Choice / none policies leave the report untouched (repertoire suggestions allowed).
- Non-PII summary log (lines 2139-2145) records `material_policy`, `material_scrub_triggered`, `duration_overridden`, `safety_rewrite_applied` per take.

`material_policy` is also persisted into `score_breakdown` at line 2657 for downstream debugging.

---

## 10. Production report example

Live take `fd235112-21cb-4bb0-a25b-9d947a6b5976` — a baseline-mode acting scene, overall 88, verdict "Ready to submit". Selected fields (full JSON pulled with `psql`, formatting preserved):

```
{
  "mode": "baseline",
  "audition_type": "acting_scene",
  "overall_score": 88,
  "overall_score_model": 84,
  "overall_score_final": 88,
  "verdict_final": "Ready to submit",
  "submission_verdict": {
    "label": "Ready to submit",
    "reason": "Solid, castable tape — safe to send as-is.",
    "blocked": false
  },
  "block_reasons": [],
  "scores": {
    "audio": 88, "acting": 86, "technical": 90,
    "brief_adherence": 95, "professional_presentation": 85
  },
  "brief_adherence_breakdown": {
    "material_compliance": 100, "technical_compliance": 100,
    "instruction_precision": 100, "professionalism_signals": 90,
    "note": "The tape follows standard professional self-tape conventions for a scene submission."
  },
  "casting_headline": "This is a grounded, technically clean performance with a strong sense of internal life.",
  "casting_insight": "Highly castable for contemporary screen drama; the performance is nuanced and avoids overplaying for the camera.",
  "fix_first": "Sharpen the very beginning of the tape by ensuring you are fully 'in' the moment the second the camera rolls.",
  "strengths": [...3 items...],
  "improvements": [...2 items...],
  "coaching_drills": [...3 items...],
  "timestamped_notes": [
    {"timestamp":"00:45","note":"Strong internal reaction here; the shift in thought is visible in the eyes before the line is delivered."},
    {"timestamp":"02:15","note":"The pace slows slightly here; keep the energy of the thought moving forward even in the pauses."}
  ],
  "presentation_notes": ["The frame is clean and easy to read."],
  "presentation_notes_disclaimer": "These do not affect your score unless they make the tape difficult to see or break a specific brief instruction.",
  "role_fit_notes": "",
  "role_fit_modifier": 0,
  "role_fit_confidence": "low",
  "submission_risk_flags": [],
  "casting_risk_explanations": [],
  "safety_rewrite_applied": false,
  "feedback_reliability_override": "medium",
  "feedback_reliability_reason_code": "no_brief",
  "consistency_modifier": 0,
  "extraction_confidence": "unknown",
  "at_risk": false,
  "detected_components": [
    {"type":"acting_scene","weight":1,"score":84,"note":"A sustained dramatic scene with a clear emotional arc."}
  ]
}
```

Two more recent production takes confirm the same shape (Take 2 = 91, Take 3 = 93, both `complete`); pulled the same way if you need them in the next pass.

---

## What I'd do next

This is read-only. If you want, I can follow up with: (a) a side-by-side diff of the Step 1 vs Step 2 prompts annotated with which guarantees come from which layer; (b) a verbatim dump of the full prompts (instead of summaries) into a single reference doc; (c) deeper sampling of historical reports (5–10 takes across brief vs baseline, single vs multi-component, blocked vs ready).
