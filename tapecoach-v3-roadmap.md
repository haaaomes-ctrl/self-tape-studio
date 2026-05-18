# TapeCoach v3 Roadmap — README-aligned planning index

**Document status:** delivery planning index only.  
**Aligned to:** latest `README.md` architecture review update, 18 May 2026.  
**Language:** UK English.  
**Release philosophy:** small, frequent, reversible releases that provide useful locked-down user value as soon as the relevant evidence and safety gates allow.

---

## 1. Source hierarchy

`README.md` remains the controlling source for TapeCoach product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions.

This roadmap is a planning index. It may organise release sequencing, delivery slices, dependencies, user-benefit sequencing and implementation focus. It must not introduce requirements, public-output permissions, release gates or acceptance decisions that are not already present in `README.md`.

If this roadmap conflicts with `README.md`, `README.md` wins.

The delivery overlay controls sequencing and workstream coordination only. It does not override `README.md` and this roadmap should not duplicate the delivery overlay’s RACI, CODEX task-packet or PR-control detail.

---

## 2. Delivery principles

### 2.1 Small and often

TapeCoach v3 should not be delivered as a single large drop. Each release slice should be small enough to build, test, deploy to the locked-down live product and validate independently.

A release slice should normally have:

- one primary user or operator benefit;
- one clear capability boundary;
- one small set of affected artefacts or gates;
- a feature flag or reversible deployment path where applicable;
- explicit non-goals;
- automated tests and Storage/manifest evidence where relevant;
- a rollback or suppression path.

### 2.2 Good enough, not perfect

“Good enough” means safe, evidence-led and useful for the scoped release slice. It does not mean fully mature, publicly authoritative or production-wide.

A release slice can be good enough when:

- it answers a real user or operator question better than the current product;
- it does not overclaim beyond available evidence;
- it does not leak private traces, hidden scores or internal QA artefacts;
- P0 issues are absent;
- P1 issues are fixed, explicitly de-scoped or blocked from user exposure;
- remaining limitations are visible as limitations rather than hidden failures;
- downstream gates remain truthfully blocked where they have not passed.

A release slice is not required to solve every repertoire, technique, comparison or public-authority problem before it can provide bounded locked-down value.

### 2.3 Benefits to users iteratively and quickly

The roadmap should prioritise useful locked-down report improvements as soon as the relevant safety and evidence boundaries are satisfied.

Examples of early useful value:

- clearer brief requirement itemisation;
- “what the brief asked for / what the tape shows / what cannot be assessed” summaries;
- readiness impact from missing mandatory brief requirements;
- better priority-fix ordering;
- safer, more specific descriptors without public technique-name authority;
- clearer assessability limitations;
- better action-plan grouping;
- visible report sections that follow `GateTrace.public_output_permissions`.

These improvements can be exposed to approved locked-down users before customer-facing release, provided the relevant README gates permit the specific output. Customer-facing release remains blocked until release-candidate requirements pass.

### 2.4 Upfront design; avoid design through review

Do not use repeated review cycles to discover the design. Design should be completed before implementation begins for each release slice.

Each release slice should start with a short design packet:

- user or operator problem;
- proposed behaviour;
- affected README sections and gates;
- artefacts added or changed;
- public/private boundary impact;
- feature flag or suppression path;
- acceptance tests;
- non-goals;
- rollback or revert path.

Implementation review should verify conformance to the approved design packet and README. It should not become an open-ended design workshop. If review discovers a material design gap, either de-scope the gap from the current slice or create a new design packet for the next slice.

### 2.5 Minimise human intervention

Human review should be used where it adds high leverage, not as a default runtime dependency.

Default posture:

- no human judgement per user analysis run;
- no manual operator evidence to satisfy runtime v3 evidence gates;
- automated validators before manual release review;
- human review batched for active-learning and public-authority decisions;
- product owner / release governance involvement only for release-state changes, overrides, public authority and blocked gate decisions.

Active learning should propose, prioritise and group review tasks automatically. Human reviewers should handle small, high-value decisions such as pairwise comparisons, public wording approval and benchmark promotion, not broad manual authoring.

### 2.6 Contract-first implementation

Before deep implementation in a release family, the relevant contracts must be stable enough for the slice. The latest README specifically calls out the pre-R1 contract items:

- canonical schema-version policy;
- manifest and `qa/acceptance_metrics.json` schemas;
- full artefact path register;
- `AnalysisEvidenceState` persistence and failure handling;
- stage atomicity, retry idempotency and storage circuit-breaker policy;
- fixture registry minimum contract;
- validator rule registry convention.

These are not product-value releases by themselves, but they prevent expensive review churn and integration drift.

---

## 3. Current state summary

Current state should be reported exactly, without false promotion:

- S9 internal QA bundle emission has passed for the current Storage validation target where source data exists.
- S9 bundle emission is not Level 2 acceptance.
- Level 2 remains `not_accepted`.
- Production-safe, public-scoring and public-technique-authority gates remain blocked. Public technique authority remains blocked until the README gate passes.
- First-pass `EvidenceAnchors`, `PublicClaimTrace`, `TechniqueObservationTrace` and `ScoreTrace` may be emitted but remain insufficient where they are legacy/report-snapshot derived.
- Comparison artefacts are not emitted automatically for ordinary single-take analysis runs.
- Public comparison recommendations remain blocked until GF-01 / RT-15 and related comparison gates pass.
- Public technique names and public repertoire claims remain gated.
- Raw overall readiness score exposure remains blocked unless the README public scoring criteria pass.

Roadmap language must preserve those states. Do not describe a slice as “accepted”, “production-safe”, “public-approved” or “release-ready” unless the relevant README gate has passed.

---

## 4. Roadmap scope and non-goals

This roadmap should not repeat all README schemas, gate definitions or validation rules. Those live in `README.md`.

This roadmap should do four things only:

1. sequence delivery;
2. identify small releasable slices;
3. show user/operator benefit per slice;
4. keep release-state language aligned with the README.

Non-goals:

- defining new product requirements;
- redefining gates;
- approving public scoring;
- approving public technique authority;
- approving public repertoire claims;
- approving comparison winners;
- replacing the delivery overlay’s team ownership model;
- adding rights, copyright or legal-access gates inside TapeCoach.

Rights, licensing and lawful-access arrangements are handled outside the TapeCoach system. Inside TapeCoach, knowledge-source metadata is used for quality, provenance, freshness, confidence, review state, evidence linkage and public-claim safety.

---

## 5. Release-state vocabulary

Use README status language consistently.

| Status | Roadmap meaning |
|---|---|
| `passed` | Required evidence exists and the relevant gate passed. |
| `not_accepted` | Some artefacts may exist, but the full gate is not satisfied. |
| `blocked` | A known blocker prevents acceptance or exposure. |
| `missing` | Required artefact or evidence was not emitted. |
| `deferred` | Work is intentionally postponed and classified. |
| `not_applicable` | Artefact is not required for this run/context. |
| `emitted` | Artefact was written; this alone does not prove gate satisfaction. |
| `emitted_blocked` | Artefact was emitted to prove a blocked/not-executed state; it must not count as successful runtime evidence. |
| `legacy_adapter` | Internal QA/debug only unless explicitly replaced by `real_runtime_v3` evidence. |
| `real_runtime_v3` | Runtime evidence produced from the v3 evidence spine and eligible for gate satisfaction if validators pass. |

---

## 6. Micro-release template

Every implementation issue or release card should use this shape.

| Field | Required content |
|---|---|
| Release slice ID | Stable ID, e.g. `R2.1`. |
| README anchor | Relevant README sections/gates. |
| User/operator benefit | One-sentence benefit. |
| Scope | Small, concrete behaviour. |
| Non-goals | What remains blocked or intentionally omitted. |
| Artefacts | Runtime artefacts touched or emitted. |
| Public/private boundary | What can and cannot surface. |
| Automation | Tests, validators, metrics or Storage checks. |
| Human role | None by default; specify only if governance or active-learning review is required. |
| Good-enough acceptance | Minimum passing criteria for this slice. |
| Rollback/suppression | Flag, revert or suppression path. |

A slice that cannot fill this template is too broad or not yet designed.

---

## 7. Upfront design packet template

Before implementation starts, write a design packet with:

```text
Problem:
Target behaviour:
README anchors:
Affected gates:
Changed artefacts/contracts:
Public output permissions:
Feature flag / suppression path:
Acceptance tests:
Known non-goals:
Rollback plan:
Open questions:
```

Open questions should be resolved before implementation unless they are explicitly de-scoped. Do not leave unresolved design questions for code review to discover.

---

## 8. User-value ladder

The roadmap should move user-facing usefulness forward in small safe steps:

1. **Make the run auditable** — users may not see this, but the team can trust what happened.
2. **Make the brief understandable** — show what was asked, what is known and what is ambiguous.
3. **Make achievement visible** — show achieved / partly achieved / not achieved / not assessable for brief requirements.
4. **Make readiness clearer** — explain whether the tape is ready at the selected level and why.
5. **Make fixes useful** — prioritise the next take actions with evidence and no padding.
6. **Make specialist feedback safer** — use descriptors before public named technique authority.
7. **Make repertoire context cautious** — use brief/research/library context only with evidence and caveats.
8. **Make comparison safe** — compare only when explicitly invoked and suppress false winners.
9. **Make production release possible** — close L2, L3, L4 and RC gates.

This ladder prevents waiting for perfect specialist intelligence before improving the everyday report.

---

## 9. Aligned release train

The README R0–R16 release train remains the canonical release family structure. This roadmap adds smaller slices inside those families so development can proceed often and safely.

### R0 — Current S9 baseline

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R0.1` S9 status board | Team sees current truth without false promotion. | Display/record current S9 artefact state and blockers. | S9 emitted state, Level 2 `not_accepted`, public/production blockers visible. | L2, production-safe, public scoring, public technique authority, comparison proof. |
| `R0.2` Roadmap/README sync | Prevents implementation drift. | Replace roadmap-as-requirements with roadmap-as-index. | Roadmap points to README for gates and does not introduce new permissions. | All product gates unchanged. |

### R1 — Level 2 decomposition and contract hardening

| Slice | Benefit | Scope | Good-enough acceptance | Human role |
|---|---|---|---|---|
| `R1.1` Contract pack | Prevents design-through-review. | Schema-version policy, manifest schema, acceptance metrics schema, path register, fixture registry, validator rule ID convention. | Contract tests pass; no deep feature implementation depends on unresolved contracts. | One upfront design approval only. |
| `R1.2` Stage atomicity and retry rules | Prevents partial artefact confusion. | `AnalysisEvidenceState` persistence/failure handling, retry idempotency, Storage circuit breaker. | Step 2 cannot consume failed/partial Step 1 output; manifest records failures truthfully. | None by default. |
| `R1.3` L2 sub-gate dashboard | Makes progress visible. | L2-A/L2-B/L2-C/L2-D/L2-E status classification. | Dashboard/metrics cannot mark a sub-gate passed without README evidence. | Release governance only for status changes. |

### R2 — Brief achievement MVP

| Slice | Benefit | Scope | Good-enough acceptance | Public/private boundary |
|---|---|---|---|---|
| `R2.1` Brief requirement itemisation | User sees what TapeCoach thinks the task asks for. | Parse supplied brief into requirement candidates and obligation class. | Requirements are itemised; ambiguous items stay ambiguous; no invented brief items. | Locked-down only until validators pass. |
| `R2.2` Brief achievement summary | User sees achieved / partly achieved / not assessable. | Judge each assessable requirement using available evidence. | Mandatory assessable missing items reduce readiness; not assessable is not treated as failure. | Public wording gated by `PublicClaimTrace`. |
| `R2.3` Brief-driven priority fixes | User sees what to fix first. | Link brief gaps to `priority_fixes[]` and action plan. | Highest-impact brief gap appears before secondary refinements. | No technique success claim unless evidence supports it. |

### R3 — Technique standards foundation without public authority

| Slice | Benefit | Scope | Good-enough acceptance | Human role |
|---|---|---|---|---|
| `R3.1` Minimal technique standard schema | Gives implementation a shared internal vocabulary. | Technique/skill-family entries for a small seed set. | Definitions, evidence requirements, assessability limits and safe descriptors exist for seed set. | Design approval only. |
| `R3.2` Automated candidate queue | Starts learning without manual bottleneck. | System proposes uncertain/high-value examples for review. | Candidates are isolated from accepted standards and cannot affect public output directly. | None during runtime. |
| `R3.3` Batched high-value review tasks | Uses humans only where useful. | Pairwise/presence/characteristic review for prioritised candidates. | Review updates benchmark candidates, not public authority. | Batched review only. |

### R4 — Brief-requested technique handling

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R4.1` Requested technique extraction | User sees that the requested skill was understood as a requirement. | Extract named techniques/skills from brief/material. | The system may reference the requested term as a brief requirement. | Claiming demonstrated success remains gated. |
| `R4.2` Observability and absence handling | User sees whether the requirement is present, absent or not assessable. | Check tape evidence and assessability. | Absent mandatory assessable technique affects readiness; cropped/inaudible remains not assessable. | Public named technique authority remains blocked. |
| `R4.3` Safe descriptor feedback | User gets practical advice without unsafe authority. | Use plain descriptors where public naming is not allowed. | Descriptor is evidence-linked and validator-approved. | Public named technique authority. |

### R5–R6 — Knowledge provenance and controlled research

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R5.1` Knowledge provenance trace | Prevents unsupported specialist claims. | Track source type, authority tier, confidence, freshness, review status and public-claim status. | Claims have source metadata; no rights/licensing fields are added as system gates. | Public authority where gates have not passed. |
| `R6.1` Research invocation decision | Avoids research-on-every-run behaviour. | Invoke controlled research only when accepted library coverage is missing, stale, conflicting or too thin for the supplied brief/material. | Accepted coverage suppresses research; missing/stale/conflicting coverage can trigger cautious research. | Definitive public authority. |
| `R6.2` Cautious research-supported descriptors | Keeps feedback specific without overclaiming. | Use provisional context to focus analysis and wording. | Wording stays cautious and cross-referenced with brief and tape evidence. | Definitive show/number claims. |

### R7 — Repertoire / show / number intelligence

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R7.1` Repertoire resolver | User sees supplied show/number context handled carefully. | Resolve show, number, role, cut or material context where confidence is high enough. | Ambiguous or conflicting context is caveated or blocked. | Public repertoire authority. |
| `R7.2` Repertoire-to-technique mapping | Feedback becomes material-aware. | Map context to technique/style demands internally. | Mapping informs analysis only when evidence and source state support it. | Definitive repertoire claims. |
| `R7.3` Repertoire-informed safe feedback | User gets cautious material-aware guidance. | Preserve/improve/next-take advice from supported context. | No copied choreography, no definitive production expectation, no unsupported style claim. | Public repertoire claims unless gates pass. |

### R8 — Trace closure and independent gate proof

| Slice | Benefit | Scope | Good-enough acceptance | Human role |
|---|---|---|---|---|
| `R8.1` Real-runtime evidence linkage | Makes report claims defensible. | Replace legacy-derived anchor/claim satisfaction with real runtime v3 linkage for scoped fixtures. | `legacy_adapter` remains insufficient; `real_runtime_v3` links pass referential-integrity checks. | None by default. |
| `R8.2` ModelRunTrace per stage | Debugs model route, fallback and variance. | Emit safe per-stage model-run metadata. | Stage traces are present for invoked model stages and raw prompts/responses are not stored. | None. |
| `R8.3` ValidatorTrace and GateTrace | Shows why output can or cannot render. | Emit validator results and gate decisions. | GateTrace permissions are explicit; blocked permissions remain blocked. | Governance only for gate decisions/overrides. |

### R9 — Render, parity and no-export proof

| Slice | Benefit | Scope | Good-enough acceptance | Public/private boundary |
|---|---|---|---|---|
| `R9.1` Render permission enforcement | Prevents unsafe content surfacing. | Render reads `GateTrace.public_output_permissions`. | Public score, public technique names, repertoire claims and comparison recommendations suppress when permission is false. | Must not leak internal traces. |
| `R9.2` Report parity | Confirms visible report matches validated payload. | Render payload + rendered report + parity result. | Parity failures block dependent gates. | No customer-facing release. |
| `R9.3` Export/no-export proof | Prevents hidden leakage path. | Prove export absent or export parity. | No-export source/config/UI/log proof or export parity exists. | Export remains blocked until proof. |

### R10 — PublicReportV3-A locked-down report value

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R10.1` Readiness-first report shell | User sees the right report order. | Readiness, brief achievement, why, priorities, strengths, gap, action plan, limitations. | Report answers core TapeCoach questions for scoped fixtures. | Customer-facing release. |
| `R10.2` Priority-fix and action-plan normalisation | User knows what to do next. | Ensure priority fixes and action plan cover meaningful improvements. | No single-item collapse where multiple evidence-supported actions exist. | Public scoring/authority. |
| `R10.3` Product usefulness test loop | Validate usefulness without redesigning through review. | Approved testers assess clarity/actionability/safety against a rubric. | Review verifies the designed report; design changes become next slices. | Broad release. |

### R11 — Specialist descriptor mode

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R11.1` Technique-informed safe descriptors | More specific feedback without unsafe naming. | Descriptor-only specialist feedback. | Evidence-linked, level-relative, safe wording, no public named technique unless authority passes. | Public technique authority. |
| `R11.2` Discipline-specific validator upgrades | Better MT/Dance/Acting/Voice/Commercial feedback. | Add branch-specific checks. | Generic phrases are rewritten/suppressed; no padding. | Production-safe status. |

### R12 — Public authority candidates

| Slice | Benefit | Scope | Good-enough acceptance | Human role |
|---|---|---|---|---|
| `R12.1` Candidate promotion board | Makes authority decisions explicit. | Identify technique/repertoire terms eligible for public authority review. | Candidate state is separate from accepted public authority. | Batched expert/release review only. |
| `R12.2` Limited public authority promotions | Carefully approved specialist language enters locked-down reports. | Promote only selected terms/claims where README gates pass. | Benchmarks, evidence, source stability, wording and validator proof recorded. | Product/release approval required. |

### R13–R14 — Comparison runtime and safety

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R13.1` Invocation record first | Prevents accidental comparison. | Persist `comparison_invocation_record.json` before comparison artefacts. | Ordinary single-take runs do not emit comparison outputs except classified not-applicable/deferred status. | Public comparison. |
| `R13.2` Evidence-delta comparison | Makes comparison auditable. | Comparison raw, evidence delta, duplicate/no-material-difference traces. | Comparison uses evidence deltas, not raw score rank. | Public winner. |
| `R14.1` GF-01 same-video suppression | Prevents false winners. | Duplicate/near-duplicate detection and suppression. | Same/near-identical inputs produce no reliable material difference, tie or suppression unless decisive evidence delta exists. | Public winner until pass. |
| `R14.2` RT-15 repeatability/variance | Prevents unstable recommendations. | Repeatability and route-variance traces. | Variance is classified and recommendations suppress when unreliable. | Public comparison until pass. |

### R15–R16 — Operational readiness and release candidate

| Slice | Benefit | Scope | Good-enough acceptance | Still blocked |
|---|---|---|---|---|
| `R15.1` Operational readiness minimum | Product can be supported in locked-down live use. | Monitoring, alerting, retention/deletion, queue/concurrency, media failure handling. | P0 alert conditions and failure states are visible; corrupt media produces not-assessable/block state. | Customer-facing release. |
| `R15.2` Level 4 locked-down website QA | Real flow is proven. | Complete live website flow with artefact bundles and P0 gates. | Level 4 evidence exists but does not equal release. | RC. |
| `R16.1` Release candidate decision | Customer-facing release can be considered. | P0 clear, rollback, production-safe decision, public scoring/authority decisions. | Release governance records decisions; blocked gates remain blocked if not approved. | Wider release if RC fails. |

---

## 10. Human-intervention policy by area

| Area | Default human involvement | Allowed exception |
|---|---|---|
| Per-run analysis | None. | Operator investigation of failed QA run, not user-facing judgement. |
| Brief achievement | Automated extraction and judgement. | Review fixtures and edge cases, not every user run. |
| Technique/repertoire library | Automated candidate generation. | Batched expert review for promotion/authority. |
| Public wording | Validator and safe templates first. | Product/release review for public authority and overrides. |
| Gate decisions | Validator-generated where possible. | Product owner/release governance only with audit record. |
| Active learning | Candidate queue and prioritisation automated. | Small, high-impact review tasks. |
| Comparison | Explicit invocation only. | Operator/internal or system/internal fixtures under README constraints. |

---

## 11. Review policy

Reviews should reduce risk, not create design.

Use this rule:

1. **Design review before implementation** — confirms the design packet is complete enough.
2. **Implementation review after build** — confirms the implementation matches the design and README.
3. **Acceptance review after deployment where required** — confirms evidence, tests, artefacts and live behaviour.

Repeated review loops indicate the design was not ready. Convert unresolved design issues into the next release slice unless they are P0/P1 blockers for the current slice.

---

## 12. What changed from the previous roadmap

The previous roadmap duplicated large parts of the README and could drift into acting as a second requirements document. This version intentionally removes or de-emphasises duplication.

Main changes:

- roadmap is now explicitly a planning index only;
- detailed type definitions and gate contracts are delegated to README;
- release sequencing is split into smaller slices inside README R0–R16 families;
- locked-down user value is prioritised earlier where safe;
- “good enough” is defined as bounded, safe and useful rather than perfect;
- human review is minimised and batched;
- design-through-review is rejected;
- active learning is automation-first with isolated candidate queues;
- public scoring, public technique authority, public repertoire claims, public comparison winners, production-safe status and customer release remain blocked until README gates pass.

---

## 13. Non-negotiable roadmap controls

| Control | Meaning |
|---|---|
| README wins | This roadmap cannot override README. |
| Small slices | No release slice should bundle unrelated capabilities. |
| Good enough | Safe and useful beats complete and delayed. |
| No design through review | Design before implementation; review validates. |
| Low human burden | No per-run human judgement; review only high-leverage cases. |
| Feature-flag or suppress | New capability must be reversible or suppressible where possible. |
| Gates stay truthful | `emitted` is not `accepted`; `legacy_adapter` is not `real_runtime_v3`. |
| Public authority remains gated | No public scores, public named techniques, definitive repertoire claims or comparison winners without README gate approval. |
| No padding | Do not invent comments, technique claims, repertoire claims, fixes, drills or timestamps. |
| No big drops | Prefer incremental locked-down benefits with honest blockers over large delayed releases. |

---

## 14. Recommended first tranche of release cards

These are the first cards to queue after adopting this aligned roadmap. They should still be executed in dependency order and may be split further if any card becomes too large.

### Card 1 — R1.1 Contract pack

**Benefit:** prevents review-driven redesign and integration churn.  
**Output:** schema-version policy, manifest schema, acceptance metrics schema, path register, fixture registry and validator rule convention.  
**Acceptance:** contract tests pass; no feature implementation relies on unresolved schema/path rules.

### Card 2 — R2.1 Brief requirement itemisation

**Benefit:** users and testers can see what TapeCoach thinks the brief asked for.  
**Output:** itemised requirement trace and safe locked-down summary.  
**Acceptance:** mandatory/preferred/optional/style/admin/technical/material/ambiguous classification works on scoped fixtures; no invented requirements.

### Card 3 — R2.2 Brief achievement MVP

**Benefit:** users and testers can see achieved / partly achieved / not assessable.  
**Output:** brief achievement summary linked to evidence and assessability.  
**Acceptance:** mandatory assessable missing items affect readiness; not assessable does not become performance criticism.

### Card 4 — R8.1 Real-runtime evidence linkage for one scoped fixture family

**Benefit:** moves from first-pass QA traces toward true v3 gate evidence.  
**Output:** `EvidenceAnchors` and `PublicClaimTrace` link to real runtime evidence for scoped fixtures.  
**Acceptance:** legacy/report snapshot traces remain insufficient; real runtime links pass referential-integrity checks.

### Card 5 — R9.1 Render permission enforcement

**Benefit:** the render layer cannot accidentally expose blocked score, technique, repertoire or comparison content.  
**Output:** render enforcement of `GateTrace.public_output_permissions`.  
**Acceptance:** blocked permissions suppress the relevant output even if upstream payloads contain it.

### Card 6 — R10.1 Readiness-first report shell

**Benefit:** locked-down users see a clearer TapeCoach report organised around readiness, brief achievement and next action.  
**Output:** report shell using permitted sections only.  
**Acceptance:** `GateTrace.public_output_permissions` is enforced; no blocked score/technique/repertoire/comparison content renders.

---

## 15. Final roadmap position

TapeCoach should release useful, bounded improvements frequently into the locked-down live product while preserving strict release gates for customer-facing exposure.

The roadmap should help the team choose the next smallest valuable thing, not re-argue the product specification. The README defines what TapeCoach must do; this roadmap defines how to move through that work in small, safe, review-light increments.
