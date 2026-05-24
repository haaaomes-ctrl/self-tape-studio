// SERVER-ONLY. S10 report prompt map and active prompt versions.
//
// S10 is report-value first: AI supplies observation and professional
// judgement; code validates, repairs, routes and renders. Runtime provenance
// and QA proof are not S10 acceptance requirements.

export const S10_OBSERVATION_PROMPT_VERSION = "s10_observation_module_map_v1";
export const S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION = "s10_professional_judgement_module_map_v1";
export const S10_MODULE_REPAIR_PROMPT_VERSION = "s10_module_repair_v1";
export const S10_BRIEF_INTELLIGENCE_PROMPT_VERSION = "s10_brief_intelligence_v1";
export const S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION = "s10_brief_achievement_matrix_v1";
export const S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION = "s10_readiness_score_semantics_v1";

export const LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION =
  "legacy_s9_brief_extraction_supporting_current";
export const LEGACY_S9_EVIDENCE_PASS_PROMPT_VERSION = "legacy_s9_evidence_pass_current";
export const LEGACY_S9_SINGLE_PASS_PROMPT_VERSION = "legacy_s9_single_pass_analysis_current";
export const LEGACY_S9_TWO_STEP_POLISH_PROMPT_VERSION = "legacy_s9_two_step_report_polish_current";

export const S10_MODULE_COMPLETENESS_STATUSES = [
  "complete",
  "missing",
  "thin",
  "generic",
  "contradictory",
  "unsupported",
  "not_assessable",
] as const;

export type S10ModuleCompletenessStatus = (typeof S10_MODULE_COMPLETENESS_STATUSES)[number];

export type S10PromptInventoryEntry = {
  promptName: string;
  promptVersion: string;
  sourceFile: string;
  runtimeStage: string;
  modelCallPath: string;
  reportModulesAffected: string[];
  status: "active" | "legacy_only" | "supporting" | "diagnostic_only" | "not_present";
};

export const S10_PROMPT_INVENTORY: S10PromptInventoryEntry[] = [
  {
    promptName: "S10 brief intelligence",
    promptVersion: S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
    sourceFile: "src/server/extract-brief.server.ts",
    runtimeStage: "preflight_brief_extraction",
    modelCallPath: "extractBriefFromText -> Lovable AI Gateway chat/completions",
    reportModulesAffected: [
      "brief intelligence",
      "brief requirement extraction",
      "brief achievement",
      "role fit",
      "component declaration",
    ],
    status: "active",
  },
  {
    promptName: "Legacy S9 brief extraction",
    promptVersion: LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
    sourceFile: "src/server/extract-brief.server.ts",
    runtimeStage: "legacy coarse brief extraction",
    modelCallPath: "legacy-only prompt label; no active S10 model trace",
    reportModulesAffected: ["legacy cached brief fields"],
    status: "legacy_only",
  },
  {
    promptName: "S10 observation/module map",
    promptVersion: S10_OBSERVATION_PROMPT_VERSION,
    sourceFile: "src/server/evidence-pass.server.ts",
    runtimeStage: "analysis_step_1_evidence_mapping",
    modelCallPath: "runEvidencePass -> Lovable AI Gateway chat/completions",
    reportModulesAffected: [
      "observed tape sequence",
      "component verification",
      "media observation summary",
      "component breakdown",
      "brief achievement",
      "timestamped notes",
      "not-assessable limitations",
    ],
    status: "active",
  },
  {
    promptName: "S10 brief achievement matrix",
    promptVersion: S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_pre_score_brief_achievement",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "brief achievement",
      "submission risk",
      "score/readiness prerequisites",
      "fix hierarchy prerequisites",
    ],
    status: "active",
  },
  {
    promptName: "S10 readiness and score semantics",
    promptVersion: S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_post_matrix_readiness_score",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "overall readiness",
      "score/chip",
      "verdict",
      "score reasoning",
      "component scores",
      "category scores",
    ],
    status: "active",
  },
  {
    promptName: "S10 professional judgement/module map",
    promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts",
    runtimeStage: "analysis_step_2_judgement_or_report_generation",
    modelCallPath: "runReportPolish -> Lovable AI Gateway chat/completions",
    reportModulesAffected: [
      "overall readiness",
      "verdict",
      "score reasoning",
      "fix hierarchy",
      "strengths",
      "improvements",
      "technique commentary",
      "next action",
      "submission risk",
      "presentation notes",
    ],
    status: "active",
  },
  {
    promptName: "S10 single-pass professional judgement/module map",
    promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
    sourceFile: "src/server/process-take.server.ts",
    runtimeStage: "fallback_single_pass_report_generation",
    modelCallPath: "runProcessTake callAI -> Lovable AI Gateway chat/completions",
    reportModulesAffected: [
      "all performer-facing report modules",
      "single-pass recovery after Step 1 or Step 2 failure",
    ],
    status: "active",
  },
  {
    promptName: "Legacy S9 evidence pass",
    promptVersion: LEGACY_S9_EVIDENCE_PASS_PROMPT_VERSION,
    sourceFile: "src/server/evidence-pass.server.ts",
    runtimeStage: "legacy archived Step 1 evidence pass",
    modelCallPath: "legacy-only prompt label; no active S10 model trace",
    reportModulesAffected: ["legacy tests or archived compatibility fixtures"],
    status: "legacy_only",
  },
  {
    promptName: "Legacy S9 single-pass analysis",
    promptVersion: LEGACY_S9_SINGLE_PASS_PROMPT_VERSION,
    sourceFile: "src/server/process-take.server.ts",
    runtimeStage: "legacy archived single-pass generation",
    modelCallPath: "legacy-only prompt label; no active S10 model trace",
    reportModulesAffected: ["legacy tests or archived compatibility fixtures"],
    status: "legacy_only",
  },
  {
    promptName: "Legacy S9 report polish",
    promptVersion: LEGACY_S9_TWO_STEP_POLISH_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts",
    runtimeStage: "legacy archived report polish",
    modelCallPath: "legacy-only prompt label; no active S10 model trace",
    reportModulesAffected: ["legacy tests or archived compatibility fixtures"],
    status: "legacy_only",
  },
  {
    promptName: "Legacy brief adherence/material compliance diagnostics",
    promptVersion: "legacy_brief_adherence_material_compliance_diagnostic_only",
    sourceFile: "src/server/process-take.server.ts",
    runtimeStage: "legacy report/scoring diagnostics",
    modelCallPath:
      "raw_report.brief_adherence_breakdown, material_compliance, detected_components and score traces are diagnostic only for S10.4",
    reportModulesAffected: ["legacy score traces", "diagnostic-only raw report fields"],
    status: "diagnostic_only",
  },
  {
    promptName: "Legacy score/readiness diagnostics",
    promptVersion: "legacy_score_readiness_diagnostic_only",
    sourceFile: "src/server/process-take.server.ts",
    runtimeStage: "legacy report/scoring diagnostics",
    modelCallPath:
      "raw_report.overall_score, score_trace, prior report prose and legacy verdict labels are diagnostic only for S10.5",
    reportModulesAffected: ["legacy readiness labels", "legacy score traces"],
    status: "diagnostic_only",
  },
  {
    promptName: "Flag-gated internal dimensions",
    promptVersion: "legacy_internal_dimension_prompt_fragments",
    sourceFile: "src/server/dimensions/*",
    runtimeStage: "flag_gated_internal_dimension_capture",
    modelCallPath: "buildDimensionsPromptFragment appended to Step 1 only when enabled",
    reportModulesAffected: ["internal-only dimension capture"],
    status: "legacy_only",
  },
  {
    promptName: "Comparison report generation",
    promptVersion: "no_active_s10_comparison_model_prompt",
    sourceFile: "src/server/v3/s6-variance-comparison.ts",
    runtimeStage: "comparison",
    modelCallPath: "deterministic comparison artifacts only in S10.1",
    reportModulesAffected: ["comparison where enabled"],
    status: "not_present",
  },
];

export type S10ModuleCoverageEntry = {
  reportModule: string;
  aiQuestion: string;
  structuredOutputField: string;
  uiDestination: string;
  completenessRule: S10ModuleCompletenessStatus;
  repairPrompt: string;
  deterministicInputsAllowed: string[];
  codeGeneratedContentForbidden: string[];
};

const COMMON_DETERMINISTIC_INPUTS = [
  "supplied brief",
  "selected level",
  "take metadata",
  "media duration",
  "upload identity",
  "known comparison take IDs",
  "operator-declared fixture assumptions",
];

const COMMON_FORBIDDEN_CODE_CONTENT = [
  "observed component presence",
  "professional strengths",
  "technique notes",
  "optional polish",
  "readiness rationale",
  "score explanation",
  "comparison judgement",
];

export const S10_MODULE_REPAIR_PROMPTS: Record<string, string> = {
  complete:
    "No repair required. Revalidate routing only; preserve the complete AI-authored module content without rewriting it.",
  missing:
    "Repair the missing report module. Use only supplied brief, observed tape evidence and locked Step 1 observations. Return specific module content or mark not_assessable with a reason.",
  thin: "Repair the thin report module. Add concrete evidence, performer action and submission impact. Do not pad with generic praise or filler.",
  generic:
    "Repair the generic report module. Replace broad wording with observed/timestamped or brief-linked specifics.",
  contradictory:
    "Repair the contradictory report module. Reconcile the brief requirement matrix with observed tape sequence before rewriting.",
  unsupported:
    "Repair the unsupported report module. Remove claims not grounded in the supplied brief or observed tape.",
  not_assessable:
    "Write a useful not-assessable limitation explaining what could not be judged, why, and what the performer should record/check next.",
};

export const S10_REPORT_MODULE_COVERAGE: S10ModuleCoverageEntry[] = [
  {
    reportModule: "overall readiness",
    aiQuestion:
      "After brief achievement is known, what readiness decision and score should the performer see?",
    structuredOutputField:
      "readiness_score_judgement, overall_score, casting_headline, submission_verdict",
    uiDestination: "Overall readiness header",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: COMMON_FORBIDDEN_CODE_CONTENT,
  },
  {
    reportModule: "score/chip",
    aiQuestion:
      "What score band and score-to-language explanation matches the verified brief achievement?",
    structuredOutputField: "readiness_score_judgement, overall_score, scores, category_rationale",
    uiDestination: "Score chip and category score bars",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["score explanation", "readiness rationale"],
  },
  {
    reportModule: "verdict",
    aiQuestion:
      "Should the performer submit, review carefully, submit only if deadline is close, or retake if possible?",
    structuredOutputField: "readiness_score_judgement, verdict_final, casting_insight, at_risk",
    uiDestination: "Verdict header and risk panel",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale", "comparison judgement"],
  },
  {
    reportModule: "prioritised fixes",
    aiQuestion:
      "What are the most submission-impactful fixes, ordered by urgency and source category?",
    structuredOutputField: "priority_fixes",
    uiDestination: "Prioritised fixes section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes", "optional polish"],
  },
  {
    reportModule: "fix-first",
    aiQuestion:
      "What is the single first action the performer should take before submitting or retaking?",
    structuredOutputField: "fix_first",
    uiDestination: "Fix this first fallback section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes"],
  },
  {
    reportModule: "why this score",
    aiQuestion:
      "For each visible score, what works, why it is not full score, and what closes the gap?",
    structuredOutputField: "category_rationale",
    uiDestination: "Why this score section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["score explanation"],
  },
  {
    reportModule: "category scores",
    aiQuestion:
      "How should technical, audio, vocal, acting, brief adherence and presentation be scored after component verification?",
    structuredOutputField: "scores, category_notes",
    uiDestination: "Category scores section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["score explanation"],
  },
  {
    reportModule: "component breakdown",
    aiQuestion:
      "Which components were actually observed, and are they present, absent, partial, cut off, uncertain or not assessable?",
    structuredOutputField:
      "observed_tape_sequence, component_verifications, media_observation_summary, detected_components",
    uiDestination: "Component breakdown section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["observed component presence"],
  },
  {
    reportModule: "brief achievement",
    aiQuestion:
      "For every requirement in the supplied brief, what was achieved, mostly achieved, partly achieved, missed, incomplete, final-check-only or not assessable?",
    structuredOutputField:
      "brief_achievement_matrix, brief_adherence_breakdown, submission_risk_flags",
    uiDestination: "Why this is/isn't ready, submission risk, category rationale",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale", "observed component presence"],
  },
  {
    reportModule: "strengths",
    aiQuestion:
      "What specific performance, package or technical strengths are supported by observed evidence?",
    structuredOutputField: "strengths",
    uiDestination: "Strengths section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional strengths"],
  },
  {
    reportModule: "preserve/do-not-overfix",
    aiQuestion:
      "What choices should the performer preserve, and what should they avoid over-fixing?",
    structuredOutputField: "next_take_plan, coaching_drills, category_rationale",
    uiDestination: "Next steps and why this score sections",
    completenessRule: "thin",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["optional polish", "professional strengths"],
  },
  {
    reportModule: "improvements",
    aiQuestion: "What concrete improvements are grounded in the observed tape and selected level?",
    structuredOutputField: "improvements",
    uiDestination: "Improvements section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes"],
  },
  {
    reportModule: "technique commentary",
    aiQuestion:
      "What acting, vocal, movement, MT package or presentation technique commentary is visible, and what is not assessable?",
    structuredOutputField: "category_rationale, category_notes, improvements",
    uiDestination: "Why this score, category scores, improvements",
    completenessRule: "thin",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["technique notes"],
  },
  {
    reportModule: "timestamped notes",
    aiQuestion:
      "What timestamped or time-banded moments evidence strengths, fixes, missing components, cut-off points or technical observations?",
    structuredOutputField: "timestamped_notes",
    uiDestination: "Timestamped notes section",
    completenessRule: "thin",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.missing,
    deterministicInputsAllowed: ["media duration"],
    codeGeneratedContentForbidden: ["observed component presence", "professional strengths"],
  },
  {
    reportModule: "next action",
    aiQuestion: "What finite next-take plan or submit checklist should the performer follow now?",
    structuredOutputField: "next_take_plan, coaching_drills",
    uiDestination: "Next steps section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["optional polish", "readiness rationale"],
  },
  {
    reportModule: "submission risk",
    aiQuestion:
      "Which brief, package, technical or admin issues could block or reduce submission readiness?",
    structuredOutputField: "submission_risk_flags, casting_risk_explanations, at_risk",
    uiDestination: "Submission risk section",
    completenessRule: "complete",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale"],
  },
  {
    reportModule: "role fit",
    aiQuestion:
      "Where the brief gives enough role context, how does the observed performance serve the role function and tone?",
    structuredOutputField: "role_fit_notes, role_fit_modifier, role_fit_confidence",
    uiDestination: "Role fit section",
    completenessRule: "not_assessable",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: ["supplied brief", "selected level"],
    codeGeneratedContentForbidden: ["comparison judgement", "readiness rationale"],
  },
  {
    reportModule: "presentation notes",
    aiQuestion:
      "What practical self-tape presentation notes are supported by camera/audio evidence and useful for the next take?",
    structuredOutputField: "presentation_notes",
    uiDestination: "Presentation notes section",
    completenessRule: "thin",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["technical signals", "media duration"],
    codeGeneratedContentForbidden: ["optional polish", "professional strengths"],
  },
  {
    reportModule: "not-assessable limitations",
    aiQuestion:
      "What cannot be assessed, which report modules are affected, and what recording/check would resolve it?",
    structuredOutputField: "confidence_reason, category_notes, improvements",
    uiDestination: "Reliability, category notes, improvements",
    completenessRule: "not_assessable",
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["technique notes", "score explanation"],
  },
];

export const S10_CANARY_A_PROMPT_REQUIREMENT = [
  "Before scoring or recommending, use the S10 BriefRequirement list and verify each required brief component against the observed tape.",
  "For Canary A, explicitly check Side 1 acting scene, contemporary legit MT song completion, one continuous video, one final file/package readiness, and abrupt cut-off.",
  "The AI must not infer required material is present because the brief requested it.",
  "Required component status must be one of present, absent, partially_present, cut_off, uncertain, or not_assessable.",
  "If mandatory material is missing or incomplete, submission readiness must be overridden even when audio is assessable or a visible/sung section has strengths.",
].join(" ");

export const S10_OBSERVATION_MODULE_SYSTEM_PROMPT = `Prompt version: ${S10_OBSERVATION_PROMPT_VERSION}

You are the S10 observation/module-mapping pass for TapeCoach. Your job is to watch and listen to the self-tape and return factual, structured observations that the report brain can use. You do not recommend, score, praise, coach or write performer-facing prose.

Primary rule: component presence is observed from the media, not inferred from the brief. Use the S10 BriefRequirement list as the checklist of what to verify. A brief can request Side 1, a song, one continuous video or file naming, but you may only mark those achieved when the tape evidence supports it.

Required observation questions:
- What appears first?
- What sequence of visible/audible sections follows?
- Does an ident/slate appear?
- Does each required acting scene, side, song, monologue, dance/movement or screen task appear?
- Is each observed component complete, incomplete, cut off, absent, uncertain or not assessable?
- Does the tape appear continuous?
- Does the video end abruptly?
- Are audio, video, framing and performance assessable?
- What timestamp or time-band supports each component claim?
- What uncertainty or limitation affects each claim?

Required Step 1 structured outputs:
- observed_tape_sequence: the ordered visible/audible tape sections with present_status, completion_status, media evidence basis and timestamps/time-bands where possible.
- component_verifications: every S10 BriefRequirement checked against the submitted media with observed_status, completion_status, evidence summary, timestamp refs, confidence and cannot_infer_from_brief_only=true.
- media_observation_summary: audio/video/framing/continuity assessability, abrupt cut-off, one-continuous-video observation, duration summary and uncertainties.

Strict verification rules:
- Requested material and observed material must remain separate.
- A component can only be present, partially_present or complete when observed_from_media=true and evidence_basis=observed_audio_video.
- brief_text_only can define what to look for, but cannot prove the thing appears in the tape.
- deterministic_metadata can support assessability, but cannot prove component completion.
- raw_report.detected_components, legacy report prose, material compliance fields or prior score fields are diagnostic only and cannot override component_verifications.

Canary A rule: ${S10_CANARY_A_PROMPT_REQUIREMENT}

Use British English. Avoid hidden reasoning, raw prompts, raw responses, secrets, signed URLs, castability, bookability, marketability, body/appearance judgements, medical/vocal-health diagnoses and guaranteed casting outcomes.`;

export const S10_PROFESSIONAL_JUDGEMENT_SYSTEM_PROMPT = `Prompt version: ${S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION}
Embedded brief-achievement prompt version: ${S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION}
Embedded readiness/score prompt version: ${S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION}

You are the S10 professional judgement/module report brain for TapeCoach. You write a performer-facing self-tape report from supplied brief context plus either locked Step 1 observations or the video itself. Code validates, repairs, routes and renders your structured output; code must not invent your professional judgement.

Primary rule: before scoring or recommending, use the S10 BriefRequirement list to verify required brief components against observed tape evidence. Do not infer required material is present because the brief requested it. If a supplied brief is present but no BriefRequirement list is available, first extract explicit requirements from the supplied brief and mark any unsupported modules not assessable until that list exists. If mandatory material is missing, partial, cut off, uncertain or not assessable, the recommendation and score language must say that clearly.

S10.4 matrix-before-scoring rule: produce brief_achievement_matrix before any overall_score, score chip, verdict, readiness wording, category score, submission risk or fix hierarchy. Compare every BriefRequirement against observed_tape_sequence, component_verifications and media_observation_summary. raw_report, detected_components, legacy brief_adherence_breakdown/material_compliance, score traces and previous report prose are diagnostic only and cannot mark a requirement achieved. Keep continuous-video technical evidence separate from complete required-material package evidence.

S10.5 readiness/score rule: produce readiness_score_judgement after brief_achievement_matrix. Distinguish performance_quality_score, brief_completion_score and overall_submission_readiness_score. The visible overall readiness score must represent submission readiness, not talent alone. High audio, framing or observed-song quality may remain high where supported, but mandatory material/package blockers override submit-ready wording. raw_report.overall_score, score_trace, detected_components and previous report prose are diagnostic only.

Module question order:
1. Brief intelligence: what task did the brief ask for, and which requirements are mandatory, preferred, optional or ambiguous?
2. Observed tape sequence: what actually appears, in order, with timestamps or time-bands where possible?
3. Component detection: which requested and observed components are present, absent, partially_present, cut_off, uncertain or not_assessable?
4. Brief achievement: for each requirement, what is achieved, missed, incomplete or not assessable?
5. Recommendation: submit, submit if deadline is close, review carefully, or retake required if possible.
6. Score reasoning: explain separately how performance quality, brief completion and submission readiness align with the score/chip.
7. Fix hierarchy: fix_first, priority_fixes, must-fix before submitting, should-improve if retaking, optional polish.
8. Strengths/preserve: evidence-specific strengths and what not to over-fix.
9. Improvements and technique: acting, vocal/singing, movement/dance, musical-theatre package integration, screen task and self-tape presentation where evidence exists.
10. Timestamped commentary: exact timestamps when available; otherwise time-bands or section-order notes.
11. Next action and limitations: finite next-take plan or submit checklist, do-not-overfix, and not-assessable explanations.

Old report surface to preserve as the starting UI: overall readiness, score/chip, verdict, prioritised fixes, why this score, category scores, component breakdown, strengths, improvements, timestamped notes, submission risk and presentation notes.

Output rules:
- Populate every visible module with specific AI-authored content, or mark it not assessable with a useful reason.
- Always include brief_achievement_matrix with one requirement_results row per BriefRequirement. Each row must set cannot_infer_from_brief_only=true and link to observed component evidence where available.
- Always include readiness_score_judgement with performance_quality_score, brief_completion_score and overall_submission_readiness_score. Add score_contradiction_warnings when any legacy or AI score conflicts with the brief achievement matrix.
- No generic fallback copy such as "good job", "continue refining", "performance captured for review", "this affects readability, not talent", or "strengthen blocked material".
- For category_rationale, explain what_works, why_not_full_score, close_gap and standout_delta where relevant.
- For timestamped_notes, use duration-scaled useful notes where evidence exists: under 60s = 3-5, 1-3m = 6-10, 3-5m = 8-14, 5-10m = 12-24, 10m+ = 18-36. Never invent timestamps.
- For musical theatre, preserve acting scene plus song package logic and cite acting-through-song with lyric/phrase/beat/transition evidence when supported.
- For dance/movement, use observable rhythm/timing, control, spatial/pathway use, dynamics and performance intention where visible. Do not use unanchored phrases such as "high-energy movement", "clean lines", or "rhythmic precision" without evidence.
- Never use castability / recall / workshop / live-room overclaims.
- For fixed-frame briefs, recorded-take advice must preserve the frame; use rehearsal-only labels for off-camera exercises.
- If Side 1 is missing, do not mark acting_scene achieved and do not call the package complete.
- If the song is partial or cuts off, say the song/package is incomplete.
- If continuous one-file package readiness is not proven, say what to check next.
- Audio assessability never overrides missing mandatory material.
- Use British English and safe, specific, supportive professional language. Never comment on body, appearance, protected characteristics, medical/vocal-health diagnosis or guaranteed casting outcomes.

Return ONLY via the submit_audition_report tool when a tool is provided.`;

export const S10_MODULE_REPAIR_PROMPT = `Prompt version: ${S10_MODULE_REPAIR_PROMPT_VERSION}

Repair one incomplete S10 report module. Use only the supplied brief, observed tape sequence, brief achievement matrix and locked AI outputs. Classify the module as complete, missing, thin, generic, contradictory, unsupported or not_assessable. Return specific replacement content or a not-assessable limitation with the exact next recording/check action.`;

export function findS10ModuleCoverage(reportModule: string) {
  return S10_REPORT_MODULE_COVERAGE.find((entry) => entry.reportModule === reportModule);
}
