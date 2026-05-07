## Report artefacts — verbatim dump (read-only)

This is a **read-only audit deliverable**, not an implementation plan. No files will be edited if you approve. Approving simply confirms you've reviewed the dump.

### What exists in production right now

| Source | Count | Notes |
|---|---|---|
| Complete takes with `report` JSON | 11 | All `analysis_tier = standard`, all ~246s duration, scored 88–96 |
| Auditions covering those takes | 5 | 1 baseline (no brief), 4 with brief |
| Rendered report screenshots (PNG) | **0 available** | Report pages are RLS-protected per owner; the sandbox browser is anonymous and cannot render them |
| PDFs / exports | **0 available** | The app does not currently generate PDF or any export artefact — no export path exists in code |
| Comparison-page screenshots | **0 available** | Same RLS restriction as above |
| MT (Step-1 evidence) raw outputs | **0 persisted** | `evidence-pass.server.ts` explicitly does **not** persist verbatim Step-1 output. Only a redacted `score_breakdown.two_step` summary is kept (and it's `{enabled:false}` for every existing take, meaning two-step wasn't run on any current report) |

### Bundle (downloadable)

Full verbatim JSON for every available report is bundled below. Contains: `auditions.json`, `takes_full.json`, `per-take/<id>.json` (11 files), `per-audition/<id>.json` (5 files, useful as comparison-set inputs).

<lov-artifact path="report-artefacts.zip" mime_type="application/zip"></lov-artifact>

### Inventory

```
audition_id                              takes  brief?  scores
8b8e0b4f-e6e6-4cd3-8e56-01894140039d     1      no      88
60145e75-964c-40bb-8f58-0c552c6d8fad     1      yes     93
27a49d98-1f35-43ee-ace9-d5b0ec33e425     3      yes     93, 95, 96   ← repeated-take set
5d3c9734-7638-4f8c-bc26-cfcc04671d3c     3      yes     93, 93, 93   ← repeated-take set
18072552-4fe0-4338-8662-44ad5ead13df     3      yes     93, 91, 93   ← repeated-take set
```

### Sample 1 — baseline single take (verbatim `report` JSON)

Take `fd235112-21cb-4bb0-a25b-9d947a6b5976`, audition "Test", baseline (no brief), `acting_scene`, overall 88.

```json
{
  "mode": "baseline",
  "scores": { "audio": 88, "acting": 86, "technical": 90, "brief_adherence": 95, "professional_presentation": 85 },
  "at_risk": false,
  "fix_first": "Sharpen the very beginning of the tape by ensuring you are fully 'in' the moment the second the camera rolls.",
  "strengths": [
    "Excellent use of silence and 'listening' between lines.",
    "Naturalistic vocal delivery that avoids theatrical projection.",
    "Consistent and effective eye-line that maintains the fourth wall."
  ],
  "confidence": 85,
  "improvements": [
    "Try to find one moment of lightness or a brief smile to contrast the heavier tone of the scene.",
    "Ensure the transition between the slate and the start of the scene is clean and immediate."
  ],
  "audition_type": "acting_scene",
  "block_reasons": [],
  "overall_score": 88,
  "verdict_final": "Ready to submit",
  "category_notes": {
    "audio": "The dialogue is crisp and clear throughout. There is no distracting background noise, and the levels are consistent even during quieter moments.",
    "acting": "The performance is impressively understated. You allow the thoughts to land before speaking, which creates a very believable rhythm. The connection to the off-camera reader feels genuine and consistent.",
    "technical": "The landscape orientation and lighting are professional. The focus remains sharp on the face, which is essential for capturing the subtle shifts in expression.",
    "brief_adherence": "In the absence of a specific brief, this meets all professional industry standards for a dramatic self-tape.",
    "professional_presentation": "The framing is appropriate for a screen audition, and the eye-line is well-placed just off-lens, allowing us to see into the eyes clearly."
  },
  "role_fit_notes": "",
  "casting_insight": "Highly castable for contemporary screen drama; the performance is nuanced and avoids overplaying for the camera.",
  "coaching_drills": [
    "Run the scene again but find one specific moment to 'interrupt' the other person's line to vary the pace.",
    "Practice the scene while doing a simple physical task (like folding laundry) to see where natural pauses emerge.",
    "Record a version where you consciously lower your vocal volume by 20% to test the intimacy of the microphone."
  ],
  "casting_headline": "This is a grounded, technically clean performance with a strong sense of internal life.",
  "confidence_reason": "Professional level tape with clear audio and video; no brief provided so evaluated against baseline industry standards.",
  "role_fit_modifier": 0,
  "timestamped_notes": [
    { "note": "Strong internal reaction here; the shift in thought is visible in the eyes before the line is delivered.", "timestamp": "00:45" },
    { "note": "The pace slows slightly here; keep the energy of the thought moving forward even in the pauses.", "timestamp": "02:15" }
  ],
  "presentation_notes": ["The frame is clean and easy to read."],
  "submission_verdict": { "label": "Ready to submit", "reason": "Solid, castable tape — safe to send as-is.", "blocked": false },
  "detected_components": [{ "note": "A sustained dramatic scene with a clear emotional arc.", "type": "acting_scene", "score": 84, "weight": 1 }],
  "overall_score_final": 88,
  "overall_score_model": 84,
  "role_fit_confidence": "low",
  "consistency_modifier": 0,
  "extraction_confidence": "unknown",
  "submission_risk_flags": [],
  "safety_rewrite_applied": false,
  "brief_adherence_breakdown": {
    "note": "The tape follows standard professional self-tape conventions for a scene submission.",
    "material_compliance": 100, "technical_compliance": 100, "instruction_precision": 100, "professionalism_signals": 90
  },
  "casting_risk_explanations": [],
  "feedback_reliability_override": "medium",
  "presentation_notes_disclaimer": "These do not affect your score unless they make the tape difficult to see or break a specific brief instruction.",
  "feedback_reliability_reason_code": "no_brief"
}
```

Companion `score_breakdown` for the same take:

```json
{
  "level": "professional",
  "weights": { "audio": 0.125, "acting": 0.5625, "technical": 0.125, "brief_adherence": 0.1875 },
  "two_step": { "enabled": false },
  "thresholds": { "ready": 80, "worth": 68, "strong": 89 },
  "audition_type": "acting_scene",
  "verdict_final": "Ready to submit",
  "material_policy": "none",
  "role_fit_modifier": 0,
  "overall_score_final": 88,
  "overall_score_model": 84,
  "role_fit_confidence": "low",
  "extraction_confidence": "unknown",
  "safety_rewrite_applied": false,
  "overall_before_role_fit": 88,
  "presentation_notes_count": 1,
  "role_fit_modifier_explanation": "No role-fit adjustment applied."
}
```

### Sample 2 — repeated-take set (musical theatre, 3 takes)

Audition `27a49d98-...`, brief mode, `musical_theatre`. Same performer, three sequential takes ~10 minutes apart. Useful as a **repeated-output / comparison-page input example**.

| Take | Overall | Acting | Vocal | Audio | Tech | Brief | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | 93 | 88 | 92 | 95 | 95 | 100 | Strong for this level |
| 2 | 95 | 90 | 93 | 95 | 95 | 100 | Strong for this level |
| 3 | 96 | 92 | 95 | 95 | 95 | 100 | Strong for this level |

Verbatim Take 1 `report` (selected fields — full JSON in bundle at `per-audition/27a49d98-...json`):

```
fix_first       : "Ensure the very end of the scene remains active and 'in character' until the camera cuts."
casting_headline: "A highly professional tape with a particularly strong vocal performance."
strengths       : Excellent vocal technique and tone…  /  Grounded and believable acting…  /  Flawless adherence…
improvements    : Sharpen the transitions between 'wit' and 'warmth'…  /  Maintain emotional connection in money notes…
detected_components: [{acting_scene, w=0.5, score=88}, {song, w=0.5, score=92}]
weights         : audio 0.10, vocal 0.30, acting 0.30, technical 0.15, brief 0.15
overall_model 90 → +consistency_modifier 5 → overall_final 93
safety_rewrite_applied: true   (Step-3 polish triggered)
```

Use `per-audition/27a49d98-...json` from the bundle for byte-exact diff input across all three takes (this is what a comparison view consumes).

### MT (multi-take / two-step) raw outputs

> **Not available.** Two design facts to be aware of:
>
> 1. **Two-step (Step-1 evidence pass) is currently disabled** for every persisted report — `score_breakdown.two_step.enabled === false` on all 11 takes. Step-1 is implemented in `src/server/evidence-pass.server.ts` but the orchestrator is not invoking it for production traffic.
> 2. **Even when enabled**, Step-1 raw evidence is held in memory only for the duration of one process; only the redacted summary from `summariseEvidence()` (timestamp count + sufficiency booleans) is persisted to `score_breakdown.two_step`. There is no historical store of "Step-1 JSON ↔ Step-2 JSON" pairs to dump.
>
> If you want raw MT pairs going forward, the smallest non-invasive change is to log Step-1 output to a debug column or external sink behind a feature flag — happy to plan that as a separate task.

### Rendered screenshots / PDFs

> **Not produced.** Reasons:
>
> - The audition route at `/audition/$auditionId` is owned-data only (RLS `auth.uid() = user_id`). The plan-mode browser session is anonymous and stops at "Loading…" before the report data resolves, so I can't capture authenticated screenshots without impersonating the user.
> - **No PDF / export pipeline exists in code.** There is no route, server function, or library import (puppeteer/playwright/pdf-lib/react-pdf) producing a downloadable artefact. Nothing to dump.
>
> If you'd like rendered screenshots, options are: (a) you upload screenshots from your own session, or (b) approve a one-off plan to add a temporary signed preview URL for read-only QA snapshots.

### What the bundle gives you for each download

```
report-artefacts/
  auditions.json              ← all 5 audition rows incl. brief + extracted_brief
  takes_full.json             ← all 11 take rows incl. report, scores, score_breakdown,
                                signals, checklist, compliance_flags
  per-take/<take_id>.json     ← single take + its parent audition (useful for individual
                                report inspection)
  per-audition/<audition_id>.json
                              ← audition + ordered list of takes (comparison-view input,
                                including the three repeated-take sets above)
```

All JSON is verbatim from Postgres, pretty-printed, no field omitted.
