# TapeCoach engineering lessons and guardrails

## Purpose
This document is the single cumulative, source-controlled lessons document for TapeCoach engineering execution, including Codex/agent implementation practice. Update it whenever repeated P1/P2 churn occurs, after major incident recovery, or at release-slice closeout.

## Source hierarchy
- `README.md` controls product behaviour, report requirements, scoring rules, QA artefacts, public/private boundaries and release decisions.
- `tapecoach-v3-parallel-delivery-approach.md` controls delivery sequencing only.
- `tapecoach-v3-roadmap.md` is a planning index only.
- This guardrails document does not override `README.md`.

## Non-negotiable execution lessons
- Codex completion is not acceptance.
- Acceptance requires tests, build, artefact evidence, manifest/QA metrics evidence, live validation where scoped, clean git status, and release-gate confirmation.
- The first failing test gate must be classified before patching.
- Do not broaden scope while fixing a narrow bug.
- Do not mark merge-ready while tests/build are incomplete.
- Clean generated artefact churn before commit.
- Do not use roadmap material to override README product requirements.

## Architecture lessons from S9-12
- Low-level artefact emission and high-level reconciliation must stay separate.
- Strict manifest preflight must not be wired into low-level helper paths.
- Operator/internal comparison uses `manifest_reconciliation_mode: "required"`.
- Required comparison mode must reconcile comparison artefacts, `manifest.json` and `qa/acceptance_metrics.json` together.
- `comparison_run_id` and `compared_take_ids` must propagate into comparison artefacts, manifest and `qa_acceptance_metrics`.
- Canonical identity is raw take core plus `take-[core]` run identity.
- `take-take-*` and nested take-prefixed identities are invalid.
- Read root, comparison write root, manifest rewrite root and metrics rewrite root must match.
- Level 2/public/production gates remain blocked unless separately accepted.

## Testing guardrails
- Write regression tests before fixing live artefact bugs.
- Test low-level/default mode and required mode separately.
- Required-mode success tests must seed canonical prior manifest.
- Required-mode failure tests must prove no writes on missing/malformed/identity mismatch.
- Assert no `take-take` path/key appears.
- Assert root-match diagnostics where available.
- Preserve non-comparison manifest state.
- Prove Level 2 remains `not_accepted` and public/production gates remain blocked.
- Full wildcard failures must be classified even if not used as merge gate.

## Codex prompt design guardrails
- Avoid broad all-in-one prompts for high-risk architecture changes.
- Use small checkpointed chunks.
- Inspect the call graph before wiring behaviour into shared functions.
- Prefer thin wrappers/adapters over forcing behaviour into low-level helpers.
- Stop when the first gate fails.
- Require a final repository audit and, where relevant, live artefact validation.

## Known recurring pitfalls
- Confusing raw `take_id` with `take-[id]` analysis/run identity.
- Accidentally creating `take-take-*` roots.
- Treating emitted internal QA artefacts as Level 2 acceptance.
- Treating `legacy_adapter` traces as real runtime v3 proof.
- Letting comparison files exist while manifest/metrics remain stale.
- Failing to propagate `comparison_run_id` or `compared_take_ids` into reconciled outputs.
- Collapsing unreadable storage errors into missing.
- Reusing stale preview URLs or Lovable worker bundle failures as product-code evidence.
- Ignoring `routeTree.gen.ts` or `qa-artifacts` generated churn.

## Update rule
Update this document after:
- repeated P1/P2 review churn;
- live artefact reconciliation failures;
- high-risk delivery failures;
- major release-slice closeout.

## Non-goals
- This document does not approve Level 2.
- It does not approve public scoring.
- It does not approve public technique authority.
- It does not change public report output.
- It does not override `README.md`.
