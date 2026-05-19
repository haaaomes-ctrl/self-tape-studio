# S9-13D Comparison Parity Proof Contract

Status: Design contract (implementation-facing)
Scope: Internal QA artefact `parity/comparison_parity.json` and manifest/metrics parity gating semantics for comparison-invoked runs.

## Baseline S9-13D invariants

1. Comparison parity is required only when comparison is invoked.
2. Ordinary single-take/non-comparison runs remain `parity_comparison = not_applicable`.
3. Comparison-invoked runs must not pass parity solely on artefact presence.
4. Missing required evidence or missing risk context yields non-satisfying parity (`insufficient` or `failed`) and keeps `parity_artefacts_missing` blockers.
5. Any forbidden public comparison leakage yields `failed`.
6. Level2/public/production gates remain blocked unless all independent gates satisfy.

---

## Amendment: Nested trace risk extraction and precedence (P1 regression hardening)

### 1) Nested trace risk extraction (required)
Comparison parity risk extraction MUST inspect both:
- top-level `comparison_payloads` fields; and
- nested emitted trace payloads under known trace keys.

Known trace keys in risk extraction scope:
- `same_video_repeatability_trace`
- `route_variance_trace`
- `comparison_suppression_trace`
- `comparison_raw`
- `comparison_report_internal`

Design requirement:
- risk evaluation is the union of top-level and nested findings.
- absence of nested inspection is contract-noncompliant.

### 2) Same-video risk conditions
Parity MUST fail or block when any of the following are true in top-level or nested trace data:
- `same_video_unresolved_risk === true`
- `same_video_detected === true` without accepted mitigation
- `repeated_input_detected === true` without accepted mitigation
- `no_material_difference === false` when used as unresolved same-video/no-material-difference marker

### 3) Forced/false winner risk conditions
Parity MUST fail when any of the following are true in top-level or nested trace data:
- `forced_winner_risk === true`
- `false_winner_risk === true`

### 4) Route variance risk conditions
Parity MUST fail or block when any of the following are true in top-level or nested trace data:
- `route_variance_risk === true`
- `route_mismatch_detected === true` without accepted mitigation
- `route_variance_detected === true` without accepted mitigation
- `route_variance_mitigation_status === "unresolved_blocked"`

### 5) Mitigation semantics
Only explicit accepted mitigation statuses MAY neutralise risk.

Accepted mitigation statuses:
- `not_required`
- `mitigated`
- `resolved`
- `accepted`
- `suppressed_internal_only` (only when already approved as safe in existing contract context)

Non-accepted states:
- missing mitigation field
- null/empty/unknown mitigation values

Design rule:
- missing mitigation MUST NOT be treated as accepted mitigation.

### 6) Status precedence
Nested-trace risk has equal precedence to top-level risk.

Status precedence:
- `failed` when explicit risk/leakage is present.
- `insufficient` when risk context is missing/partial/unreadable.
- `passed` only when risk surfaces are inspected and risks are absent or explicitly mitigated.

### 7) Required tests (contract acceptance)
The comparison parity test matrix MUST include:
- nested `same_video_repeatability_trace.same_video_detected` blocks/fails;
- nested `same_video_repeatability_trace.forced_winner_risk` blocks/fails;
- nested `same_video_repeatability_trace.false_winner_risk` blocks/fails;
- nested `route_variance_trace.route_variance_risk` blocks/fails;
- nested `route_variance_trace.route_variance_mitigation_status = unresolved_blocked` blocks/fails;
- nested mitigated/not_required risks do not fail;
- internal-only public-leak lookalike keys do not fail unless they appear in explicit public leakage surfaces.

### 8) Non-goals / unchanged behavior
This amendment does not change:
- public UX/report/scoring output semantics,
- S9-12 reconciliation architecture,
- no-export semantics,
- DB/upload/webhook/admin-button behavior,
- gate unblocking policy.
