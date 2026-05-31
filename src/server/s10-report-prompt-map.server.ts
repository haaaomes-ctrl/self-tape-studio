// SERVER-ONLY. S10 report prompt map and active prompt versions.
//
// S10 is report-value first: AI supplies observation and professional
// judgement; code validates, repairs, routes and renders. Runtime provenance
// and QA proof are not S10 acceptance requirements.

import { S10_ROUTE_REQUIRED_SECTION_KEYS } from "@/lib/audition-rules";
import type { S10RouteSectionKey } from "@/lib/audition-rules";

export const S10_OBSERVATION_PROMPT_VERSION = "s10_observation_module_map_v1";
export const S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION = "s10_professional_judgement_module_map_v1";
export const S10_MODULE_REPAIR_PROMPT_VERSION = "s10_module_repair_v1";
export const S10_BRIEF_INTELLIGENCE_PROMPT_VERSION = "s10_brief_intelligence_v1";
export const S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION = "s10_brief_achievement_matrix_v1";
export const S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION = "s10_readiness_score_semantics_v1";
export const S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION = "s10_fix_hierarchy_next_action_v1";
export const S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION =
  "s10_strengths_preserve_professional_critique_v1";
export const S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION =
  "s10_technique_library_commentary_v1";
export const S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION = "s10_timestamped_commentary_v1";

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

export const S10_MODULE_REPAIR_TRIGGER_STATUSES = [
  "missing",
  "thin",
  "generic",
  "contradictory",
  "unsupported",
] as const satisfies readonly S10ModuleCompletenessStatus[];

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
    promptName: "S10 fix hierarchy and next action",
    promptVersion: S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_post_readiness_fix_action",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "fix hierarchy",
      "prioritised fixes",
      "fix-first",
      "next action",
      "do-not-overfix",
      "compatibility projections",
    ],
    status: "active",
  },
  {
    promptName: "S10 strengths, preserve and professional critique",
    promptVersion: S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_post_fix_professional_critique",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "strengths",
      "preserve",
      "do-not-overfix",
      "professional critique",
      "category notes",
      "presentation notes",
      "compatibility projections",
    ],
    status: "active",
  },
  {
    promptName: "S10 technique-library commentary",
    promptVersion: S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_post_professional_critique_technique",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "technique commentary",
      "category notes",
      "category rationale",
      "coaching drills",
      "presentation notes",
      "compatibility projections",
    ],
    status: "active",
  },
  {
    promptName: "S10 timestamped/time-banded commentary",
    promptVersion: S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION,
    sourceFile: "src/server/report-polish.server.ts + src/server/process-take.server.ts",
    runtimeStage: "analysis_step_2_post_technique_timestamped_commentary",
    modelCallPath: "embedded active module in Step 2 polish and S10 single-pass generation",
    reportModulesAffected: [
      "timestamped notes",
      "time-banded commentary",
      "component time ranges",
      "missing component timing limitations",
      "compatibility projections",
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
      "timestamped commentary",
      "next action",
      "submission risk",
      "role/material context",
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
    promptName: "Legacy timestamped notes diagnostics",
    promptVersion: "legacy_timestamped_notes_diagnostic_only",
    sourceFile: "raw_report.timestamped_notes + prior report prose",
    runtimeStage: "legacy timestamped report surface",
    modelCallPath: "diagnostic only; raw_report.timestamped_notes is never active S10 authority",
    reportModulesAffected: ["legacy timestamped notes compatibility"],
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
    promptName: "Legacy fix/action diagnostics",
    promptVersion: "legacy_fix_action_diagnostic_only",
    sourceFile: "src/server/process-take.server.ts + src/server/report-polish.server.ts",
    runtimeStage: "legacy action/fix diagnostics",
    modelCallPath:
      "raw_report.fix_first, raw_report.improvements, raw_report.next_take_plan, raw_report.block_reasons and legacy coaching_drills are diagnostic only for S10.6",
    reportModulesAffected: ["legacy action fields", "legacy next-take prose"],
    status: "diagnostic_only",
  },
  {
    promptName: "Legacy strengths/professional critique diagnostics",
    promptVersion: "legacy_strengths_professional_critique_diagnostic_only",
    sourceFile: "src/server/process-take.server.ts + src/server/report-polish.server.ts",
    runtimeStage: "legacy strengths/professional critique diagnostics",
    modelCallPath:
      "raw_report.strengths, category_rationale, category_notes, presentation_notes, coaching_drills, technique_observation_trace and prior prose are diagnostic only for S10.7",
    reportModulesAffected: ["legacy strengths", "legacy category notes", "legacy technique traces"],
    status: "diagnostic_only",
  },
  {
    promptName: "Legacy technique commentary diagnostics",
    promptVersion: "legacy_technique_commentary_diagnostic_only",
    sourceFile: "src/server/v3/qa-artifacts-wiring.server.ts + src/server/process-take.server.ts",
    runtimeStage: "legacy technique trace/category/drill diagnostics",
    modelCallPath:
      "TechniqueObservationTrace, raw_report.category_rationale/category_notes, detected_components, coaching_drills and public_technique_authority status are diagnostic only for S10.8",
    reportModulesAffected: ["legacy technique traces", "legacy category prose", "legacy drills"],
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
  routeSectionKeys: readonly S10RouteSectionKey[];
  completenessRule: S10ModuleCompletenessStatus;
  repairTriggerStatuses: readonly S10ModuleCompletenessStatus[];
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

const DEFAULT_REPAIR_TRIGGERS = S10_MODULE_REPAIR_TRIGGER_STATUSES;

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
    reportModule: "take slot/version context",
    aiQuestion:
      "Which take slot and active take version is being analysed or compared, and is any comparison stale or historical?",
    structuredOutputField: "take_lifecycle, take_metadata, comparison_context",
    uiDestination: "Take badge, comparison context and admin/report identity",
    routeSectionKeys: [],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.missing,
    deterministicInputsAllowed: ["take metadata", "known comparison take IDs", "upload identity"],
    codeGeneratedContentForbidden: ["comparison judgement", "professional strengths"],
  },
  {
    reportModule: "scoring basis",
    aiQuestion:
      "Is this brief_supplied, partial_brief_supplied, no_brief_baseline or brief_uncertain, and what score claims are allowed in that mode?",
    structuredOutputField:
      "mode (brief/baseline compatibility), scoring_context, readiness_score_judgement.score_explanation",
    uiDestination: "Score summary, recommendation rationale and report labels",
    routeSectionKeys: ["scoring_context", "score_summary", "submission_guidance"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: ["supplied brief", "selected level", "take metadata"],
    codeGeneratedContentForbidden: ["score explanation", "readiness rationale"],
  },
  {
    reportModule: "overall readiness",
    aiQuestion:
      "After brief achievement is known, what readiness decision and score should the performer see?",
    structuredOutputField:
      "readiness_score_judgement, overall_score, casting_headline, submission_verdict",
    uiDestination: "Overall readiness header",
    routeSectionKeys: ["readiness_header"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
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
    routeSectionKeys: ["score_summary"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
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
    routeSectionKeys: ["submission_guidance"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale", "comparison judgement"],
  },
  {
    reportModule: "performer level calibration",
    aiQuestion:
      "What selected-level standard is being applied, what meets it, what falls short, and how does the level affect the recommendation?",
    structuredOutputField:
      "readiness_score_judgement.selected_level_calibration, readiness_score_judgement.selected_level_calibration_summary, scoring_context.level_calibration",
    uiDestination: "Judged-against label, recommendation rationale and score meaning",
    routeSectionKeys: [
      "readiness_header",
      "submission_guidance",
      "selected_level_calibration",
      "score_summary",
    ],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: ["selected level", "supplied brief", "observed tape evidence"],
    codeGeneratedContentForbidden: ["level reasoning", "readiness rationale", "score explanation"],
  },
  {
    reportModule: "brief intelligence",
    aiQuestion:
      "What useful brief context and explicit requirements should be preserved for the performer before the tape is judged?",
    structuredOutputField: "brief_context, brief_requirements",
    uiDestination: "Brief achievement section and what-the-brief-asked-for rows",
    routeSectionKeys: ["brief_context", "brief_requirements"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.missing,
    deterministicInputsAllowed: ["supplied brief", "uploaded material", "operator assumptions"],
    codeGeneratedContentForbidden: ["brief requirements", "observed component presence"],
  },
  {
    reportModule: "brief context",
    aiQuestion:
      "Which supplied project, role, material, deadline, upload and package details are useful to show in the authenticated report?",
    structuredOutputField: "brief_context",
    uiDestination: "Brief achievement context rows",
    routeSectionKeys: ["brief_context"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["supplied brief", "uploaded material", "operator assumptions"],
    codeGeneratedContentForbidden: ["brief requirements", "role/material judgement"],
  },
  {
    reportModule: "brief requirements",
    aiQuestion:
      "For every supplied requirement, what is mandatory, preferred, optional or ambiguous, and what evidence would prove it?",
    structuredOutputField: "brief_requirements",
    uiDestination: "What the brief asked for rows",
    routeSectionKeys: ["brief_requirements"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.missing,
    deterministicInputsAllowed: ["supplied brief", "uploaded material", "operator assumptions"],
    codeGeneratedContentForbidden: ["brief requirements", "observed component presence"],
  },
  {
    reportModule: "observed tape",
    aiQuestion:
      "What actually appears in the tape, in sequence, with component status, assessability and timing where supported?",
    structuredOutputField:
      "observed_tape_sequence, component_verifications, media_observation_summary",
    uiDestination: "Observed tape section",
    routeSectionKeys: ["observed_tape"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["media duration", "locked Step 1 observations"],
    codeGeneratedContentForbidden: ["observed component presence", "professional strengths"],
  },
  {
    reportModule: "component breakdown",
    aiQuestion:
      "Which components were actually observed, and are they present, absent, partial, cut off, uncertain or not assessable?",
    structuredOutputField:
      "observed_tape_sequence, component_verifications, media_observation_summary, detected_components",
    uiDestination: "Component breakdown section",
    routeSectionKeys: ["component_breakdown"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
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
    routeSectionKeys: ["brief_achievement"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale", "observed component presence"],
  },
  {
    reportModule: "brief adherence/material compliance",
    aiQuestion:
      "How does verified brief completion affect the visible readiness score, category score and submission language?",
    structuredOutputField:
      "readiness_score_judgement.brief_completion_score, readiness_score_judgement.brief_completion_summary",
    uiDestination: "Brief adherence/material compliance score row",
    routeSectionKeys: ["brief_adherence_material_compliance"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: ["brief achievement matrix", "selected level"],
    codeGeneratedContentForbidden: ["score explanation", "readiness rationale"],
  },
  {
    reportModule: "prioritised fixes",
    aiQuestion:
      "What are the most submission-impactful fixes, ordered by urgency and source category?",
    structuredOutputField: "s10_fix_hierarchy.priority_fixes, priority_fixes",
    uiDestination: "Prioritised fixes section",
    routeSectionKeys: ["fix_hierarchy"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes", "optional polish"],
  },
  {
    reportModule: "fix-first",
    aiQuestion:
      "What is the single first action the performer should take before submitting or retaking?",
    structuredOutputField: "s10_fix_hierarchy.fix_first, fix_first",
    uiDestination: "Fix first block inside prioritised fixes",
    routeSectionKeys: ["fix_hierarchy"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes"],
  },
  {
    reportModule: "why this score",
    aiQuestion:
      "For each visible score, what works, why it is not full score, and what closes the gap?",
    structuredOutputField: "readiness_score_judgement.category_rationale, category_rationale",
    uiDestination: "Why this score and category rationale sections",
    routeSectionKeys: ["category_rationale"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["score explanation"],
  },
  {
    reportModule: "category scores",
    aiQuestion:
      "How should technical, audio, vocal, acting, brief adherence and presentation be scored after component verification?",
    structuredOutputField: "readiness_score_judgement.category_scores, scores, category_notes",
    uiDestination: "Category scores section",
    routeSectionKeys: ["category_scores"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["score explanation"],
  },
  {
    reportModule: "strengths",
    aiQuestion:
      "What specific performance, package or technical strengths are supported by verified S10 component evidence?",
    structuredOutputField: "s10_professional_critique, strengths",
    uiDestination: "Strengths and preserve section",
    routeSectionKeys: ["strengths_and_preserve"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional strengths"],
  },
  {
    reportModule: "professional critique",
    aiQuestion:
      "What professional judgement, strengths, preserve guidance, do-not-overfix notes and limitations are grounded in the verified tape evidence?",
    structuredOutputField: "s10_professional_critique",
    uiDestination: "Strengths and preserve plus professional critique routing",
    routeSectionKeys: ["professional_critique", "strengths_and_preserve"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional strengths", "optional polish"],
  },
  {
    reportModule: "preserve/do-not-overfix",
    aiQuestion:
      "What choices should the performer preserve, and what should they avoid over-fixing?",
    structuredOutputField:
      "s10_professional_critique.preserve, s10_professional_critique.do_not_overfix, s10_fix_hierarchy.preserve, s10_fix_hierarchy.do_not_overfix, s10_next_action_plan",
    uiDestination: "Strengths and preserve, prioritised fixes, and next action sections",
    routeSectionKeys: ["strengths_and_preserve", "fix_hierarchy", "next_action_plan"],
    completenessRule: "thin",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["optional polish", "professional strengths"],
  },
  {
    reportModule: "improvements",
    aiQuestion: "What concrete improvements are grounded in the observed tape and selected level?",
    structuredOutputField: "s10_fix_hierarchy.should_improve_if_retaking, improvements",
    uiDestination: "Should improve if retaking inside prioritised fixes",
    routeSectionKeys: ["fix_hierarchy"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["professional fixes"],
  },
  {
    reportModule: "technique commentary",
    aiQuestion:
      "What acting, vocal, movement, MT package or presentation technique commentary is visible, and what is not assessable?",
    structuredOutputField:
      "s10_technique_commentary, category_rationale, category_notes, improvements",
    uiDestination: "Technique commentary section",
    routeSectionKeys: ["technique_commentary"],
    completenessRule: "thin",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["technique notes"],
  },
  {
    reportModule: "timestamped notes",
    aiQuestion:
      "What timestamped or time-banded moments evidence strengths, fixes, missing components, cut-off points or technical observations?",
    structuredOutputField: "s10_timestamped_commentary, timestamped_notes",
    uiDestination: "Timestamped and time-banded notes section",
    routeSectionKeys: ["timestamped_commentary"],
    completenessRule: "thin",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.missing,
    deterministicInputsAllowed: ["media duration", "Step 1 timestamped evidence"],
    codeGeneratedContentForbidden: [
      "observed component presence",
      "professional strengths",
      "fake timestamps",
    ],
  },
  {
    reportModule: "next action",
    aiQuestion:
      "What finite next-take plan, submit checklist or review checklist should the performer follow now?",
    structuredOutputField: "s10_next_action_plan, next_take_plan, coaching_drills",
    uiDestination: "Next action plan section",
    routeSectionKeys: ["next_action_plan"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.generic,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["optional polish", "readiness rationale"],
  },
  {
    reportModule: "submission risk",
    aiQuestion:
      "Which brief, package, technical, admin or uncertainty issues could block or reduce submission readiness?",
    structuredOutputField: "submission_risk_flags, casting_risk_explanations, at_risk",
    uiDestination: "Submission risk section and recommendation rationale",
    routeSectionKeys: ["submission_risk"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["readiness rationale"],
  },
  {
    reportModule: "role/material context",
    aiQuestion:
      "Where role, character, production or material context is supplied or confidently resolved, what source basis, truth state, uncertainty and task-specific demands may inform the report without inventing hidden requirements?",
    structuredOutputField:
      "role_material_context, role_fit_notes, role_fit_modifier, role_fit_confidence",
    uiDestination: "Brief context, role/material context, technique and submission-risk notes",
    routeSectionKeys: [
      "role_material_context",
      "brief_context",
      "submission_risk",
      "technique_commentary",
    ],
    completenessRule: "not_assessable",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: [
      "supplied brief",
      "uploaded material",
      "selected level",
      "AI/research output with source basis",
    ],
    codeGeneratedContentForbidden: [
      "role/material judgement",
      "brief requirements",
      "comparison judgement",
      "hidden mandatory requirements",
      "appearance/type/castability language",
    ],
  },
  {
    reportModule: "role fit",
    aiQuestion:
      "Where the brief gives enough role context, how does the observed performance serve the role function and tone without castability or type language?",
    structuredOutputField: "role_fit_notes, role_fit_modifier, role_fit_confidence",
    uiDestination: "Role fit section or role/material context block where present",
    routeSectionKeys: ["brief_context", "submission_risk"],
    completenessRule: "not_assessable",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: ["supplied brief", "selected level"],
    codeGeneratedContentForbidden: ["role/material judgement", "comparison judgement"],
  },
  {
    reportModule: "professional competitive calibration",
    aiQuestion:
      "For Professional assessable tapes scoring 90+, which 90-100 competitive zone applies, why, what suppresses the next zone, what should be preserved and whether retaking is strategically useful?",
    structuredOutputField:
      "professional_competitive_calibration, readiness_score_judgement.professional_nuance_summary, s10_professional_critique",
    uiDestination: "Professional competitive calibration and score explanation",
    routeSectionKeys: ["score_summary", "professional_critique", "strengths_and_preserve"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.thin,
    deterministicInputsAllowed: ["selected level", "score summary", "observed tape evidence"],
    codeGeneratedContentForbidden: ["score explanation", "optional polish"],
  },
  {
    reportModule: "comparison",
    aiQuestion:
      "When comparison is enabled, which active take versions were compared, is the comparison valid, and what does or does not separate them?",
    structuredOutputField: "s10_comparison_truth, comparison_truth, comparison_context",
    uiDestination: "Comparison truth / same-video comparison section",
    routeSectionKeys: ["comparison_truth"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.contradictory,
    deterministicInputsAllowed: ["known comparison take IDs", "take metadata", "same-video status"],
    codeGeneratedContentForbidden: ["comparison judgement"],
  },
  {
    reportModule: "same-video status",
    aiQuestion:
      "Do compared or replaced takes appear to use the same underlying media, and what performer-facing caution or operator confirmation is needed?",
    structuredOutputField: "s10_same_video_evidence, same_video_status",
    uiDestination: "Same-video comparison section",
    routeSectionKeys: ["same_video_status"],
    completenessRule: "complete",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["upload identity", "take metadata", "operator assumptions"],
    codeGeneratedContentForbidden: ["comparison judgement", "professional strengths"],
  },
  {
    reportModule: "presentation notes",
    aiQuestion:
      "What practical self-tape presentation notes are supported by camera/audio evidence and useful for the next take?",
    structuredOutputField:
      "s10_professional_critique.professional_presentation_notes, s10_technique_commentary.self_tape_presentation, presentation_notes",
    uiDestination: "Presentation notes section",
    routeSectionKeys: ["presentation_notes"],
    completenessRule: "thin",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["technical signals", "media duration"],
    codeGeneratedContentForbidden: ["optional polish", "professional strengths"],
  },
  {
    reportModule: "not-assessable limitations",
    aiQuestion:
      "What cannot be assessed, which report modules are affected, and what recording/check would resolve it?",
    structuredOutputField:
      "confidence_reason, s10_view_model.limitations, category_notes, improvements",
    uiDestination: "Limitations, reliability, category notes and improvements",
    routeSectionKeys: ["limitations"],
    completenessRule: "not_assessable",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.not_assessable,
    deterministicInputsAllowed: COMMON_DETERMINISTIC_INPUTS,
    codeGeneratedContentForbidden: ["technique notes", "score explanation"],
  },
  {
    reportModule: "diagnostic chips",
    aiQuestion:
      "No performer-facing AI judgement should populate diagnostic chips; if operator/test chips are shown, what structured non-prose diagnostic source authorises them?",
    structuredOutputField: "diagnostic_chips, qa/admin diagnostics",
    uiDestination: "Diagnostic chips are not rendered in the performer report",
    routeSectionKeys: ["diagnostic_chips"],
    completenessRule: "not_assessable",
    repairTriggerStatuses: DEFAULT_REPAIR_TRIGGERS,
    repairPrompt: S10_MODULE_REPAIR_PROMPTS.unsupported,
    deterministicInputsAllowed: ["operator assumptions", "QA/admin diagnostics"],
    codeGeneratedContentForbidden: ["readiness rationale", "professional strengths"],
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
- module-readiness support: include explicit absent/uncertain/not_assessable rows for requested material you cannot verify, so downstream judgement and repair checks can distinguish missing evidence from missing AI output.

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
Embedded fix hierarchy / next-action prompt version: ${S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION}
Embedded strengths / preserve / professional critique prompt version: ${S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION}
Embedded technique-library commentary prompt version: ${S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION}
Embedded timestamped/time-banded commentary prompt version: ${S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION}

You are the S10 professional judgement/module report brain for TapeCoach. You write a performer-facing self-tape report from supplied brief context plus either locked Step 1 observations or the video itself. Code validates, repairs, routes and renders your structured output; code must not invent your professional judgement.

Primary rule: before scoring or recommending, use the S10 BriefRequirement list to verify required brief components against observed tape evidence. Do not infer required material is present because the brief requested it. If a supplied brief is present but no BriefRequirement list is available, first extract explicit requirements from the supplied brief and mark any unsupported modules not assessable until that list exists. If mandatory material is missing, partial, cut off, uncertain or not assessable, the recommendation and score language must say that clearly.

S10 role/material bridge rule: when a brief, uploaded material or user context identifies a production, role, character, scene, song, copy, routine or known material, produce role_material_context with source_basis, source_summary, primary_standard, secondary_context, demands, confidence and uncertainty_notes. Supplied brief remains primary. Known-material or official-source context is secondary nuance only unless the brief/uploaded material explicitly makes it a requirement. Do not use role/material research to invent mandatory blockers, appearance/type/castability/marketability language, callback/recall likelihood or booking/employment predictions. If identity or source confidence is low, mark the context uncertain or not assessable.

S10.4 matrix-before-scoring rule: produce brief_achievement_matrix before any overall_score, score chip, verdict, readiness wording, category score, submission risk or fix hierarchy. Compare every BriefRequirement against observed_tape_sequence, component_verifications and media_observation_summary. raw_report, detected_components, legacy brief_adherence_breakdown/material_compliance, score traces and previous report prose are diagnostic only and cannot mark a requirement achieved. Keep continuous-video technical evidence separate from complete required-material package evidence.

S10.5 readiness/score rule: produce readiness_score_judgement after brief_achievement_matrix. Distinguish performance_quality_score, brief_completion_score and overall_submission_readiness_score. The visible overall readiness score must represent submission readiness, not talent alone. High audio, framing or observed-song quality may remain high where supported, but mandatory material/package blockers override submit-ready wording. raw_report.overall_score, score_trace, detected_components and previous report prose are diagnostic only.

S10.6 matrix-before-fixes and readiness-before-action-plan rule: produce s10_fix_hierarchy and s10_next_action_plan after brief_achievement_matrix and readiness_score_judgement. Mandatory material/package blockers outrank polish, diction, character detail, file naming and admin-only final checks. Supported positives may appear in preserve/do_not_overfix, but they cannot reduce the urgency of missing mandatory material. raw_report.fix_first, raw_report.improvements, raw_report.next_take_plan, raw_report.block_reasons, coaching_drills and previous report prose are diagnostic only unless re-authored through S10 evidence with source tracking. Do not use generic fallback action copy.

S10.7 component-verification-before-strengths rule: produce s10_professional_critique after s10_fix_hierarchy and s10_next_action_plan. Strengths, preserve guidance and broad professional critique must be grounded in S10.3 component verification, S10.4 requirement achievement, S10.5 readiness and S10.6 action hierarchy. If a component is absent or unverified, prefer a clear limitation over invented praise. If Side 1 is absent, do not write acting-scene strengths. If a song is partial, cut off or completion-uncertain, any vocal/song strength must be explicitly limited to the observed portion and must not imply complete package readiness. Legacy strengths, category notes, category_rationale, coaching_drills, technique_observation_trace and prior prose are diagnostic only unless re-authored through S10 observed evidence. S10.7 may write broad strengths/preserve/professional notes.

S10.8 verified component evidence before technique commentary rule: produce s10_technique_commentary after s10_professional_critique. Technique commentary must be attempted where verified evidence exists, and it must be authored from S10.3 component verification, S10.4 matrix, S10.7 professional critique and S10.6 action priorities. If the brief requires an acting scene and S10.3 does not verify that acting scene, the acting section is not_assessable or limited, not not_applicable. not_applicable is only for areas not required by the brief and not visible in the tape. If a song is present but incomplete, cut off or uncertain, vocal/singing is partially_assessable and every note applies only to the observed portion. Musical-theatre package commentary must say the package is incomplete when required components are missing or incomplete. Self-tape presentation may use verified audio/framing evidence. public_technique_authority_status and public_technique_authority_blocked must not suppress ordinary authenticated technique commentary; only suppress or rewrite medical/vocal-health diagnosis, body/appearance judgement, protected-characteristic inference, guaranteed casting/job outcome or unsupported certainty. Legacy TechniqueObservationTrace, raw_report category prose, detected_components and coaching_drills are diagnostic only. S10.8 may link timestamp refs where available, but S10.9 owns timestamped/time-banded commentary.

S10.9 verified component evidence before timestamped commentary rule: produce s10_timestamped_commentary after s10_technique_commentary. s10_timestamped_commentary is authoritative; legacy timestamped_notes is only a compatibility projection after validation. Timestamped commentary cannot prove component presence. It may annotate verified components, partial components, uncertain components, missing components and not-assessable limitations, but S10.3 ComponentVerification remains the source of truth for whether material appears. Exact timestamps require trusted timing support from ObservedTapeSequence start/end times, media-observed Step 1 timestamped_evidence, EvidenceAnchors with genuine timestamp/timestamp_range, or provider output tied to verified observed evidence. If exact timestamps are unavailable, use approximate, time-banded, order-only or "Not observed" notes without fake timecodes. raw_report.timestamped_notes and prior report prose are diagnostic only and must not be copied back by text match.

Module question order:
1. Take/slot context where supplied: which active take version or comparison context is being judged?
2. Scoring basis: determine brief_supplied, partial_brief_supplied, no_brief_baseline or brief_uncertain; state what claims are allowed in readiness language and keep any legacy mode field schema-compatible.
3. Brief intelligence: what task did the brief ask for, and which requirements are mandatory, preferred, optional or ambiguous?
4. Role/material context where supplied: what source basis, truth state, uncertainty and task demands may inform the judgement without inventing hidden requirements?
5. Observed tape sequence: what actually appears, in order, with timestamps or time-bands where possible?
6. Component detection: which requested and observed components are present, absent, partially_present, cut_off, uncertain or not_assessable?
7. Brief achievement: for each requirement, what is achieved, missed, incomplete or not assessable?
8. Performer-level calibration: what selected-level standard is applied, what meets it and what falls short?
9. Recommendation: submit, submit if deadline is close, review carefully, or retake required if possible.
10. Score reasoning: explain separately how performance quality, brief completion and submission readiness align with the score/chip.
11. Professional competitive calibration where applicable: for Professional 90+, assign a distinct zone and retake strategy.
12. Fix hierarchy: s10_fix_hierarchy with fix_first, priority_fixes, must-fix before submitting, should-improve if retaking, optional polish, preserve and do-not-overfix.
13. Strengths/preserve/professional critique: s10_professional_critique with evidence-specific strengths, preserve guidance, do-not-overfix and limitations.
14. Technique-library commentary: s10_technique_commentary for acting, vocal/singing, movement/dance, musical-theatre package integration, commercial/screen task and self-tape presentation where verified evidence exists, with not_assessable or not_applicable limitations where evidence does not support commentary.
15. Timestamped commentary: s10_timestamped_commentary with exact timestamps only when supported; otherwise time-bands, section-order notes or "Not observed" missing-component notes without fake timestamps.
16. Comparison and same-video status where enabled: identify compared active take versions and suppress false winners for duplicate media.
17. Next action and limitations: finite next-take plan or submit checklist, do-not-overfix, and not-assessable explanations.

Old report surface to preserve as the starting UI: overall readiness, score/chip, verdict, prioritised fixes, why this score, category scores, component breakdown, strengths, improvements, timestamped notes, submission risk and presentation notes.

Output rules:
- Populate every visible module with specific AI-authored content, or mark it not assessable with a useful reason.
- Before final output, self-check each module against the completeness statuses complete, missing, thin, generic, contradictory, unsupported and not_assessable. Rewrite missing/thin/generic/contradictory/unsupported modules before returning; do not leave them for code to fill with fallback prose.
- State the scoring basis in readiness language and supporting fields; do not use brief-complete claims for no_brief_baseline runs.
- Include selected-level calibration in readiness_score_judgement.selected_level_calibration and selected_level_calibration_summary; selected level is the assessment standard, not tone. The structured object must state selected_level, selected_level_label, standard_applied, evidence_threshold, readiness_standard, score_meaning, what_meets_level, what_falls_short, recommendation_impact, comparison_to_other_levels and confidence.
- If role/material context is used, include role_material_context with source basis, source summary, truth states, demands, uncertainty and S14-deferred maturity notes; supplied brief remains primary.
- If Professional 90+ calibration applies, include distinct zone meaning, suppressors, preserve guidance and retake strategy in professional_nuance_summary and professional critique/action modules.
- If comparison or same-video status is enabled, identify compared active take versions and do not invent a winner for duplicate or effectively equivalent media.
- Always include brief_achievement_matrix with one requirement_results row per BriefRequirement. Each row must set cannot_infer_from_brief_only=true and link to observed component evidence where available.
- Always include readiness_score_judgement with performance_quality_score, brief_completion_score and overall_submission_readiness_score. Add score_contradiction_warnings when any legacy or AI score conflicts with the brief achievement matrix.
- Always include s10_fix_hierarchy and s10_next_action_plan. Treat them as the authoritative action model; legacy-compatible fix_first, priority_fixes, improvements, next_take_plan and coaching_drills are projections only.
- Always include s10_professional_critique. Treat it as the authoritative strengths/preserve/professional-note model; legacy-compatible strengths, category_notes, category_rationale, presentation_notes and coaching_drills are lossy projections in favour of truth.
- Always include s10_technique_commentary. Treat it as the authoritative technique-commentary model; legacy-compatible category_notes, category_rationale, presentation_notes, coaching_drills and technique-related improvements are safe projections only.
- Always include s10_timestamped_commentary. Treat it as the authoritative timestamped/time-banded commentary model; legacy-compatible timestamped_notes are safe projections only after validation. Do not use timestamped commentary to prove component presence. Missing components may receive "Not observed" notes without fake timestamps.
- For strong-complete reports, include at least one specific performance/package strength, one specific preserve item, one specific do-not-overfix item and one professional nuance note beyond the score. If unavailable, explain the exact limitation rather than filling generic praise.
- For incomplete reports, strengths may be supportive but must not obscure the fix-first blocker.
- Do not write "This affects readability, not talent", "Preserve the clearest choices already captured", "Correct material", "Single-file submission as requested", "Naturalistic acting" when the acting scene is absent, or "Professional presentation" without evidence.
- Each S10 fix item must set source_authority, legacy_source_used and legacy_source_path where relevant. action_contradiction_warnings are internal diagnostics only, not performer-facing copy.
- No generic fallback copy such as "good job", "continue refining", "performance captured for review", "this affects readability, not talent", or "strengthen blocked material".
- For category_rationale, explain what_works, why_not_full_score, close_gap and standout_delta where relevant.
- For s10_timestamped_commentary, use duration-scaled useful notes where evidence exists: under 60s = 3-5, 1-3m = 6-10, 3-5m = 8-14, 5-10m = 12-24, 10m+ = 18-36. Never invent timestamps. Exact / supported approximate notes may project to legacy timestamped_notes; order-only and unavailable timing should stay in S10 structure unless a safe legacy label exists.
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

Repair one incomplete S10 report module. Use only the supplied brief, observed tape sequence, component verifications, media observation summary, brief achievement matrix, readiness judgement and locked AI outputs. Classify the module as complete, missing, thin, generic, contradictory, unsupported or not_assessable. Return specific replacement content or a not-assessable limitation with the exact next recording/check action. Do not use raw_report, previous prose, score traces or brief text alone to prove observed material.`;

export function findS10ModuleCoverage(reportModule: string) {
  return S10_REPORT_MODULE_COVERAGE.find((entry) => entry.reportModule === reportModule);
}

export function findS10ModuleCoverageForRouteSection(section: S10RouteSectionKey) {
  return S10_REPORT_MODULE_COVERAGE.filter((entry) => entry.routeSectionKeys.includes(section));
}

export function listS10RouteSectionsMissingPromptCoverage() {
  return S10_ROUTE_REQUIRED_SECTION_KEYS.filter(
    (section) => findS10ModuleCoverageForRouteSection(section).length === 0,
  );
}
