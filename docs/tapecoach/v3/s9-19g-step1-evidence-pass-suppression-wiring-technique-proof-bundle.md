# S9-19G Step 1 Evidence Pass, Suppression Wiring, and Technique Proof Bundle

## Purpose

S9-19G responds to runtime verification that showed the ordinary single-take Step 1 evidence pass failing with HTTP 400, leaving Step1ObservableEvidence partial with zero accepted observations. It also fixes suppression-proof wiring where public score and public technique absence was proven by parity/payload/no-export artefacts but GateTrace and ValidatorTrace still kept stale blockers.

## Runtime Blockers Targeted

- Step 1 evidence pass request contract failure.
- Missing Step1ObservableEvidence video, audio, material, performance, and candidate-technique families.
- AnalysisEvidenceState and EvidenceAnchors remaining insufficient because accepted Step 1 observations were unavailable.
- TechniqueObservationTrace remaining legacy-only when no accepted Step 1 candidate-technique evidence exists.
- Public scoring suppression proof blocked despite public score absence.
- Public technique authority suppression proof blocked despite public technique-authority absence.
- ModelRunTrace Step 1 failure classification lacking a safe error category.

## Implementation Summary

- The evidence-pass tool schema is now cloned through a provider-compatible sanitizer before runtime calls. Nullable JSON-schema type arrays are removed from the provider request shape, and candidate-technique evidence is requested as an optional internal-only structured observation family.
- Step 1 provider failures now classify into safe categories such as `provider_request_contract_error`, `provider_timeout`, `provider_unavailable`, `provider_response_schema_error`, and `parser_error`. Raw response bodies are not returned or stored.
- Step1ObservableEvidence projection now accepts observed material component presence from structured Step 1 component data and can derive an internal candidate-technique descriptor from safe performance observations when no explicit candidate-technique extractor output is present.
- Public scoring suppression proof no longer depends on PublicClaimTrace aggregate sufficiency when score claims are absent or specifically suppressed.
- Public technique authority suppression proof is separated from the internal TechniqueObservationTrace gate. It can satisfy from public-output permission, parity field absence, content-scan status, claim absence/suppression, no-export, and unchanged public output without requiring internal technique proof.
- PublicClaimTrace and ClaimCandidateTrace summaries now emit category-specific public score and public technique-authority claim counts, suppressed counts, blocked counts, unsuppressed counts, and suppression statuses. Metrics fall back conservatively when only generic public-feature blockers are present.
- Report parity now performs a content-level scan over render/public payload text for named technique-authority claims, so allowed public fields cannot satisfy technique-authority suppression proof by field-path absence alone.
- ValidatorTrace now validates the public technique suppression proof with the content-scan status included in the observed evidence.

## Preserved Boundaries

- Public scoring remains blocked.
- Public technique authority remains blocked.
- Public comparison recommendation remains blocked.
- Production/customer release remains blocked.
- Public output remains unchanged.
- Raw report prose, render payloads, public payloads, report parity, legacy ScoreTrace, and legacy TechniqueObservationTrace remain forbidden as Step 1 evidence.
- Runtime operator verification and deployment provenance remain required unless supplied by a fresh runtime bundle/operator confirmation.

## Remaining Blockers

- Fresh runtime verification is still required to prove the provider-compatible Step 1 request fixes the live HTTP 400 path.
- Ordinary L2-A remains dependent on live Step 1 extraction producing enough safe observations with source paths and truth links.
- EvidenceAnchors and PublicClaimTrace aggregate sufficiency remain blocked when true evidence/anchor dependencies are incomplete.
- TechniqueObservationTrace internal proof remains blocked if live Step 1 produces no safe candidate-technique observations.
- Global Level 2 remains not accepted while runtime verification, deployment provenance, and production/customer release approval remain blocked.

## Next Bundled Slice

Run fresh runtime verification on the current deployment. If Step 1 still fails, use the new safe error category to narrow the provider/model contract issue. If Step 1 succeeds but families remain partial, target the missing extractor family rather than public/release gates.
