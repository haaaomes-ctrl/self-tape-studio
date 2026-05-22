# S9-19L Material Performance, Public Claim Gate, Ordinary L2-A Closure

## Purpose

S9-19L targets the remaining ordinary single-take internal evidence-spine blockers after S9-19K. It repairs material-specific performance classification, performance-observable derivation, public-claim gate treatment of internal diagnostics, and internal proof separation from release/provenance gates. Public scoring, public named technique authority, public comparison recommendation, production release, and customer release remain blocked.

## Root-Cause Map

### A. material_specific_performance

The fresh runtime shows Step 1 is returning accepted observations, but `material_specific_performance_evidence_count` can still be zero. The source code only promotes material observations to `material_specific_performance` for narrow markers such as an explicit `material_specific_performance` kind or `timestamped_evidence[]` source path. Generic Step 1 material/task events, for example a scene, song, slate, monologue, dialogue, task component, or delivered segment occurring in the take, can therefore collapse into `material_specific` context.

This means `material_presence = unknown` or `component_or_task_declaration_status = unknown` can indirectly mask event-based observations even when the observation itself is source-linked and non-judgemental. S9-19L treats accepted event-based Step 1 material/task observations as material-specific performance without requiring those context fields to be known. Context-only facts such as supplied brief, supplied material, role context, or component declaration alone remain non-satisfying.

### B. performance_observable

`performance_observable` remains missing because safe performance events are often present only as material-family observations and the classifier is single-family unless a narrow derivation path fires. When material/task event observations are not promoted to `material_specific_performance`, cross-family derivation to `performance_observable` cannot run.

S9-19L derives `performance_observable` only from accepted, event-based, non-judgemental Step 1 observations. A material-specific performance event may create one derived performance observation with source provenance, truth linkage, and EvidenceAnchors. Audio presence, framing visibility, brief/material context, candidate technique, praise, readiness, role fit, scores, castability, bookability, marketability, and public technique-authority wording remain forbidden.

### C. PublicClaimTrace

Runtime PublicClaimTrace entries still show internal diagnostics with `public_display_status: not_rendered_internal_trace` while also setting `public_claim_support_required` and `required_for_public_claim_gate` to true. These diagnostics are not public output and should not contribute to public-claim support failure.

S9-19L makes rendered public output and explicitly required public-safe sections the only claim-gate inputs. Internal-only, not-rendered, suppressed, and diagnostic claims remain recorded but excluded from public claim gate support. Unsupported rendered public claims still block or require rewrite.

### D. ClaimCandidateTrace

ClaimCandidateTrace has the same rendered/internal bug earlier in the pipeline: not-rendered internal candidates can become eligible for public-claim support checks when they have anchors. This makes internal evidence candidates appear as public-claim blockers.

S9-19L keeps internal candidates as diagnostics, but makes public-gate exclusion win over anchor availability for not-rendered/internal statuses. Only rendered or promoted candidates are strict public claim-gate inputs. Score, technique-authority, and comparison recommendation candidates remain blocked/suppressed and cannot approve public feature gates.

### E. AnalysisEvidenceState / EvidenceAnchors

AnalysisEvidenceState already consumes explicit family arrays, and EvidenceAnchors already anchors accepted family observations when they exist. The remaining aggregate blocker is missing material/performance family evidence. Once event-based material-specific performance and derived performance observations exist, truth-state IDs and real-runtime anchors can allow the ordinary family aggregate to satisfy. If no safe event exists, the aggregate remains insufficient with exact material/performance blockers.

### F. ValidatorTrace / GateTrace

ValidatorTrace and GateTrace still need to separate ordinary internal proof from public/release/provenance boundaries. `ValidatorTrace_internal_only` and `GateTrace_internal_only` are release/public boundary labels, not ordinary internal proof blockers. Unknown deployment provenance must continue to block release-readiness review while not erasing ordinary internal evidence proof.

### G. Comparison

S9-19K already changed same-video comparison parity from `parity_artefacts_missing` to an explicit fail-closed non-decisive evidence-delta posture. S9-19L does not reopen comparison parity unless a regression appears in tests.

## Implementation Decision

- Add deterministic event classifiers for material-specific performance and performance-observable derivation.
- Generate or preserve run/take-scoped truth IDs and real-runtime EvidenceAnchors for accepted material/performance family observations.
- Exclude not-rendered/internal PublicClaimTrace and ClaimCandidateTrace items from required public-claim gate inputs.
- Align ValidatorTrace, GateTrace, manifest, and acceptance metrics so ordinary internal proof can progress independently from release/provenance gates.
- Keep global Level 2 `not_accepted`, public feature approvals blocked, and production/customer release blocked unless separate README-required release gates genuinely satisfy.

## Expected Result

- `material_specific_performance` completes when a safe Step 1 material/task event exists.
- `performance_observable` completes when a safe direct or material-derived performance event exists.
- Public claim support no longer fails because of not-rendered internal diagnostics.
- Ordinary L2-A internal proof can satisfy in source/tests when all ordinary evidence families, anchors, truth linkage, model traces, claim gates, and validator checks satisfy.
- Global Level 2 remains `not_accepted` when deployment provenance, production release, or customer release gates remain blocked.
