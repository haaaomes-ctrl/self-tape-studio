
# Two-Step AI Analysis Pipeline — Final Plan

Evolutionary upgrade of the existing single-pass Gemini analysis into a deterministic Step 1 (evidence) + Step 2 (polish) flow. All scoring, caps, verdicts, thresholds, schema, UI and material policy remain unchanged. Three approved adjustments are incorporated below.

## Adjustment 1 — Feature flag default (safer)

Behaviour:
- `TWO_STEP_ANALYSIS_ENABLED === "true"` → two-step pipeline
- unset, empty, `"false"`, or any other value → existing single-pass pipeline (current behaviour)

Implementation:
- Single helper `isTwoStepEnabled()` in `src/server/process-take.server.ts`:
  ```ts
  function isTwoStepEnabled() {
    return process.env.TWO_STEP_ANALYSIS_ENABLED === "true";
  }
  ```
- Read inside the handler (not at module top-level) so the env is picked up at call time.
- No production default flip. Rollback = unset the env var.

## Adjustment 2 — No raw Step 1 evidence in `report._evidence`

- Step 1 evidence object lives **only in memory** for the duration of `processTake`.
- It is passed in-process to Step 2 (serialised as the polish prompt input) and then discarded.
- The public `report` JSONB column gets **no** `_evidence` field. Schema unchanged, no UI risk.
- Compact, non-sensitive debug summary written into the existing `score_breakdown` JSONB column under a new key `two_step`:
  ```ts
  score_breakdown.two_step = {
    enabled: true,
    evidence_version: "v1",
    timestamped_evidence_count: number,
    evidence_sufficiency: {
      has_audio: boolean,
      has_visible_face: boolean,
      duration_ok: boolean,
      script_signal: boolean,
    },
    evidence_pass_duration_ms: number,
    report_polish_duration_ms: number,
    two_step_total_ai_duration_ms: number,
    polish_fallback_used: boolean,
    locked_field_overwrites: number,
    unsupported_claims_rewritten: number,
    unsupported_claims_removed: number,
  }
  ```
- No raw observation text, no raw model output, no transcript fragments stored.

## Adjustment 3 — Conservative unsupported-claim enforcement

Locked-field enforcement remains the **primary** safeguard (scores, audition_type, level, verdict, timestamps, caps — all overwritten from Step 1 / existing recompute).

Unsupported-claim handling becomes conservative:

**Strict removal (high-risk fields only):** new entries in Step 2 that don't appear in Step 1 evidence are dropped from:
- `timestamped_notes` (Step 1 timestamps are the only allowed set; new ones removed)
- `risk_flags` / compliance-style flags
- `presentation_notes`
- `role_fit` claims (e.g. type/age/casting fit statements)

**Soft alignment (strengths / improvements):**
- Do **not** delete based on token overlap.
- If a strength or improvement has weak semantic overlap with Step 1 evidence, run a small deterministic rewrite step (text-only, temp 0) that re-anchors the wording to the closest Step 1 observation — preserving voice and supportiveness — instead of deleting.
- Only drop a strength/improvement if it is clearly contradicted by Step 1 evidence (e.g. claims strong eyeline when Step 1 says no eyeline detected).
- Counts logged in `score_breakdown.two_step` (`unsupported_claims_rewritten`, `unsupported_claims_removed`).

## Pipeline (unchanged from approved plan)

```text
processTake(takeId)
  ├─ load take + audition
  ├─ if !isTwoStepEnabled() → runSinglePassAnalysis() (existing code path)
  └─ else:
      ├─ Step 1: runEvidencePass(mp4Url)
      │     model: google/gemini-3-flash-preview (multimodal)
      │     temperature: 0, top_p: 1, max_tokens: 4096
      │     tool: collect_audition_evidence
      │     returns: { observations, raw_scores, timestamps[≤8], sufficiency }
      ├─ Step 2: runReportPolish(evidence, audition, level)
      │     model: google/gemini-3-flash-preview (TEXT-ONLY, no video)
      │     temperature: 0.2, top_p: 1, max_tokens: 8192
      │     tool: REPORT_TOOL (existing schema, unchanged)
      │     input: serialised evidence + audition context (no mp4)
      ├─ enforceLockedFields(polishedReport, evidence)   ← primary guard
      ├─ enforceUnsupportedClaims(polishedReport, evidence) ← conservative (Adj. 3)
      ├─ recomputeOverallScore + applyCapsAndLabel        ← UNCHANGED
      ├─ materialPolicy scrub                              ← UNCHANGED, runs after polish
      ├─ if Step 2 failed → renderFallbackReport(evidence) (deterministic, no AI)
      └─ persist: report (clean, no _evidence), score_breakdown.two_step (compact summary)
```

## Files

New:
- `src/server/evidence-pass.server.ts` — Step 1 multimodal call + tool schema
- `src/server/report-polish.server.ts` — Step 2 text-only call, locked-field + conservative claim enforcement, fallback renderer

Edited:
- `src/server/process-take.server.ts` — flag branch, orchestration, score_breakdown summary writer; existing `runSinglePassAnalysis` preserved verbatim as the fallback path

Not changed:
- `REPORT_TOOL` schema, UI, DB schema, rubric, weights, thresholds, caps, material policy, Mux pipeline, upload flow, quota.

## Logging (non-PII)

- `evidence_pass_started` / `evidence_pass_completed { duration_ms, timestamps_count, sufficiency }`
- `report_polish_started` / `report_polish_completed { duration_ms }`
- `report_polish_locked_field_overwritten { field }`
- `unsupported_claim_rewritten { field }` / `unsupported_claim_removed { field }`
- `two_step_fallback_used { reason }`
- `two_step_total_ai_duration_ms`

No transcript text, no user identifiers, no raw observations in logs.

## QA / acceptance

1. `TWO_STEP_ANALYSIS_ENABLED` unset → single-pass path runs, identical behaviour to today.
2. Set to `"true"` → two-step path runs, report renders identically in UI, scores match recompute.
3. `report` JSONB contains no `_evidence` key.
4. `score_breakdown.two_step` populated with the listed compact fields.
5. Step 2 attempts to inject a new timestamp → removed; counted in `unsupported_claims_removed`.
6. Step 2 produces a strength weakly related to evidence → rewritten, not deleted.
7. Step 2 hard-fails → fallback renderer produces a valid report; `polish_fallback_used: true`.
8. Caps / verdicts / level thresholds output identical pre/post for the same Step 1 evidence.
9. Material-policy scrub still runs last.
10. Flag rollback (unset env, redeploy) restores exact prior behaviour.

## Remaining risks

- Two-step adds latency (~1 extra AI round-trip). Mitigated by Step 2 being text-only and small.
- Conservative claim enforcement means some weakly-grounded prose may survive; locked fields + recompute keep scores honest.
- `score_breakdown.two_step` is debug-only; ensure UI never reads it (it doesn't today).

Ready to implement on approval.
