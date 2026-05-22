# S9-19I Step 1 Family Projection / Truth Linkage / Ordinary L2-A Closure

## Purpose

S9-19I closes the post-S9-19H ordinary-analysis evidence-spine gap without approving public or production release features. S9-19H repaired the live Step 1 provider request path enough for compact Step 1 observations to persist, but runtime still showed the required ordinary evidence families as missing. This slice converts accepted Step 1 observations into explicit ordinary-analysis family evidence with truth-state and evidence-anchor linkage.

## Root-Cause Map

### A. Step 1 Observation Source Status

Post-S9-19H Step 1 returns compact structured observations under `step1_observations[...]`. Those observations are persisted and counted, but the downstream projection filters only trusted older paths such as `timestamped_evidence[...]`, `presentation_evidence[...]`, `candidate_technique_evidence[...]`, and `evidence_sufficiency.*`. Compact observations were therefore accepted by the filter but rejected before family completion.

The compact contract also lacked a separate `material_specific_performance` family. Material context and material performance were collapsed, which made it impossible to distinguish supplied brief/material presence from an observed task or material event in the tape.

### B. Family Classifier Status

`video_observable` and `audio_observable` were counted only after media projection accepted a source path. `material_specific`, `performance_observable`, and `candidate_technique` were counted only after ordinary projection accepted a source path. Compact `step1_observations[...]` paths failed both gates, so runtime could show accepted observations while reporting every ordinary family as missing.

S9-19I introduces an explicit family split:
- `material_specific`: supplied or contextual material fact only.
- `material_specific_performance`: observed material/task event that can satisfy the ordinary material-performance gate.

### C. Truth Linkage Status

Truth IDs are already generated for projected Step 1 items, but compact observations that failed projection never reached the truth-linking step. S9-19I keeps run/take-scoped canonical truth IDs and only links accepted family observations that survive source, anti-fake, and family classification checks.

### D. EvidenceAnchors Status

EvidenceAnchors previously read `AnalysisEvidenceState.observable_evidence_items`, which primarily contained deterministic/runtime facts. Projected Step 1 family observations were present in `Step1ObservableEvidence` but were not exposed as resolvable `AnalysisEvidenceState` paths for anchoring. S9-19I carries linked family items into AnalysisEvidenceState family arrays and anchors those arrays as real-runtime internal evidence.

### E. TechniqueObservationTrace Status

TechniqueObservationTrace could only satisfy from real-runtime candidate-technique evidence with anchors and truth IDs. Because compact candidate-technique observations were rejected before projection, the trace stayed legacy/report-snapshot based. S9-19I projects accepted candidate-technique observations into AnalysisEvidenceState, anchors them, and allows internal-only TechniqueObservationTrace entries to satisfy the internal technique gate while public technique authority remains blocked.

### F. PublicClaimTrace Status

PublicClaimTrace must distinguish rendered public claims from internal diagnostics. Internal candidates marked `not_rendered_internal_trace` or otherwise excluded from the public claim gate should not block public-claim support if they are suppressed and not rendered. S9-19I keeps unsupported rendered claims blocked, but prevents internal diagnostic candidates from masking ordinary evidence progress.

### G. GateTrace / ValidatorTrace Status

The remaining ordinary L2-A gates depend on Step1ObservableEvidence, AnalysisEvidenceState, TruthStateMap linkage, EvidenceAnchors, PublicClaimTrace, TechniqueObservationTrace, ModelRunTrace, ValidatorTrace and GateTrace. Public scoring, public technique authority, public comparison recommendation, deployment provenance, runtime operator verification, production safety, and customer release remain separate release/public blockers.

## Expected Result

If Step 1 provides genuine media-observable observations for all required families, ordinary internal evidence-spine status can satisfy. If media-observable input is unavailable or a family is absent, S9-19I must keep ordinary L2-A insufficient with exact family/media blockers rather than fabricating evidence.

Public scoring, public technique authority, public comparison recommendation, production safety and customer release remain blocked.
