# TapeCoach v3 — Scope, QA Approach and Definition of Done

## 1. Product purpose

TapeCoach evaluates whether a self-tape is ready to submit for the performer’s selected level, audition type, and optional casting brief.

The report must answer:
1. Is this tape good enough to submit?
2. If not, what should the performer fix first?

The product judgement should combine UK casting-director, agent, and acting/vocal/movement-coach perspectives.

## 2. Architecture scope

TapeCoach v3 is a gold-standard system architecture redesign.

The rebuild covers five tracks:
1. System architecture redesign.
2. Technique library.
3. User input review.
4. Analysis pipeline review.
5. Output and comparison improvements.

## 3. Live locked-down production-domain testing rule

All testing is production-domain testing on the live TapeCoach website.

There is no separate staging, pre-prod, or beta environment in scope for this phase. Access remains locked down to internal QA/development policy.

## 4. Evidence levels (0–4)

- **Level 0 — Planning/documentation:** Architecture documents, manifests, source maps, defect lists.
- **Level 1 — Source-only:** Inspected source files, type contracts, validators, tests.
- **Level 2 — Specific-run artefact QA:** Raw report JSON, rendered report payload, comparison JSON, traces, and parity artefacts for a specific run.
- **Level 3 — Repeatability:** Repeated-run or model-route variance evidence.
- **Level 4 — Controlled live-output evidence:** Live production-domain QA with complete artefact bundles and P0 gates passing.

## 5. Required automated QA artefact bundle

Every analysis/comparison run intended for QA should emit a complete internal bundle, including manifest, input record, resolver output, truth-state map, per-take raw reports, comparison raw JSON, traces, comparison traces, no-export proof (where applicable), and parity files.

## 6. GF-01 / RT-15 same-video comparison rule

For the same video submitted repeatedly to the same audition with the same brief:
- Duplicate or near-duplicate input must be detected.
- The system must suppress a public winner unless there is a decisive evidence delta.
- Overall score must not be a primary winner-forcing metric.
- Component split instability and same-confidence masking must be surfaced as failure conditions.

GF-01 / RT-15 remains the active P0 acceptance fixture for this rule.

## 7. Technique public authority rule

Technique names must not appear publicly unless technique eligibility and public-claim criteria are passed (including trace linkage and policy gates).

Until then, technique terms remain internal/blocked/descriptor-only, and public technique authority remains blocked.

## 8. Output and comparison direction

Future public report output should move away from visible score-first language and toward qualitative readiness language calibrated by private scoring logic.

Comparison output should only show a winner when evidence supports a decisive material difference.

## 9. Definition of done for the current stage

Current stage is complete when:
- GF-01 / RT-15 evidence is registered.
- Same-video false-winner behaviour is documented as active.
- Evidence folders and fixture docs exist in clean Markdown.
- Automated artefact emitter implementation plan is documented.
- Public technique authority remains blocked.
- Public scoring remains blocked.
- `production_safe` remains blocked.

## 10. Current P0 blockers

- Same-video forced winner still present.
- Comparison score-first logic still present.
- Component split instability still present.
- Same-confidence masking still present.
- Missing automated internal artefact bundle emission for QA manifest and trace files.

## 11. Priority order

- **Next engineering priority:** internal-only automated QA artefact emitters and manifest JSON generation.
- **Next research priority:** deep technique library expansion and maturity-gating evidence.
