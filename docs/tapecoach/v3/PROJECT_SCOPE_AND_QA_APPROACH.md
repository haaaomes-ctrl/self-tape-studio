# TapeCoach v3 — Project Scope and QA Approach

## Product purpose

TapeCoach evaluates whether a self-tape is submission-ready for the performer’s selected level and brief, then explains what to fix first when not ready.

## Architecture scope

TapeCoach v3 covers five tracks:
1. System architecture redesign.
2. Technique library.
3. User input review.
4. Analysis pipeline review.
5. Output and comparison improvements.

## Live locked-down production-domain testing rule

Testing is run on the live production domain under locked-down internal access. No public rollout is implied by QA execution.

## Evidence levels 0–4

- **Level 0:** planning/documentation evidence.
- **Level 1:** source-only evidence.
- **Level 2:** run-specific raw/rendered/traced artefact evidence.
- **Level 3:** repeatability and route variance evidence.
- **Level 4:** controlled live-output evidence with complete bundles and passing P0 gates.

## Required automated QA artefact bundle

Required outputs per run:
- `qa-artifacts/<run_id>/manifest.json`
- `qa-artifacts/<run_id>/inputs/input_record.json`
- `qa-artifacts/<run_id>/resolver/resolver_output.json`
- `qa-artifacts/<run_id>/resolver/TruthStateMap.json`
- `qa-artifacts/<run_id>/reports/take_1.raw_report.json`
- `qa-artifacts/<run_id>/reports/take_2.raw_report.json`
- `qa-artifacts/<run_id>/reports/take_3.raw_report.json`
- `qa-artifacts/<run_id>/comparison/comparison.raw.json`
- `qa-artifacts/<run_id>/traces/take_1.EvidenceAnchors.json`
- `qa-artifacts/<run_id>/traces/take_2.EvidenceAnchors.json`
- `qa-artifacts/<run_id>/traces/take_3.EvidenceAnchors.json`
- `qa-artifacts/<run_id>/traces/take_1.PublicClaimTrace.json`
- `qa-artifacts/<run_id>/traces/take_2.PublicClaimTrace.json`
- `qa-artifacts/<run_id>/traces/take_3.PublicClaimTrace.json`
- `qa-artifacts/<run_id>/traces/take_1.ScoreTrace.json`
- `qa-artifacts/<run_id>/traces/take_2.ScoreTrace.json`
- `qa-artifacts/<run_id>/traces/take_3.ScoreTrace.json`
- `qa-artifacts/<run_id>/traces/ModelRunTrace.json`
- `qa-artifacts/<run_id>/traces/validator_trace.json`
- `qa-artifacts/<run_id>/traces/redaction_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/duplicate_detection_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/no_material_difference_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/evidence_delta_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/comparison_suppression_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/same_video_repeatability_trace.json`
- `qa-artifacts/<run_id>/comparison_traces/route_variance_trace.json`
- `qa-artifacts/<run_id>/export_or_no_export/no_export_source_proof.json`
- `qa-artifacts/<run_id>/export_or_no_export/no_export_config_proof.json`
- `qa-artifacts/<run_id>/export_or_no_export/no_export_UI_proof.json`
- `qa-artifacts/<run_id>/export_or_no_export/no_export_log_proof.json`
- `qa-artifacts/<run_id>/parity/raw_to_render_parity.json`
- `qa-artifacts/<run_id>/parity/comparison_parity.json`
- `qa-artifacts/<run_id>/parity/redaction_parity.json`

## GF-01 / RT-15 same-video comparison rule

When the same source video is reused across takes, public winner output must be suppressed unless decisive evidence delta is present.

## Technique public authority rule

No public technique authority display is permitted unless technique maturity and public eligibility gates are satisfied.

## Output/comparison direction

Public output should move away from visible score-first messaging and toward qualitative readiness language calibrated by internal/private scoring.

## Definition of done for current stage

- Clean Markdown documentation in place.
- GF-01 / RT-15 fixture documented and mapped.
- P0 blockers explicitly listed.
- Internal-only emitter/manifest implementation plan ready.
- Public technique authority blocked.
- `production_safe` blocked.

## Current P0 blockers

- GF-01 / RT-15 same-video forced winner still present.
- Comparison still score-first in behaviour.
- Component split instability still present.
- Same-confidence masking still present.
- Manifest and artefact JSON emitters not yet automated.

## Next priorities

- **Engineering:** implement internal-only QA artefact emitters and manifest generation.
- **Research:** deepen technique library with observability and maturity-gating evidence.
