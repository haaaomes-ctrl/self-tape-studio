# S9-19K Performance Observable, Public Claim, Comparison Parity Runtime Closeout

## Purpose

S9-19K closes the live blockers that remain after S9-19J without adding an automated media-test harness, synthetic media fixtures, or a replay framework. The slice keeps public scoring, public named technique authority, public comparison recommendation, production safety, and customer release blocked.

## Root-Cause Map

### A. performance_observable

Fresh runtime shows Step 1 provider/request handling and family projection are live, with video, audio, material-specific performance, and candidate technique families completing. The remaining ordinary family gap is `performance_observable`. The likely runtime shape is an accepted `material_specific_performance` event, such as a scene/song/slate/task segment occurring, that is not also projected into the generic performance family because the classifier assigns a single family.

S9-19K treats a material-specific performance observation as a valid derived `performance_observable` only when it is event-based, non-judgemental, source-linked, and already accepted by Step 1. Context-only material facts, praise, quality judgements, readiness, role fit, castability, bookability, marketability, scores, and public technique authority claims remain rejected.

### B. AnalysisEvidenceState / EvidenceAnchors

AnalysisEvidenceState already reads `performance_observable_evidence[]`, and EvidenceAnchors already creates anchors for accepted Step 1 family items. The blocker is that the performance family array can remain empty when the only safe performance event is classified as `material_specific_performance`. After cross-family derivation, the derived performance item gets its own truth ID, source path, and EvidenceAnchor.

### C. PublicClaimTrace / ClaimCandidateTrace

Runtime diagnostics can emit internal-only candidates with `public_display_status` values such as `not_rendered_internal_trace` and `not_rendered_internal_candidate`. These are not public output and must not be required public-claim-gate items. S9-19K keeps unsupported rendered public claims strict, but excludes internal-only, suppressed, or not-rendered diagnostics from public claim gate failure.

### D. Comparison parity

Same-video comparison can execute, detect a duplicate, suppress the recommendation, and keep public output unchanged while still reporting `parity_artefacts_missing`. That is too broad when comparison raw, internal report, suppression trace, duplicate detection trace, route variance trace, and same-video risk context are present. S9-19K classifies intentionally absent public comparison output as `not_emitted_suppressed`, satisfies comparison suppression safety, and keeps comparison Level 2 fail-closed only on the explicit non-decisive evidence-delta blocker.

### E. Runtime/provenance

RuntimeVerificationTrace exists but was emitted only when caller metadata included runtime verification fields. S9-19K emits the trace by default as an internal required/blocked verification artefact when no fresh runtime/operator confirmation is present. Unknown deployment provenance remains a release blocker only and does not erase ordinary internal evidence proof.

## Expected Result

- `performance_observable` can complete when safely derivable from accepted Step 1 events.
- Public claim gates ignore not-rendered internal diagnostics.
- Same-video comparison suppression safety reconciles without `parity_artefacts_missing` when required suppression/risk artefacts are present.
- Runtime verification remains `required` unless fresh runtime/operator confirmation is provided.
- Global Level 2 remains `not_accepted`; production/customer release remains blocked.
