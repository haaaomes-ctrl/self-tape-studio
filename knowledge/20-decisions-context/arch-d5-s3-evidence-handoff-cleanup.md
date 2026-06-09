---
id: arch-d5-s3-evidence-handoff-cleanup
title: Δ5-S3 — clean the Step-1→Step-2 evidence handoff (full located-evidence set routed through the suppression-safe filter; downstream projection workaround retired)
tier: corpus
status: current
spine_anchor: ["ADR-0008", "plan-d5-evidence-anchors §6 (Δ5-S3 / D5.5)"]
decided_ref: "Δ5 ratified plan (SRO 2026-06-08), §6 + D5.5"
supersedes: []
superseded_by: null
source: claude-code
source_ref: "Δ5-S3 build"
discipline: null
monday_ref: "2967708093"
tags: [arch-deltas, evidence-anchors, evidence-pass, two-step, handoff, score-model]
confidence: high
created: 2026-06-09
updated: 2026-06-09
---

## Decision

Route the full located-evidence set through the Step-1→Step-2 pass natively and retire the downstream `projectFilteredStep1EvidenceForPolish` workaround. The compact (`plain_json_observations`) Step-1 contract carries timestamps and technique candidates inside `step1_observations`; the EvidencePass it builds hardcodes `timestamped_evidence: []` and `candidate_technique_evidence: []`. Previously a downstream projection re-derived those two arrays from the S9-suppression-safe filtered output purely so Step 2 would not collapse to the evidence-only fallback shell — the located set was reconstructed twice (once for QA, once for the polish).

## Root cause

`normaliseCompactStep1EvidenceForEvidencePass` (`evidence-pass.server.ts`) emits the two arrays empty; the derivation lived as a downstream patch in `process-take.server.ts`, wired only after the filter. The defect is the missing native route, not the derivation itself.

## Fix

The derivation is relocated into the filter's result-builder (`buildFilteredStep1Result`), the single point at which S9 suppression has already been applied, and exposed as two new fields on `FilteredRunEvidencePassStep1` (`step2_timestamped_evidence`, `step2_candidate_technique_evidence`; named distinctly to avoid the existing differently-shaped `candidate_technique_evidence`). Step 2 reads them natively, preserving the native-arrays-win precedence for the `tool_call` contract. The derivation logic is unchanged (same source items, dedup, `filteredItemCategory` mapping, 36/12 caps) — byte-identical output, which the dry-run-parity gate enforces. Deriving from raw observations in the normaliser was rejected: it would bypass suppression (a safety regression).

## Scope boundary

S3 is the handoff cleanup only. The guard-move (running `applyObservationIdIntegrityGuard` ahead of Step 2, deferred from S2) and finer per-observation `supported_by` anchoring are explicitly NOT in S3 — S2 shipped and live-validated without them, so they are refinements, not defects, and a risky ID-mutation change does not belong in a parity-sensitive plumbing PR.

## Gate

Dry-run parity (Step-2 polish input byte-identical for both contracts); no fallback-shell collapse; canary-A zero gate actions; tsc/eslint/prettier clean; vitest green with no new failures. No migration.

## Links

[[plan-d5-evidence-anchors]] · [[arch-d5-s2-per-dimension-anchor-binding]] · [[arch-report-derivation-architecture]] · ADR-0008 (docs/architecture/adr/) · Monday Δ5 2967708093.

## Results

- Branch / PR: `worktree-d5-s3-evidence-handoff` (based on origin/main `16328a4c`). PR held for senior-dev review (not yet opened).
- What changed (files + line ranges):
  - `src/server/evidence-pass.server.ts` — renamed `projectFilteredStep1EvidenceForPolish` → `deriveStep2LocatedEvidenceFromFilteredStep1` (still exported, body byte-identical, ~`:2394`); added `step2_timestamped_evidence` + `step2_candidate_technique_evidence` to `FilteredRunEvidencePassStep1` (after `observable_evidence_items`, ~`:1599`); `buildFilteredStep1Result` now builds an intermediate `base` (the result minus the two fields), runs the derivation over it, and returns the object with the two `step2_*` fields populated (~`:2488`).
  - `src/server/process-take.server.ts` — removed the `projectFilteredStep1EvidenceForPolish` import (`:21`); replaced the downstream projection block (~`:4106-4148`) to source the two arrays from `filteredStep1Evidence.step2_timestamped_evidence` / `.step2_candidate_technique_evidence`. Native-arrays-win precedence and the `s10_step1_evidence_projected_for_polish` metric (same name + same DERIVED-items-used count semantics via the existing `projectedTimestampedUsed`/`projectedTechniqueUsed` gating) preserved.
  - Tests re-pinned (intent preserved, none weakened/deleted): `s10-report-polish-recovery-wiring.test.ts` (~`:68-71`) now asserts the `step2_timestamped_evidence` / `step2_candidate_technique_evidence` wiring + the unchanged metric symbol; `s10-tape-observation-component-verification.test.ts` (`:8`, `:415`, `:417`) re-pointed to `deriveStep2LocatedEvidenceFromFilteredStep1`, all behavioural expectations unchanged.
- Dry-run parity outcome: `npm run dry-run:analysis-worker` succeeded (worker bundles clean, TanStack-free). Located-evidence set fed to Step-2 is byte-identical: the derivation body is unchanged and receives the same `observable_evidence_items` union + `candidate_technique_evidence` input as the retired projection; metric counts unchanged under the same gating conditions.
- Deviations / decisions made: none. Spec followed exactly. Prettier only reflowed the `deriveStep2...(base as ...)` call onto one line (cosmetic).
- Follow-ups / new open questions: none. Guard-move and per-observation `supported_by` anchoring remain explicitly out of S3 scope.
