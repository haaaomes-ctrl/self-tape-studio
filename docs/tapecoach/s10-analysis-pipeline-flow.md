# S10 Analysis Pipeline — Architecture, Flow & Interconnecting Pathways

> Working memory for the S10 take-analysis pipeline. Captures the end-to-end
> flow, every interconnecting hand-off, and the known data-loss/transform points
> so prompt and code fixes can be targeted precisely. Maintained alongside
> `README.md` (controlling contract), `docs/tapecoach/s10-target-architecture.md`,
> `docs/tapecoach/s10-ai-prompt-map.md`, and `AGENTS.md`.
>
> Doctrine reminder (AGENTS.md): **the AI is the report brain. The only way to
> control its output is through the inputs (prompt + supplied evidence).** Code
> loads inputs, validates structure, detects thin/generic output, re-prompts for
> repair, routes outputs to the UI, applies narrow red-line filtering, emits
> diagnostics. Code must not invent professional judgement.

---

## 1. End-to-end runtime flow

```
Upload (Mux direct upload)
  → Mux webhooks → src/routes/api/public/mux-webhook.ts
      video.upload.asset_created / static_rendition.created / video.asset.ready
      on video.asset.ready: enqueue analysis job
  → src/server/analysis-job-queue.server.ts  (dispatch, 3 branches — see §2)
  → runProcessTake(takeId)  in src/server/process-take.server.ts   (orchestrator)
      Step 1: evidence pass (multimodal, watches video)
      filter + QA projection
      Step 2: report polish (text-only)
      module readiness → repair retry → module-quality recovery/fallback
      decision-critical gate
      score recompute + scrubs + red-line filtering
      v2 route-report build
      persist to public.takes
      credit consume + QA artefacts + analytics/CRM + Mux asset delete
```

### Dispatch branches (§2)
`dispatchAnalysisJob` (analysis-job-queue.server.ts) chooses, in order:
1. **Cloudflare Queue** (`ANALYSIS_QUEUE` binding) → `dispatch_method: "queue"`. Consumed by `src/worker-entry.ts` `queue()` which imports and calls `runProcessTake` (`[analysis-queue] job started / job completed`).
2. **External dispatch** (`ANALYSIS_DISPATCH_URL`) → POST `src/routes/api/internal/run-analysis.ts` → `runProcessTake`. `dispatch_source: "external_worker"`.
3. **`waitUntil` fallback** (in-request) → `dispatch_method: "wait_until_fallback"`. Warned as risky (request worker may terminate mid-flight).

> **Observability implication (confirmed with Lovable):** worker logs for these
> branches land under different prefixes (`[analysis-queue] …`, `[take-pipeline] …`),
> and the published log reader is **intermittently failing (ClickHouse EOF)**.
> Treat the metric stream + persisted `score_breakdown` as the durable truth
> source, not raw logs.

---

## 2. `runProcessTake` stages (src/server/process-take.server.ts)

1. **Claim/lock** — conditional `takes` update to `status=processing, processing_phase=analysing`; report-credit reserve (`reserveReportCreditForTake`); same-video classification; brief extraction (`extractBriefFromText`, cached on `auditions.extracted_brief`).
2. **Two-step pipeline** (when `isTwoStepEnabled()`; else single-pass legacy multimodal call):
   - **Step 1 — evidence pass** `runEvidencePass` (multimodal; the only pass that sees the video).
   - **Filter / QA projection** `filterRunEvidencePassForStep1`.
   - **Step 2 — report polish** `runReportPolish` (text-only; builds the S10 report model).
   - **Polish retry** — one JSON-object salvage on recoverable HTTP-200 shape errors.
   - **Module readiness** `evaluateS10ModuleReadiness`.
   - **Module-repair retry** — re-prompt Step 2 when modules thin/blocked.
   - **Module-quality recovery / fallback** `buildS10ModuleQualityRecoveryReport` → `buildS10ReportPolishFallback`.
   - **Decision-critical gate** — throw `analysis_parse_failed` only if a decision-critical module is still blocked; otherwise degrade-render.
3. **Finalising** — score recompute (`recomputeOverall` + caps), output enforcement/scrubs (red-line, source-ref→timestamp rewrites, unsupported-claim removal), v2 route-report build (`buildRouteReportForPersistence`).
4. **Persist** — conditional `takes` update: `status=complete`, `report` (S10 view model), `scores`, `overall_score`, `confidence`, `compliance_flags`, `score_breakdown` (incl. the `two_step` summary).
5. **Post** — credit consume, internal QA artefacts (manifest + traces to `qa-artifacts` storage bucket), analytics, CRM, Mux asset delete.
6. **Failure** — `AnalysisFailure(code,msg)` → `markTerminalFailure` writes `status=error` + `[failure_code:…]`.

---

## 3. Two-step evidence model — the critical hand-offs

### 3a. Step 1 contract selection (`selectEvidencePassProviderContract`)
- `google/gemini*` → **`plain_json_observations`** (compact). **This is the live path** (`EVIDENCE_PASS_MODEL = google/gemini-3-flash-preview`).
- everything else → `tool_call` (the richer `EVIDENCE_TOOL` schema).
- Overridable via `EVIDENCE_PASS_PROVIDER_CONTRACT`.

### 3b. Step 1 output → EvidencePass (`normaliseCompactStep1EvidenceForEvidencePass`)
The compact response (`parseCompactStep1EvidenceContent`) **does** capture per-observation `timestamp_start_sec/_end_sec` and a `candidate_technique` family. **But the normaliser only forwards `observed_tape_sequence`, `component_verifications`, `media_observation_summary`, and the raw `step1_observations`.** It **hardcodes empty/zero**: `timestamped_evidence: []`, `candidate_technique_evidence: []`, `core_strengths_evidence: []`, `raw_scores: 0`, `category_notes_evidence: ""`. (Compact path is observation-only by design; scores come from Step 2.)

### 3c. Filter / projection (`filterRunEvidencePassForStep1` → `FilteredRunEvidencePassStep1`)
Derives + S9-suppresses family evidence (`video/audio/material/performance_observable_evidence_items`, `candidate_technique_evidence`, `observable_evidence_items`) **from the observations**, each with `safe_evidence_summary` + `timestamp`. Historically wired **only to QA artefacts** (`AnalysisEvidenceState.json`), not to Step 2.

### 3d. Step 2 polish input (`step2Evidence`, process-take.server.ts)
The polish reads the **raw** EvidencePass. `projectFilteredStep1EvidenceForPolish` (route β, PR #162) now backfills `timestamped_evidence` + `candidate_technique_evidence` into the polish input **from the filtered projection**, only when the raw fields are empty. Counts recorded as the liveness marker (PR #163): `score_breakdown.two_step.step1_evidence_projected_for_polish_count` / `step1_projected_technique_count` + metric `s10_step1_evidence_projected_for_polish`.

### 3e. Module readiness (`evaluateS10ModuleReadiness`)
Per-module classify → `complete | missing | thin | generic | contradictory | not_assessable`. Decision-critical taxonomy: `overall readiness`, `verdict`, `brief achievement`, `fix-first`, `next action`, `performer level calibration` are decision-critical; `technique commentary`, `timestamped notes`, `role/material context` are **not** (degrade-render). **Completeness checks are container-shape, not content-quality** — see Gap G4.

### 3f. Recovery / fallback (`buildS10ReportPolishFallback`)
Evidence-only deterministic report when the polish modules are thin. Coherent score withholding (PR #161/#162): when Step-1 produced no real category scores, `overall_score`/readiness scores are withheld (render `—`) and the verdict is taken from brief achievement (not a defaulted 0). Selected-level shortfall maps requirement IDs → human summaries and scrubs embedded id tokens (PR #162-A).

---

## 4. Known data-loss / transform points (interconnections that bite)

| ID | Where | What | Status |
|----|-------|------|--------|
| **G1** | `normaliseCompactStep1EvidenceForEvidencePass` | Drops model timestamps + candidate_technique into hardcoded `[]`; only forwards sequence + verifications. | Worked around by route β (G5), but the *source* model output for the compact path is the prompt (G2). |
| **G2** | `COMPACT_STEP1_SYSTEM_PROMPT` (live Gemini path) | **The compact prompt does not mandate per-observation timestamps and barely solicits `candidate_technique`** (described defensively as "internal-only, never authority"). The duration-scaled timestamp targets + structured technique fields live only in the `tool_call` `EVIDENCE_TOOL` path, which Gemini never uses. Result: Step 1 emits **0 timestamps, 0 candidate_technique** (confirmed: `timestamped_media_observation_count: 0`, `candidate_technique_evidence_count: 0`, with 29 observable items). | **OPEN — current root cause.** Prompt-engineering target. |
| **G3** | filter output | `filterRunEvidencePassForStep1` derives the evidence but historically QA-only. | Fixed by route β (PR #162) — but can only forward what Step 1 produced, so **G2 still gates**. |
| **G4** | `classifyReadiness` / `classifyFixHierarchy` | Passes on container shape (decision + headline present; stub fix-first present) **without checking non-null scores or non-stub content** → accepts the thin fallback shell as `module_ready`. | **OPEN — deferred "tighten gate" (#3).** Must downgrade, not hard-fail, to avoid fighting coherent fallback. |
| **G5** | `step2Evidence` assembly | Polish reads raw evidence, not the filtered/suppressed projection. | Fixed by route β (PR #162-B). |

### Deploy / observability
- **`build_commit_sha: "unknown"`**, `deployment_provenance_status: "unknown_no_safe_env_var_found"` — the build injects **no commit SHA**; the running commit is not derivable from artefacts/headers. Confirm via Lovable's Publish-history panel, or via the PR-#163 execution marker.
- Lovable publish has shown **`Worker bundle not found`** for merged SHAs → runtime can serve a stale build even when the workspace is "in sync". **"In sync" ≠ "published & served."**
- Published log reader: intermittent ClickHouse EOF. Use metrics + `score_breakdown` (SQL) as truth.

---

## 5. Step-1 prompt gap detail (G2) — the prompt-engineering target

Live path = `plain_json_observations` (`COMPACT_STEP1_SYSTEM_PROMPT`). Compared to the `tool_call` `EVIDENCE_TOOL`:

- **Timestamps:** compact schema has `timestamp_start_sec: number | null` but **no instruction requiring them** and **no duration-scaled density target** (the `<60s 3-5 … 10m+ 18-36` guidance exists only in the `EVIDENCE_TOOL` `timestamped_evidence` field description). Model defaults to `null`.
- **candidate_technique:** described only defensively ("internal_shadow / public_safe_descriptor_candidate / limitation-only … internal-only, never public authority"). **No instruction to produce safe technique descriptor candidates where evidence exists** (e.g. breath, eyeline shift, pacing, support). Model emits none.
- **Net:** the compact pass returns rich sequence/component evidence but **no timestamps and no technique**, starving the Step-2 timestamped-commentary and technique modules → module-readiness flags them → recovery → fallback shell. Route β cannot compensate because there is nothing to forward.

**Fix direction (not yet implemented — collate first):** bring the compact prompt to parity with the tool_call expectations — (a) mandate `timestamp_start_sec` (MM:SS-equivalent) on observed video/audio/performance observations with the duration-scaled density target; (b) explicitly solicit `candidate_technique` safe-descriptor observations where observed, within the existing red-line constraints (no named authority, no quality verdicts). Consider whether switching Gemini to the `tool_call` contract is a more reliable structural route than coaxing the compact prompt. Validate only by live run on a confirmed-live build.

### 5a. Contract-choice rationale — `tool_call` is a known dead-end for Gemini (B ruled out)
Decision record `docs/tapecoach/v3/s9-19h-live-step1-provider-contract-suppression-validation-repair.md`:
- `google/gemini-3-flash-preview` via the **Lovable gateway → OpenRouter** route **returned HTTP 400 on tool/function calling** with the large JSON schema + multimodal `file_url` + forced `tool_choice`. The compact `plain_json_observations` contract was introduced **specifically to fix that 400**.
- ⇒ **Switching Gemini to `tool_call` (option B) would reintroduce the HTTP 400 failure. B is ruled out. The correct lever is A: strengthen the compact prompt.**
- The record also confirms the projection infra already covers `candidate_technique` (filter projects it) — so the gap is purely that the **model isn't emitting timestamps/technique**, a prompt problem, not a plumbing one. It even names the exact downstream blocker we hit: `technique_trace_requires_step1_candidate_technique_extractor` (Step 1 must supply candidate-technique evidence; the compact prompt never makes it).
- Historical note: S9-19H marked compact Step-1 evidence "observation-only" and intended the runtime to fall back to single-pass report generation. The current S10 pipeline instead runs the **two-step polish on the compact evidence**, which needs richer Step-1 output than the observation-only compact contract was designed to provide — hence the timestamp/technique starvation now surfaces. Fix A (enrich the compact prompt) closes that gap without reintroducing the tool-call 400.

---

## 6. Fix history (this work-stream)

| PR | Layer | Change |
|----|-------|--------|
| #158 | persist | Coerce `overall_score`/`confidence` to integer-or-null at the `takes` write (fix `analysis_persist_failed`). |
| #159 | Step 2 / single-pass | Output token cap 8192→32768 + `finish_reason=length` truncation detection. |
| #160 | Step 1 observation gate | Trust structured signals (`observed_from_media` + `evidence_basis=observed_audio_video`) across all disciplines; drop the discipline-biased prose veto. |
| #161 | Step 1 cap + fallback | Caps→49152 sized for the 10-min product max; coherent fallback (withhold score, verdict from brief achievement). |
| #162-A | fallback | Scrub embedded id tokens (`br009`) from prose; exclude verified-present requirements from shortfall. |
| #162-B | Step 1→2 hand-off | **Route β:** feed the S9-suppressed filtered evidence into the polish input (`projectFilteredStep1EvidenceForPolish`). |
| #163 | observability | SQL-readable route-β liveness/execution marker. |

**Remaining root:** G2 (Step-1 compact prompt under-produces timestamps/technique) and G4 (readiness gate accepts the thin shell). Token caps / truncation were never the binding constraint for the observed takes (`completion_tokens ≈ 2,400 ≪ cap`).

---

## Confirmed live-run findings — take `8cb7619f` (2026-06-01, build ≥ `b051f60`)

First decisive run on a confirmed-live build carrying fix A (#165) and route β (#162).
Artifacts read directly: `Step1ObservableEvidence.json`, `raw_report.json`.

### Outcome
The performer report is the **evidence-only `module_quality_recovery` shell**, not a real
report. Self-described in the artifact: `readiness…score_basis` = *"Not scored in this
evidence-only fallback because Step 1 did not return category scores"*; critique
`critique_limitations` = *"The polished report left critical S10 modules unavailable, so
this report is recovered from locked Step 1 evidence."* `strengths: []`, every
`category_scores[].score: null`. The `s10_module_readiness` shows all critical modules
`complete` / `module_ready: true` **only because the recovery back-filled them** with
limitation copy that passes the lenient gate — a shell wearing a "complete" badge.

### Score semantics correction (operator-confirmed)
`overall_score: null` is **correct, not a failure**. Per README/roadmap the numeric score is
**internal/dev/debug only**; the performer-facing product is the **text equivalent**
(verdict / strengths / technique / next-action / readiness in words). "Done" = real
performer-facing prose renders, *not* a number. Do not chase the null score.

### Fix A (#165) — half landed
- `candidate_technique`: **0 → 5 accepted** (`step1_candidate_technique_accepted_count: 5`). ✅
- Timestamps: **still 0** (`timestamped_media_observation_count: 0`; every evidence item
  `timestamp: null`, `timestamp_source: not_timestamped_runtime_metadata`). ❌
- ⚠️ Correction to earlier note: the log's `s10_step1_evidence_projected_for_polish
  timestamped_count: 14` was **component-range projection** (e.g. `00:13–01:55` from
  component `br1`), **not** true per-moment timestamps. The exact-timestamp count is 0.

### Two-layer root cause
- **Layer 1 (primary — produces the shell): Step-2 polish reliability.** Polish parsed
  (`report_polish_completed`, `fallback_used:false`) but **under-produced the core modules**
  (overall readiness, verdict, performer level calibration, next action, technique). The
  **module-repair retry then returned non-JSON** (`provider_content_not_json_object`,
  HTTP 200) and its salvage failed → `module_quality_recovery` discarded the polish and
  built the evidence-only shell. This is what stands between "shell" and "real report".
  Note: the repair path already uses the correct `plain_json_report` contract + a salvage
  pass, so this is **not** a contract-selection bug — Gemini is failing to emit a complete,
  valid report object for the large `REPORT_TOOL` shape.
- **Layer 2 (secondary — limits richness): Step-1 filtering.** Of 34 candidate observations,
  **31 were rejected/filtered** (`rejected_or_filtered_observations: 31`), leaving mostly
  deterministic context facts (e.g. `selected_level: professional`) + 5 technique + 4
  performance, none timestamped. The compact v3 schema *has* `timestamp_start_sec` and the
  prompt mandates it, so timestamps die either at the model (not emitted in compact mode)
  or in the strict filter (rejected). Investigate the 31-rejection reasons next.

### Next root-cause target
Layer 1 — **why Gemini Step-2 polish + repair under-produce / return non-JSON for the full
report object**, and whether the `REPORT_TOOL` plain-JSON output is too large/complex for a
single reliable Gemini call (candidate fixes: segment the report generation, tighten the
plain-JSON instruction, or reduce required output surface per call). Layer 2 (timestamps /
31-rejected filter) is secondary and only affects richness of an already-working report.
