# As-Is Verification Findings — S10 Analysis Pipeline

> Read-only verification of the live S10 analysis pipeline against documented intent
> (README.md, AGENTS.md, docs/tapecoach/s10-ai-prompt-map.md,
> docs/tapecoach/s10-analysis-pipeline-flow.md, docs/architecture/ ADRs).
> Date: 2026-06-04. Branch inspected: `docs/adr-0004-cloud-exit` (code identical to
> `main`; the branch only adds ADR-0004 docs). `docs/architecture/tapecoach-as-is-flow.md`
> was absent at verification time, so the six investigation tasks below were used as the
> verification frame. **No code was changed.** Recommendations are recorded, not implemented.

---

## Task 1 — Model round-trips per take

**Verdict: CONFIRMED (2 model round-trips on the happy path; the README's pass list is mostly folded into a single Step-2 call).**

### Actual model-provider call sites

All calls go through one provider layer: `src/server/analysis-ai-provider.server.ts`
(OpenRouter `https://openrouter.ai/api/v1/chat/completions` at
`src/server/analysis-ai-provider.server.ts:227`, or the Lovable AI gateway
`https://ai.gateway.lovable.dev/v1/chat/completions` at
`src/server/analysis-ai-provider.server.ts:188`; OpenRouter is selected whenever
`OPENROUTER_API_KEY` is set, `src/server/analysis-ai-provider.server.ts:294-301`).
`S10_MODEL_STEP1/STEP2/RECOVERY` are consumed only in `resolveModel`
(`src/server/analysis-ai-provider.server.ts:246-250`); the `brief_extraction` role has
no env override and always uses its in-code fallback model.

| # | Call | Role | Model (default → override) | Modality | Condition |
|---|------|------|---------------------------|----------|-----------|
| 1 | Brief intelligence — `extractBriefFromText` (`src/server/extract-brief.server.ts:543-546`; invoked `src/server/process-take.server.ts:3195-3196`) | `brief_extraction` | `google/gemini-2.5-flash` hardcoded (`src/server/extract-brief.server.ts:515`); **not** overridable by `S10_MODEL_*` | Text-only (brief text, 8000-char cap, `src/server/extract-brief.server.ts:437-443`) | Once per audition with a supplied brief; cached on `auditions.extracted_brief` (`src/server/process-take.server.ts:3207-3217`), re-run only when the cache is fallback-sourced/degraded or lacks S10 requirements (`src/server/process-take.server.ts:2862-2886`) |
| 2 | Step 1 — `runEvidencePass` (`src/server/evidence-pass.server.ts:1197`, provider call 1246-1257, role `step1` at 1256) | `step1` | `EVIDENCE_PASS_MODEL ?? google/gemini-3-flash-preview` (`src/server/evidence-pass.server.ts:23`) → `S10_MODEL_STEP1` | **Multimodal**: `[{type:"text"},{type:"file_url"(Mux MP4)}]` (`src/server/evidence-pass.server.ts:945-948`) | Every take when `TWO_STEP_ANALYSIS_ENABLED==="true"` (`src/server/process-take.server.ts:175-177`, call at 3684-3693) |
| 3 | Step 2 — `runReportPolish` (`src/server/report-polish.server.ts:233`, provider call 295-305, role `step2` at 304) | `step2` | `REPORT_POLISH_MODEL ?? google/gemini-3-flash-preview` (`src/server/report-polish.server.ts:34`) → `S10_MODEL_STEP2` | **Text-only** (see Task 2) | Every take with a successful Step 1 (`src/server/process-take.server.ts:4121-4136`) |
| 3a | Step 2 JSON-shape retry (`src/server/process-take.server.ts:4139-4175`) | `step2` | same | Text-only | Only on recoverable HTTP-200 shape/parse failure; one retry |
| 3b | Module-repair retry (`src/server/process-take.server.ts:6144-6177`) | `step2` | same | Text-only | Only when module readiness flags thin/blocked decision-critical modules; one retry with `buildS10ModuleRepairRetryInstruction` |
| 3c | Module-repair JSON salvage (`src/server/process-take.server.ts:6180-6215`) | `step2` | same | Text-only | Only if 3b itself returns a recoverable shape error; one salvage |
| 4 | Single-pass recovery — `callAI` (`src/server/process-take.server.ts:4359-4372`, role `recovery` at 4370) | `recovery` | `ANALYSIS_MODEL_PRIMARY ?? google/gemini-3-flash-preview`, fallback `ANALYSIS_MODEL_FALLBACK ?? google/gemini-2.5-flash` (`src/server/process-take.server.ts:1120-1122`, resolved at 4385-4386) → `S10_MODEL_RECOVERY` | **Multimodal** (video `file_url`, comment at 4365-4367) | Only when the two-step path produced no report (Step 1 failed, or two-step flag off). 1 attempt + max 1 model-fallback retry (`src/server/process-take.server.ts:4374-4401`) |

**No other model calls exist in the take-analysis path.** Specifically:
- Comparison: no active S10 comparison model prompt (`docs/tapecoach/s10-ai-prompt-map.md:33`); same-video classification is deterministic upload-identity matching (`classifyLiveSameVideoContext`, `src/server/process-take.server.ts:321-346`, no provider call).
- Module-quality recovery & polish fallback are **deterministic** report builders — `buildS10ModuleQualityRecoveryReport` / `buildS10ReportPolishFallback` in `src/server/s10-report-polish-fallback.server.ts` contain no `chatCompletions`/`fetch` call (verified by grep over the module).
- Role research: no research call of any kind exists (see Task 1 mapping and Task 4).

**Per-take totals:** happy path = **2** round-trips (Step 1 + Step 2); first take of a brief-bearing audition = **3** (adds brief extraction). Worst observed-path ceiling ≈ 6 (extract + Step 1 + Step 2 + shape retry + repair retry + salvage). Recovery single-pass (1–2 calls) replaces, not adds to, the two-step calls.

### Mapping README's pass pipeline (README.md:313-355, §5.1 passes) onto reality

| README pass | As-is implementation |
|---|---|
| Input context builder / Pass 0 | Deterministic code: block builders `src/server/process-take.server.ts:3424-3438` |
| Take slot / active version resolver | Deterministic code (`take_slot`/`take_version_*` columns; no model call) |
| Brief / no-brief scoring mode resolver | Deterministic — see Task 5 |
| Brief / material / role resolver | Model call #1 (brief intelligence) |
| Role/character research pass | **Does not exist as a pass.** `role_material_context` is an embedded module of the Step-2 call (REPORT_TOOL schema `src/server/process-take.server.ts:2001-2114`; prompt rule `src/server/report-polish.server.ts:71`). No external research, no dedicated call |
| Known-material baseline profile | **Does not exist.** Referenced only as prompt-level "secondary nuance" inside Step 2 |
| Media / assessability pass | Folded into Step 1 output (`media_observation_summary`) + deterministic Mux duration metadata |
| AI observation pass (Pass 1) | Model call #2 (Step 1) |
| Brief achievement pass | **Embedded module of the single Step-2 call** (`s10_brief_achievement_matrix_v1`, `src/server/report-polish.server.ts:55,62-63`) |
| Role/material calibration pass | Embedded in Step 2 (`src/server/report-polish.server.ts:71`) |
| AI professional judgement pass (Pass 2) | Model call #3 (Step 2) — the host prompt `s10_professional_judgement_module_map_v1` (`src/server/report-polish.server.ts:54`) |
| Performer level calibration pass | Embedded in Step 2 (`src/server/report-polish.server.ts:85`; level standard supplied via `buildS10PerformerLevelPromptBlock`, `src/lib/audition-rules.ts:480`, included in both Step-1 and Step-2 prompts) |
| Score & recommendation calibration | Embedded in Step 2 (`s10_readiness_score_semantics_v1`, `src/server/report-polish.server.ts:56,64`) + deterministic recompute/caps (`src/server/process-take.server.ts:5124-5147`) |
| Level-relative score calibration | Embedded in Step 2 (REPORT_TOOL `professional_competitive_calibration`) |
| Technique / timestamped commentary | Embedded in Step 2 (`src/server/report-polish.server.ts:59-60,68-69`) |
| AI repair prompts (§5.3 "targeted repair question" per module) | **Not per-module.** One whole-report Step-2 re-prompt carrying a repair-action summary (`buildS10ModuleRepairRetryInstruction`, `src/server/report-polish.server.ts:138-146`) |
| Report composer / render / QA | Deterministic code |

**Implication:** "two-step" is accurate at the transport level, but ~8 of the README's
intelligence passes are sequencing instructions inside one Step-2 prompt, not separate
round-trips. Any per-module failure inside that single call degrades all embedded
modules at once (consistent with the live-run shell finding in
`docs/tapecoach/s10-analysis-pipeline-flow.md:146-198`).

---

## Task 2 — Step 2 grounding (priority)

**Verdict: CONFIRMED — Step 2 is strictly text-only; it never receives video, image, or frame content.**

Evidence (exact request content):

- The Step-2 request body is built by `buildReportPolishRequestBodyForProvider`
  (`src/server/report-polish.server.ts:192-231`). `messages` is exactly:
  - `{ role: "system", content: <string> }` — `POLISH_SYSTEM_PROMPT` (plus a plain-JSON
    skeleton instruction on the `plain_json_report` contract), lines 205-215;
  - `{ role: "user", content: <string> }` — `userText`, line 216.
  Both `content` values are **plain strings**, never typed content-part arrays. There is
  no `file_url`, `image_url`, `input_video`, or base64 part anywhere in the module.
- `userText` (`src/server/report-polish.server.ts:268-279`) concatenates: audition title,
  `levelBlock`, `briefBlock` (raw casting brief text), `extractedBlock` (structured brief
  JSON), `signalsBlock` (upload signals/checklist JSON), the **serialized Step-1 evidence
  block**, optional recovery instruction, and a fixed sequencing instruction.
- The evidence block is `JSON.stringify` of the locked Step-1 `EvidencePass` object —
  `buildEvidenceBlock`, `src/server/report-polish.server.ts:159-190` (brief context/
  requirements, `audition_type`, `observed_tape_sequence`, `component_verifications`,
  `media_observation_summary`, raw scores, strengths/improvements/risk/timestamped
  evidence, `evidence_sufficiency`).
- The system prompt states it explicitly: *"You will NOT be given the video. You will be
  given a LOCKED EVIDENCE block from a prior pass that did watch the tape."*
  (`src/server/report-polish.server.ts:51`).
- The same is true for both Step-2 retry paths (they call the same `runReportPolish`
  with the same args: `src/server/process-take.server.ts:4152-4155`, `6162-6177`,
  `6195-6210`).
- Contrast: Step 1 *does* attach the media as
  `{ type: "file_url", file_url: { url: <Mux MP4 URL> } }`
  (`src/server/evidence-pass.server.ts:945-948`), and the single-pass recovery call also
  attaches the video (`src/server/process-take.server.ts:4365-4367`).

**Implication:** an observation_pass-vs-judgement_pass diff **is a valid confabulation
test** — any media-grounded claim in Step-2 output that is absent from the Step-1
evidence block cannot have come from the media. One refinement for test design: Step 2
*does* receive the raw brief and extracted brief text, so a confabulated claim may be
brief-seeded rather than freely invented; the test should classify failures as
"brief-leaked into observation" vs "pure invention".

---

## Task 3 — Brief into Step 1

**Verdict: REFUTED (the brief-blind hypothesis) — Step 1 receives the full brief and the extracted BriefRequirement[] alongside the media.**

Evidence:

- Step 1 context (`evidenceContext`, `src/server/process-take.server.ts:3649-3656`)
  = audition title + `levelBlock` + `briefBlock` + `extractedBlock` + `signalsBlock`
  + analysis tier. `briefBlock` is the raw casting brief
  (`src/server/process-take.server.ts:3424-3426`); `extractedBlock` is the full
  structured extracted brief JSON, including `brief_requirements`
  (`src/server/process-take.server.ts:3428-3430`). This is passed as `contextText` to
  `runEvidencePass` (`src/server/process-take.server.ts:3689`) and becomes the text part
  of the user message next to the video part
  (`src/server/evidence-pass.server.ts:945-948`).
- Both Step-1 system prompts are brief-aware by design: the tool-call prompt instructs
  *"Use the S10 BriefRequirement list from the structured brief as the checklist"*
  (`src/server/evidence-pass.server.ts:686`) and the live compact prompt requires
  `component_verifications` keyed by `BriefRequirement` id
  (`src/server/evidence-pass.server.ts:194-207,234`).
- Brief-independence of observations is enforced **only by prompt rules**, not by input
  isolation: "requested material and observed material must remain separate", "a
  component can only be present … when observed_from_media is true",
  `cannot_infer_from_brief_only: true` (`src/server/evidence-pass.server.ts:235-242,205`).

This matches the prompt map's documented intent ("Step 1 must consume: supplied brief;
S10 BriefContext; S10 BriefRequirement[] …", `docs/tapecoach/s10-ai-prompt-map.md:60-69`)
— so the *docs* are confirmed; what is refuted is any assumption that Step 1 is a pure,
brief-blind observation pass.

**Implication:** Step-1 "observations" can be brief-primed (the model knows what it is
supposed to find before it watches). A genuine brief-blind observation control does not
exist anywhere in the pipeline; if observation independence ever needs to be *proven*
(not just prompted), it would require a dedicated brief-blind Step-1 variant.

---

## Task 4 — Discipline resolver (highest leverage)

**Verdict: CONFIRMED — there is no deterministic discipline classifier and no dedicated discipline pass; discipline is an AI side-output, and on the live path it is hardcoded `"unknown"`. It is never user-suppliable and never surfaced for confirmation.**

The exact mechanism, per path:

1. **Type definition:** `AuditionType` = `acting_scene | monologue | song |
   musical_theatre | dance | commercial | hybrid | unknown`
   (`src/lib/audition-rules.ts:308-316`).
2. **Live path (Gemini → compact `plain_json_observations` contract,
   `src/server/evidence-pass.server.ts:928-931`):** the compact Step-1 schema
   (`COMPACT_STEP1_SYSTEM_PROMPT`, `src/server/evidence-pass.server.ts:158-228`) has **no
   `audition_type` field at all**, and the normaliser hardcodes
   `audition_type: "unknown"` (`src/server/evidence-pass.server.ts:1119`).
3. **Non-live tool-call path:** the Step-1 model classifies `audition_type` via an enum
   in `EVIDENCE_TOOL` (`src/server/evidence-pass.server.ts:281-293`) — AI-classified
   inside the observation call, no dedicated pass.
4. **Step 2 cannot fix it:** REPORT_TOOL has a top-level `audition_type`
   (`src/server/process-take.server.ts:1148`), but `enforceLockedFields` **overwrites the
   polished report's `audition_type` from Step-1 evidence**
   (`src/server/report-polish.server.ts:461`) — so on the live path every polished report
   is forced back to `"unknown"`.
5. **Where it lands:** `const auditionType = (report.audition_type ?? "unknown") as
   AuditionType; const weights = weightsForType(auditionType);`
   (`src/server/process-take.server.ts:5132-5133`). On the live path this always selects
   the generic `hybrid|unknown|default` weight set
   (`src/lib/audition-rules.ts:581-590`) — the discipline-specific weightings
   (acting 0.45 for scenes, vocal 0.45 for song, etc., `src/lib/audition-rules.ts:538-580`)
   **never engage**.
6. **Single-pass recovery:** AI-classified inside the recovery model call (REPORT_TOOL
   enum); not locked, since `enforceLockedFields` only runs on the two-step path.
7. **A second, disconnected discipline signal exists:** brief extraction asks the model
   for `audition_type` from the brief text (required output,
   `src/server/extract-brief.server.ts:144,260`; also `brief_context.discipline` /
   `audition_type`, lines 195, 274-275). It is used for the cache-degradation heuristic
   (`src/server/process-take.server.ts:2874`) and reaches Step 1/Step 2 only as prompt
   context inside `extractedBlock` — it is **never** used as the pipeline's discipline
   for weights or routing.
8. **Never user-supplied, never confirmed:** the `auditions` table has no
   audition-type/discipline column (columns: `audition_level`, `brief`, `brief_source`,
   `mode`, `title`, …; `src/integrations/supabase/types.ts:389-403`), the `takes` table
   has none either (audition_type lives only inside the `report` JSON), and the new-
   audition flow collects only title/brief/level
   (`src/routes/new.tsx:179-209`). The report UI renders it read-only
   (`src/routes/audition.$auditionId.tsx:1073`;
   `src/components/report/V2ReportView.tsx:206`).
9. **Can it be "unknown"?** Yes — it is the *default and the live-path constant*.

**Implication:** this is the highest-leverage as-is gap. README §0.1 ("Selected level
determines the standard … audition type / discipline where known") and the
discipline-depth prompt rules (e.g. DANCE/MT depth, `src/server/report-polish.server.ts:93`)
assume a resolved discipline, but the live pipeline runs every take as `"unknown"`:
generic score weights, no deterministic discipline routing, and no way for the user to
state or correct the discipline.

**Recommendation (recorded, not implemented):** introduce a real discipline resolver —
either (a) a user-supplied optional `audition_type` at audition creation (README §3.1
already lists "optional audition type / discipline" as a required supported input, which
is currently unmet), and/or (b) restore `audition_type` to the compact Step-1 schema, and
(c) stop locking Step-2's classification away on the compact path when Step 1 returned
only `"unknown"`. Surfacing the resolved discipline for user confirmation would close the
loop README §3 implies.

---

## Task 5 — Scoring-mode decision point

**Verdict: CONFIRMED — scoring mode is deterministic code, not an AI classification. The README §6.1 "ask the AI to classify scoring mode" prompt does not exist in the runtime.**

The decision is layered:

1. **At audition creation (binary, deterministic):** `mode = "brief" | "baseline"` is set
   from whether the user supplied/built a brief (`src/routes/new.tsx:182-192`) and stored
   on `auditions.mode`.
2. **In the pipeline (forced from server truth):** after every Step-2/fallback report,
   `report.mode = audition.brief ? "brief" : "baseline"` — explicitly "Force mode from
   server-known truth (not from the polish model)"
   (`src/server/process-take.server.ts:4293-4294`; also 4231 fallback, 6218 repair).
   The model is *told* the mode via the prompt: "NO CASTING BRIEF PROVIDED — apply
   BASELINE rubric" (`src/server/process-take.server.ts:3424-3426`).
3. **Four-value `ScoringMode` (brief_supplied / partial_brief_supplied /
   no_brief_baseline / brief_uncertain) is resolved at report-composition time**, not in
   any prompt: `S10ScoringMode` is defined in
   `src/server/s10-scoring-context.server.ts:16-20` and decided by
   `inferS10ScoringMode` (`src/server/s10-scoring-context.server.ts:100-120`), called
   from the route view model (`src/server/s10-report-view-model.server.ts:1238`) and the
   authenticated report model (`src/server/s10-authenticated-report-model.server.ts:413`).
   Inputs: the report object, extracted `briefContext`, `briefRequirements[]`, and the
   AI's `brief_achievement_matrix`. Logic: explicit AI-emitted `scoring_mode` wins if
   present → requirements + matrix ⇒ `brief_supplied` → context-or-requirements only ⇒
   `partial_brief_supplied` → `report.mode === "baseline"` ⇒ `no_brief_baseline` → else
   `brief_uncertain`.
4. **The "explicit AI value" branch is effectively dead:** `explicitS10ScoringMode`
   reads `report.scoring_mode` / `scoring_context.scoring_mode`
   (`src/server/s10-scoring-context.server.ts:90-98`), but REPORT_TOOL never solicits a
   `scoring_mode` field (zero occurrences in `src/server/process-take.server.ts`'s
   REPORT_TOOL schema), so the AI is never asked the §6.1 classification question.

**Implication:** `brief_supplied` and `no_brief_baseline` are reliably reachable;
`partial_brief_supplied` and `brief_uncertain` arise only from artifact-shape edge cases
(e.g. brief context without requirements, or a brief-less report whose `mode` string is
missing), never from AI judgement about brief sufficiency/conflict. If README §6.1's
intent (AI-classified scoring mode with conflict detection) still stands, it is
unimplemented; if the deterministic resolver is the accepted design, README §6.1 should
be amended. Recorded as a doc-vs-code divergence to resolve, not a runtime bug — the
deterministic resolver is arguably *safer* than asking the model.

---

## Task 6 — Renderer path for new takes

**Verdict: CONFIRMED — new takes persist `schema_version: "v2-component"` and render via `V2ReportView`; the v1/legacy renderer is reachable only for legacy (non-S10) reports.**

Evidence, write side:

- Default stamp: a report missing `schema_version` is stamped `"v1-legacy"`
  (`src/server/process-take.server.ts:6565-6571`) — but this only survives for non-S10
  reports, because of the next step.
- Persistence selection (`src/server/process-take.server.ts:6595-6661`):
  `buildRouteReportForPersistence` (`src/server/v2-report-builder.server.ts:550-627`)
  routes any report with S10 authoritative modules
  (`hasS10AuthoritativeModules`, `src/server/s10-report-view-model.server.ts:1021-1030` —
  `source_mode === "s10_ai_report_model"` OR `s10_view_model` OR any concrete S10 module
  object) into the v2 builder. Every v2 artefact carries
  `schema_version: "v2-component"` (`src/server/v2-report-builder.server.ts:63,401,500`;
  validator rejects anything else at 729).
- All live report sources carry S10 markers: the Step-2 REPORT_TOOL output (embeds
  `brief_achievement_matrix`, `readiness_score_judgement`, etc.), the single-pass
  recovery output (same REPORT_TOOL), and the deterministic fallback/recovery shells
  (`source_mode: "s10_ai_report_model"`,
  `src/server/s10-report-polish-fallback.server.ts:763`, with matrix/readiness objects at
  801, 874).
- Legacy passthrough (v1-legacy persisting) requires `future_report_enabled === false`
  **and** no S10 modules (`src/server/v2-report-builder.server.ts:558-559`) — not the
  case for any S10-path report. S10 assembly failure persists a *limited v2* report or
  throws `analysis_parse_failed`; it never silently substitutes v1
  (`src/server/process-take.server.ts:6641-6645`).

Evidence, read side:

- `src/routes/audition.$auditionId.tsx:1060-1076`: `readReportSchemaVersion(r) ===
  "v2-component"` → `<V2ReportView …>`; anything else falls through to the v1 layout
  (line 1078 onward). `readReportSchemaVersion` maps missing/unknown to `"v1-legacy"`
  (`src/lib/report-schema.ts:20-27`).

**Implication:** the live render surface for all new takes is `V2ReportView` +
`s10_view_model`. QA/acceptance review of report output should be performed against the
v2 renderer; the v1 path is effectively an archive renderer for pre-S10 rows.

---

## Summary — resolution of the verification flags

| Flag | Resolution |
|---|---|
| "Two-step analysis = how many real model passes?" | **2 per take** (Step 1 multimodal, Step 2 text-only) + 1 cached brief-extraction call per audition; repair/salvage retries add up to 3 more Step-2 calls; single-pass recovery (1–2 multimodal calls) replaces the two-step pair. README's pass pipeline is otherwise deterministic code or prompt-internal sequencing inside the single Step-2 call. |
| "Is Step 2 grounded in media?" | **No — text-only by construction** (`report-polish.server.ts:51,192-231`). The observation-vs-judgement confabulation diff is a **valid** test; classify failures as brief-seeded vs invented, since Step 2 sees the brief text. |
| "Is Step 1 brief-blind?" | **No.** Step 1 receives raw brief + extracted `BriefRequirement[]` (`process-take.server.ts:3649-3656`). Matches the prompt map's intent; observation independence is prompt-enforced only. |
| "Where is discipline decided?" | **Nowhere deterministic.** AI side-output of Step 1 (tool-call path) / Step 2-recovery; hardcoded `"unknown"` on the live compact path (`evidence-pass.server.ts:1119`) and locked back into the report (`report-polish.server.ts:461`). Not user-suppliable (no DB column, no UI input), never confirmed by the user, and `weightsForType("unknown")` governs all live scoring. **[AS-IS GAP — highest leverage]** |
| "Where is ScoringMode decided?" | **Deterministic**: binary `mode` at creation (`new.tsx:182-192`) + forced at persist (`process-take.server.ts:4294`) + post-hoc `inferS10ScoringMode` at composer time (`s10-scoring-context.server.ts:100-120`). The README §6.1 AI classification prompt is **not implemented**; the explicit-AI branch is dead code in practice. **[Doc-vs-code divergence]** |
| "Which renderer do new takes hit?" | **`V2ReportView`** via `schema_version: "v2-component"` (`v2-report-builder.server.ts:550-627`; `audition.$auditionId.tsx:1063-1076`). v1 path is legacy-only. |

### Recommendations recorded (NOT implemented)

1. **Discipline resolver (P-high):** add a user-suppliable optional discipline at
   audition creation and/or restore `audition_type` to the compact Step-1 schema; stop
   locking Step-2's discipline to `"unknown"` when Step 1 provided none; surface the
   resolved discipline in the report for user correction. Until then, discipline-specific
   score weights and depth rules are dead code on the live path.
2. **Confabulation test design:** proceed with the observation-vs-judgement diff (valid
   per Task 2), and add a brief-seeded-vs-invented classification since Step 2 receives
   brief text.
3. **ScoringMode:** decide whether README §6.1 (AI-classified scoring mode) is still
   intent. If yes, solicit `scoring_mode` in REPORT_TOOL (the composer already honours an
   explicit value); if no, amend README §6.1 to describe the deterministic resolver.
4. **README pass model:** amend README §5.3/§6 (or note in AGENTS.md) that module repair
   is one whole-report re-prompt, not per-module targeted questions, and that the role
   research pass and known-material baseline profile do not exist as runtime passes.
5. **Brief-blind control:** if observation independence ever needs proof, add an optional
   brief-blind Step-1 variant for QA/canary runs (prompt rules are currently the only
   guard).

### Topology note (current, per ADR-0003)

Ingestion → analysis path verified as: Mux `video.asset.ready` webhook →
`enqueueAnalysisJobOrMarkFailed` (`src/routes/api/public/mux-webhook.ts:528,647-651`) →
dispatch to the dedicated analysis Worker's `POST /dispatch-analysis`
(`analysis-worker/index.ts:35-37`; auth + enqueue in
`src/server/analysis-worker-handlers.server.ts:49-108`) → `tapecoach-analysis-jobs`
queue consumer (`analysis-worker/index.ts:45-70`) → `runQueuedAnalysisJob` →
`runAnalysisJob` in direct-OpenRouter mode with `OpenRouterChatProvider`
(`src/server/worker-analysis-consumer.server.ts:18,244-250`; legacy `runProcessTake`
compatibility branch at 267-271). The older 3-branch dispatch description in
`docs/tapecoach/s10-analysis-pipeline-flow.md:38-41` predates ADR-0003.
