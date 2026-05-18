# TapeCoach v3 Roadmap — Product-manager optimised release plan

**Document status:** PM delivery-sequencing recommendation / planning index only.  
**Aligned to:** latest `README.md` architecture review update, 18 May 2026.  
**Language:** UK English.  
**Release philosophy:** small, frequent, reversible releases that deliver useful locked-down user value quickly, without weakening README gates or turning review into design.

---

## 1. Source hierarchy

`README.md` remains the controlling source for TapeCoach product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions.

This roadmap is a product-delivery sequencing layer. It may organise user-benefit sequencing, release slices, dependencies, non-goals and rollback paths. It must not introduce requirements, public-output permissions, release gates or acceptance decisions that are not already present in `README.md`.

If this roadmap conflicts with `README.md`, `README.md` wins.

---

## 2. Product-manager diagnosis

The current README and roadmap are directionally strong. They correctly define TapeCoach as an evidence-led, level-relative, brief-aware self-tape readiness product, not a JSON-emission project or score-first report.

The current roadmap also has the right principles: small and frequent releases, good enough rather than perfect, minimal human intervention, and upfront design before implementation review.

The main PM issue is sequencing. The roadmap still risks making useful user-facing learning wait behind a long artefact/gate chain. That is safe, but slower than necessary.

The product should not wait for full Level 2 closure, full public technique authority, public scoring, repertoire authority or comparison safety before approved locked-down users can see bounded, useful improvements such as:

- a clearer readiness-first report layout;
- brief requirement itemisation;
- achieved / partly achieved / not assessable status;
- better priority-fix ordering;
- clearer next-take actions;
- safer assessability wording;
- status/failure messaging when analysis is not reliable.

The PM recommendation is to split delivery into two parallel tracks:

1. **Safe visible value track** — gated locked-down report improvements that users/testers can experience quickly.
2. **Evidence/proof track** — artefacts, trace closure, parity, validator and Level 2 gates that make the system trustworthy and releasable.

The visible value track must still obey `GateTrace.public_output_permissions`, public/private boundaries and README safety rules. It should simply avoid waiting for unrelated gates where the relevant output is already safe, suppressed or feature-flagged.

---

## 3. Resequencing decisions

### 3.1 Bring the readiness-first report shell forward

Current roadmap placement has `R10.1 Readiness-first report shell` after trace closure and render/parity work. Product-wise, this is too late.

Move a limited version forward as:

```text
R10.0 Readiness-first preview shell
```

This preview shell should render only sections permitted by `GateTrace.public_output_permissions` and suppress public score, public named technique, definitive repertoire and comparison content. It can still provide user value through readiness, why, brief status, priorities, strengths, improvements, action plan and limitations.

This does not mean customer-facing release. It means approved locked-down users can experience a better report format earlier.

### 3.2 Bring render permission enforcement forward

`R9.1 Render permission enforcement` should move before the first user-visible preview. It is the safety precondition for showing early value without accidentally exposing blocked score, technique, repertoire or comparison content.

### 3.3 Add a submission-context preflight slice

The current roadmap moves from contracts directly into brief itemisation. It should add a small user-facing preflight slice first:

```text
R2.0 Submission context preflight
```

This slice confirms or captures:

- selected performer level;
- audition type;
- whether a brief/material was supplied;
- whether material is fixed;
- whether comparison is requested or not;
- whether media is ready and assessable enough to proceed.

This improves downstream accuracy and reduces avoidable “not assessable” or invented-context failures.

### 3.4 Split operational readiness into early and late parts

Full operational readiness can remain R15, but a small locked-down support baseline should come much earlier:

```text
R1.4 Locked-down processing and failure-state UX
```

Users and testers need to know whether a tape is uploading, processing, failed, not assessable, or awaiting artefact/gate completion. This is product value, not only operations.

### 3.5 Delay active-learning queues until after the brief/readiness MVP

`R3.2 Automated candidate queue` and `R3.3 Batched high-value review tasks` are valuable, but they do not maximise immediate user value. Keep `R3.1 Minimal technique standard schema` where it supports safe descriptors and requested-technique handling, but move active-learning workflow after:

- brief achievement MVP;
- readiness-first preview shell;
- priority/action-plan normalisation;
- at least one locked-down usefulness loop.

Active learning should mature from observed product gaps, not before the product has enough visible behaviour to learn from.

### 3.6 Keep comparison late

Comparison remains high-risk because false winners are P0. It should stay after single-take report value, trace proof and safety gates. The only early comparison work should be invocation discipline and proof that ordinary single-take runs do not accidentally emit comparison outputs.

### 3.7 Keep public scoring late or optional

Do not make public raw score exposure a near-term product goal. Users can receive high value from qualitative readiness, gap-to-level and prioritised fixes. Public scoring should remain blocked until the README criteria pass.

---

## 4. Product outcome metrics

Each slice should report whether it improved the user’s ability to answer the core TapeCoach questions.

Minimum product metrics for locked-down validation:

| Metric | Why it matters | Collection method |
|---|---|---|
| Submit/retake clarity | Core product question. | Tester rubric: “Can you tell whether this tape is ready to submit at the selected level?” |
| Top-fix clarity | Converts feedback into action. | Tester rubric: “Can you identify the top 1–3 things to change in the next take?” |
| Brief understanding | Tests whether the system understood the task. | Compare generated requirement list to supplied brief. |
| Brief achievement trust | Tests whether achieved / not achieved / not assessable feels grounded. | Fixture expectation + tester review. |
| Actionability | Ensures feedback is not generic. | Count evidence-linked priority fixes and action-plan items. |
| Assessability honesty | Prevents unfair performance criticism. | Validator + tester check for “not assessable” vs “not achieved”. |
| Suppression quality | Confirms blocked content does not leak. | GateTrace/render parity checks. |
| Time to useful report | Product experience, not just model latency. | Locked-down telemetry from submit to report-ready state. |
| Re-run usefulness | Tests next-take loop. | Tester submits revised/paired take and assesses whether feedback helps. |

Do not require these as public-release gates unless README is updated. Use them to prioritise product delivery and avoid building invisible artefacts at the expense of user value.

---

## 5. Revised user-value ladder

The product should advance in this order:

1. **Make the run trustworthy enough to inspect** — S9 truth, no false Level 2 promotion.
2. **Make the user context explicit** — selected level, audition type, brief/material state and media readiness.
3. **Make the report readable earlier** — readiness-first preview shell with blocked sections suppressed.
4. **Make the brief understandable** — itemise what was asked.
5. **Make achievement visible** — achieved / partly achieved / not achieved / not assessable.
6. **Make fixes useful** — priority fixes, next-take checklist and action plan.
7. **Make evidence stronger** — real-runtime evidence linkage for the visible sections first.
8. **Make render safe** — permissions, parity and no-export proof for preview/report surfaces.
9. **Make specialist feedback safer** — descriptor-first technique feedback before public named authority.
10. **Make repertoire helpful but cautious** — only when brief/research/library support it.
11. **Make comparison safe** — explicit invocation, evidence delta, GF-01 / RT-15.
12. **Make broad release possible** — Level 2, Level 3, Level 4 and RC evidence.

This ladder keeps the “good enough” principle real: users get useful, bounded improvements before the full system is perfect.

---

## 6. PM-optimised first tranche

These cards should be queued first. They are intentionally small and reversible.

| Order | Slice | User/operator benefit | Scope | Good-enough acceptance | Still blocked |
|---:|---|---|---|---|---|
| 1 | `R0.3` Current report usefulness baseline | Establishes what users cannot currently answer. | Run current locked-down product/fixtures through a simple usefulness rubric. | Baseline records submit/retake clarity, top-fix clarity, brief understanding and obvious failure modes. | No product gate changes. |
| 2 | `R1.1A` Thin contract pack | Prevents design-through-review without delaying product work. | Only contracts needed for the first visible preview: schema version, path register, manifest/metrics minimum, rule ID convention. | Contract tests pass for first tranche; non-essential contract depth is deferred. | Full L2 remains blocked. |
| 3 | `R1.4` Locked-down processing and failure-state UX | Users/testers understand what is happening. | Processing, failed, not assessable, media-not-ready and artefact/gate-blocked states. | No silent failures; corrupt/unready media gives a clear safe state. | Customer-facing release. |
| 4 | `R9.1A` Render permission enforcement | Enables safe early preview. | Render reads and enforces `GateTrace.public_output_permissions`. | Blocked score, technique, repertoire and comparison content suppress even if upstream payload contains it. | Full parity/no-export proof. |
| 5 | `R10.0` Readiness-first preview shell | Users see a clearer TapeCoach report earlier. | Readiness, why, priorities, strengths, improvements, action plan, gap, limitations; omit/suppress blocked sections. | Approved locked-down users can answer “submit or retake?” and “what should I fix first?” | Public scoring, public technique, repertoire, comparison, customer release. |
| 6 | `R2.0` Submission context preflight | Reduces wrong assumptions and invented context. | Confirm selected level, audition type, brief/material presence, fixed-material status and media readiness. | Missing/ambiguous context is visible and routed to safe no-brief/unknown handling. | Public release. |
| 7 | `R2.1` Brief requirement itemisation | User sees what TapeCoach thinks the task asked for. | Parse brief into mandatory/preferred/optional/style/material/technical/admin/ambiguous items. | No invented requirements; ambiguous items stay ambiguous. | Claiming technique success. |
| 8 | `R2.2` Brief achievement MVP | User sees achieved / partly achieved / not assessable. | Judge each assessable requirement using available evidence. | Mandatory assessable missing items reduce readiness; not assessable does not become performance criticism. | Full L2 closure. |
| 9 | `R2.3` Brief-driven priority fixes | User knows what to fix first. | Link brief gaps to priority fixes and action plan. | Highest-impact brief gap appears before secondary refinements. | Public named technique authority. |
| 10 | `R10.2A` Action-plan and next-take checklist | Converts feedback into action. | Normalise priority fixes into a concise next-take checklist. | Every meaningful improvement is represented; no generic filler or single-item collapse. | Public score/authority. |
| 11 | `R8.1A` Real-runtime evidence linkage for preview sections | Makes visible report claims defensible. | Real-runtime evidence links for readiness, brief achievement, priority fixes and limitations on scoped fixtures. | `legacy_adapter` remains insufficient; scoped `real_runtime_v3` links pass referential integrity. | Full L2-A. |
| 12 | `R10.3A` Locked-down usefulness loop | Validates value without redesigning in review. | Approved testers use a fixed rubric on the preview report. | Review verifies the designed behaviour; design changes become future slices unless P0/P1. | Broad release. |
| 13 | `R9.2A` Preview parity and leakage proof | Confirms what users see matches permitted payload. | Render payload, rendered report, parity, leakage and UK English checks for preview surfaces. | Parity/leakage failures block preview expansion. | Full export/no-export proof if not in scope. |
| 14 | `R15.0` Locked-down operations minimum | Makes early usage supportable. | Basic monitoring, P0 alert conditions, retention/deletion handling for locked-down QA, queue/failure visibility. | Operators can see failed runs and suppress/retry safely. | Customer-facing release. |

---

## 7. Revised release train by product stage

### Stage A — Safe preview foundation

Goal: make it safe to show bounded report improvements to approved locked-down users.

Includes:

- `R0.3` current usefulness baseline;
- `R1.1A` thin contract pack;
- `R1.2` stage atomicity for first tranche;
- `R1.4` processing/failure-state UX;
- `R9.1A` render permission enforcement;
- `R10.0` readiness-first preview shell.

Do not wait for full L2 closure before this stage, but keep all blocked content suppressed.

### Stage B — Brief-first MVP

Goal: answer “what did the brief ask for, and did the tape achieve it?”

Includes:

- `R2.0` submission context preflight;
- `R2.1` brief requirement itemisation;
- `R2.2` brief achievement summary;
- `R2.3` brief-driven priority fixes.

This should be the primary early user-benefit release family.

### Stage C — Actionability and report quality

Goal: make the report useful enough that a performer knows what to do next.

Includes:

- `R10.2A` action-plan and next-take checklist;
- timestamp depth and underproduction diagnostics for scoped fixtures;
- assessability wording improvements;
- component breakdown only where it adds user value;
- `R10.3A` usefulness loop.

This stage should avoid public scores and public technique authority.

### Stage D — Evidence proof for the visible product

Goal: make the visible report defensible and release-gate ready.

Includes:

- `R8.1A` real-runtime evidence linkage for preview-visible sections;
- `R8.2` per-stage ModelRunTrace;
- `R8.3` ValidatorTrace and GateTrace;
- `R9.2A` parity/leakage/UK English for preview-visible sections;
- then full R8/R9 closure for Level 2 scope.

This stage converts useful preview behaviour into stronger release evidence.

### Stage E — Specialist descriptors before public authority

Goal: improve specificity without waiting for named technique authority.

Includes:

- `R3.1` minimal technique/skill-family standards for selected seed set;
- `R4.1` requested technique extraction;
- `R4.2` observability/absence/not-assessable handling;
- `R4.3` safe descriptor feedback;
- `R11.1` technique-informed safe descriptors;
- `R11.2` discipline-specific validator upgrades.

Move `R3.2` and `R3.3` active-learning workflows after there is enough preview/report usage to generate meaningful candidates.

### Stage F — Knowledge and repertoire

Goal: make material-aware feedback more specific without overclaiming.

Includes:

- `R5.1` knowledge provenance trace;
- `R6.1` research invocation decision;
- `R6.2` cautious research-supported descriptors;
- `R7.1` repertoire resolver;
- `R7.2` repertoire-to-technique mapping;
- `R7.3` repertoire-informed safe feedback.

Do not let repertoire work block brief-first or readiness-first value.

### Stage G — Public authority candidates

Goal: promote only proven specialist/repertoire claims.

Includes:

- `R12.1` candidate promotion board;
- `R12.2` limited public authority promotions.

This remains human-light but not human-free, because authority promotions need governance.

### Stage H — Comparison runtime and safety

Goal: compare only when explicitly invoked and avoid false winners.

Includes:

- `R13.1` invocation record first;
- `R13.2` evidence-delta comparison;
- `R14.1` GF-01 same-video suppression;
- `R14.2` RT-15 repeatability/variance.

Comparison should not be an early user-value dependency. Single-tape clarity is more important and lower risk.

### Stage I — Operational readiness and release candidate

Goal: decide whether broader release is possible.

Includes:

- remaining `R15.1` operational readiness requirements;
- `R15.2` Level 4 locked-down website QA;
- `R16.1` release candidate decision;
- public scoring/authority decisions only where README gates pass.

---

## 8. Missing product slices to add

### 8.1 Submission context preflight

Add before brief parsing. Without it, the system may over-rely on resolver inference and produce avoidable ambiguity.

### 8.2 Processing/failure-state user experience

Users need clear status when analysis is processing, blocked, failed, not assessable or awaiting artefact/gate proof.

### 8.3 Readiness-first preview shell

Move earlier than current `R10.1`. This is the fastest route to visible benefit.

### 8.4 Next-take checklist

The report should end with a concise “record the next take like this” checklist derived from priority fixes and action plan.

### 8.5 User usefulness rubric

Add fixed locked-down tester questions:

```text
Can you tell whether to submit or retake?
Can you name the top 1–3 fixes?
Do the brief requirements look correct?
Does not-assessable feel fair?
Is anything too generic?
Is anything overconfident?
Would this change your next take?
```

### 8.6 Product telemetry for early slices

Track report-ready time, failure states, suppression counts, brief itemisation count, priority-fix count and user/tester usefulness scores. Keep telemetry internal and private.

### 8.7 Vertical-slice discipline strategy

Do not attempt all disciplines, all levels and all brief types in the first value release. Start with a small fixture-backed vertical slice, then expand.

Recommended first vertical slice:

```text
single-take, brief-supplied, fixed-material audition,
with selected level known,
with no public score, no public named technique authority,
no public comparison and no definitive repertoire authority.
```

Then add one discipline at a time based on fixture readiness and user demand.

---

## 9. What should be de-emphasised early

The following work is valuable but should not block early locked-down user value:

| Work | PM recommendation |
|---|---|
| Public raw score exposure | Keep blocked; qualitative readiness is enough early. |
| Public named technique authority | Use safe descriptors first. |
| Definitive repertoire/show claims | Use cautious brief/material context first. |
| Comparison winners | Keep late; false winners are P0. |
| Full active-learning workflow | Start after visible product behaviour creates useful candidates. |
| Full customer-facing release proof | Keep gated; do not confuse locked-down preview with release. |

---

## 10. Revised first release-card queue

Queue in this order unless an engineering dependency makes a smaller split necessary:

1. `R0.3` Current report usefulness baseline.
2. `R1.1A` Thin contract pack for first tranche.
3. `R1.4` Locked-down processing/failure-state UX.
4. `R9.1A` Render permission enforcement.
5. `R10.0` Readiness-first preview shell.
6. `R2.0` Submission context preflight.
7. `R2.1` Brief requirement itemisation.
8. `R2.2` Brief achievement MVP.
9. `R2.3` Brief-driven priority fixes.
10. `R10.2A` Action-plan and next-take checklist.
11. `R8.1A` Real-runtime evidence linkage for preview sections.
12. `R10.3A` Locked-down usefulness loop.
13. `R9.2A` Preview parity/leakage/UK English checks.
14. `R15.0` Locked-down operations minimum.

This queue gives users a better, safer, more useful single-tape report earlier while the engineering track continues closing evidence and release gates.

---

## 11. README suggestions from PM review

The README does not need a major rewrite. Its current product direction is strong.

Recommended lightweight additions, if the README owner wants to make the product-delivery philosophy controlling rather than roadmap-only:

1. Add a short “product delivery principle” note: safe locked-down value may be previewed before full customer-facing release if `GateTrace.public_output_permissions` permits the specific output.
2. Add product outcome metrics as non-gate learning metrics.
3. Add “next-take checklist” as an acceptable public report shape under `Action plan`.
4. Add processing/failure-state UX to operational readiness or media readiness.
5. Clarify that public raw score exposure is not needed for early product value.

These are PM suggestions only. They do not unblock public scoring, public technique authority, public repertoire claims, comparison winners or customer-facing release.

---

## 12. Non-negotiable controls preserved

This PM resequencing preserves:

- README wins over roadmap;
- S9 is not Level 2;
- `legacy_adapter` is not `real_runtime_v3`;
- public scoring remains blocked;
- public technique authority remains blocked;
- public repertoire authority remains blocked;
- public comparison winners remain blocked;
- comparison cannot run by default for ordinary single-take analysis;
- customer-facing release remains blocked until RC gates pass;
- no per-run human judgement;
- no design-through-review;
- no invented timestamps, technique claims, repertoire claims, fixes or padded feedback.

---

## 13. Final PM position

The biggest opportunity is not to accelerate every feature. It is to accelerate the right visible value:

```text
First make the report easier to trust, understand and act on.
Then make the proof spine stronger.
Then expand specialist depth.
Then add repertoire and comparison.
Then decide on public scoring, public authority and customer release.
```

The fastest useful product path is:

```text
safe preview shell
→ context preflight
→ brief itemisation
→ brief achievement
→ priority fixes
→ next-take checklist
→ scoped real-runtime evidence
→ parity/leakage proof
→ broader specialist and release gates
```

This keeps the product honest while giving approved locked-down users meaningful benefit much sooner.
