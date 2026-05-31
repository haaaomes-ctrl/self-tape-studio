// SERVER-ONLY. Canonical S10 scoring-basis semantics shared by the
// authenticated report model and route view model.

import type {
  BriefAchievementMatrix,
  BriefContext,
  BriefRequirement,
  S10PerformerLevel,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";

export type S10ScoringMode =
  | "brief_supplied"
  | "partial_brief_supplied"
  | "no_brief_baseline"
  | "brief_uncertain";

export type S10ScoreMeaningLabel =
  | "brief_based_submission_readiness"
  | "partial_context_readiness"
  | "no_brief_baseline_quality"
  | "provisional_due_to_brief_uncertainty";

export type S10ScoreVisibilityMode = "authenticated_s10_diagnostic";

export type S10ScoreVisibilityContext = {
  mode: S10ScoreVisibilityMode;
  numeric_scores_visible: boolean;
  public_customer_score_release_approved: false;
  performer_report_must_remain_useful_without_numeric_scores: true;
  explanation: string;
};

export type S10ScoringContext = {
  scoring_mode: S10ScoringMode;
  scoring_basis_label: string;
  scoring_basis_summary: string;
  brief_status:
    | "full_brief_available"
    | "partial_context_available"
    | "no_brief_available"
    | "conflicting_signals";
  can_assess_brief_achievement: boolean;
  can_assess_mandatory_requirements: boolean;
  can_assess_role_specific_fit: boolean;
  can_assess_admin_compliance: boolean;
  can_assess_observed_performance: boolean;
  can_assess_technical_setup: boolean;
  can_assess_selected_level_readiness: boolean;
  score_meaning_label: S10ScoreMeaningLabel;
  allowed_score_claims: string[];
  forbidden_claims: string[];
  required_limitations: string[];
  score_visibility: S10ScoreVisibilityContext;
  brief_context: BriefContext | null;
  brief_requirements: BriefRequirement[];
  brief_achievement_matrix: BriefAchievementMatrix | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clone<T>(value: T): T {
  if (value == null) return value;
  return structuredClone(value);
}

export function isS10ScoringMode(value: unknown): value is S10ScoringMode {
  return (
    value === "brief_supplied" ||
    value === "partial_brief_supplied" ||
    value === "no_brief_baseline" ||
    value === "brief_uncertain"
  );
}

export function explicitS10ScoringMode(report: Record<string, unknown>): S10ScoringMode | null {
  const candidates = [
    report.scoring_mode,
    report.scoringMode,
    asRecord(report.scoring_context)?.scoring_mode,
    asRecord(report.brief_scoring_context)?.scoring_mode,
  ];
  return candidates.find(isS10ScoringMode) ?? null;
}

export function inferS10ScoringMode(args: {
  report: Record<string, unknown>;
  briefContext: BriefContext | null;
  briefRequirements: BriefRequirement[];
  matrix: BriefAchievementMatrix | null;
}): S10ScoringMode {
  const explicit = explicitS10ScoringMode(args.report);
  if (explicit) return explicit;

  const hasBriefContext = Boolean(args.briefContext);
  const hasRequirements = args.briefRequirements.length > 0;
  if (hasRequirements && args.matrix) return "brief_supplied";
  if (hasBriefContext || hasRequirements) return "partial_brief_supplied";

  const mode = asText(args.report.mode) ?? asText(args.report.analysis_mode);
  if (mode === "baseline" || mode === "no_brief" || mode === "no_brief_baseline") {
    return "no_brief_baseline";
  }

  return "brief_uncertain";
}

const MODE_LABELS: Record<S10ScoringMode, string> = {
  brief_supplied: "Brief supplied",
  partial_brief_supplied: "Partial brief supplied",
  no_brief_baseline: "No brief baseline",
  brief_uncertain: "Brief status uncertain",
};

const MODE_SUMMARIES: Record<S10ScoringMode, string> = {
  brief_supplied:
    "Score language may include supplied brief achievement, mandatory requirement completion, admin/process readiness, selected level, observed performance and technical assessability.",
  partial_brief_supplied:
    "Only supplied context and observable tape evidence are scoreable; missing formal requirements cannot be treated as achieved.",
  no_brief_baseline:
    "The score is a baseline assessment of observable tape evidence against the selected performer level, inferred discipline/task evidence and technical assessability.",
  brief_uncertain:
    "Brief status is uncertain, so score language must stay provisional and avoid confident brief-adherence claims.",
};

const ALLOWED_SCORE_CLAIMS: Record<S10ScoringMode, string[]> = {
  brief_supplied: [
    "brief achievement",
    "mandatory requirement completion",
    "preferred or optional requirement handling",
    "admin/process readiness where supplied",
    "observed performance quality",
    "selected-level readiness",
    "technical assessability",
  ],
  partial_brief_supplied: [
    "supplied context",
    "observable performance quality",
    "limited task-fit commentary",
    "selected-level readiness",
    "technical assessability",
  ],
  no_brief_baseline: [
    "observable performance quality",
    "selected-level readiness",
    "inferred discipline/task evidence",
    "technical assessability",
    "self-tape presentation",
  ],
  brief_uncertain: [
    "provisional observed quality",
    "selected-level readiness where evidence exists",
    "technical assessability",
  ],
};

const FORBIDDEN_SCORE_CLAIMS: Record<S10ScoringMode, string[]> = {
  brief_supplied: ["guaranteed outcome", "universal quality claim", "hidden casting fit"],
  partial_brief_supplied: [
    "full brief compliance",
    "deadline compliance unless supplied",
    "upload compliance unless supplied",
    "time-limit compliance unless supplied",
    "mandatory package completion unless supplied and observed",
  ],
  no_brief_baseline: [
    "brief achievement",
    "mandatory requirement completion",
    "role-specific fit",
    "deadline compliance",
    "upload compliance",
    "file-naming compliance",
    "audition-specific package compliance",
  ],
  brief_uncertain: ["unsupported brief achievement", "unsupported mandatory completion"],
};

const REQUIRED_LIMITATIONS: Record<S10ScoringMode, string[]> = {
  brief_supplied: [],
  partial_brief_supplied: [
    "Formal brief requirements are incomplete; do not claim full brief compliance or mandatory package completion unless the supplied context and observed evidence support it.",
  ],
  no_brief_baseline: [
    "No casting brief was supplied, so TapeCoach cannot assess brief adherence, required components, role-specific instructions, deadline/upload compliance or whether this tape fulfils the exact audition task.",
    "This score is a baseline assessment of the observable tape against the selected performer level, inferred discipline/task evidence and technical assessability.",
  ],
  brief_uncertain: [
    "Brief status is uncertain; unsupported brief-specific claims require repair or suppression.",
  ],
};

function scoreMeaningLabel(mode: S10ScoringMode): S10ScoreMeaningLabel {
  if (mode === "brief_supplied") return "brief_based_submission_readiness";
  if (mode === "partial_brief_supplied") return "partial_context_readiness";
  if (mode === "no_brief_baseline") return "no_brief_baseline_quality";
  return "provisional_due_to_brief_uncertainty";
}

export function buildS10ScoringContext(args: {
  scoringMode: S10ScoringMode;
  briefContext: BriefContext | null;
  briefRequirements: BriefRequirement[];
  matrix: BriefAchievementMatrix | null;
  observedTapeSequence?: ObservedTapeSequence[] | null;
  componentVerifications?: ComponentVerification[] | null;
  mediaObservationSummary?: MediaObservationSummary | null;
  selectedLevel?: S10PerformerLevel | null;
  numericScoresVisible?: boolean;
}): S10ScoringContext {
  const hasRequirements = args.briefRequirements.length > 0;
  const hasMandatory = args.briefRequirements.some(
    (requirement) => requirement.importance === "mandatory",
  );
  const hasAdmin = args.briefRequirements.some((requirement) =>
    ["admin_process", "deadline", "logistics"].includes(requirement.category),
  );
  const hasRoleRequirement = args.briefRequirements.some(
    (requirement) => requirement.category === "role_context",
  );
  const observedPerformance =
    (args.observedTapeSequence?.length ?? 0) > 0 || (args.componentVerifications?.length ?? 0) > 0;
  const canAssessBriefAchievement =
    args.scoringMode === "brief_supplied" && hasRequirements && Boolean(args.matrix);

  return {
    scoring_mode: args.scoringMode,
    scoring_basis_label: MODE_LABELS[args.scoringMode],
    scoring_basis_summary: MODE_SUMMARIES[args.scoringMode],
    brief_status:
      args.scoringMode === "brief_supplied"
        ? "full_brief_available"
        : args.scoringMode === "partial_brief_supplied"
          ? "partial_context_available"
          : args.scoringMode === "no_brief_baseline"
            ? "no_brief_available"
            : "conflicting_signals",
    can_assess_brief_achievement: canAssessBriefAchievement,
    can_assess_mandatory_requirements: canAssessBriefAchievement && hasMandatory,
    can_assess_role_specific_fit: args.scoringMode !== "no_brief_baseline" && hasRoleRequirement,
    can_assess_admin_compliance: canAssessBriefAchievement && hasAdmin,
    can_assess_observed_performance: observedPerformance,
    can_assess_technical_setup: Boolean(args.mediaObservationSummary),
    can_assess_selected_level_readiness: Boolean(args.selectedLevel),
    score_meaning_label: scoreMeaningLabel(args.scoringMode),
    allowed_score_claims: [...ALLOWED_SCORE_CLAIMS[args.scoringMode]],
    forbidden_claims: [...FORBIDDEN_SCORE_CLAIMS[args.scoringMode]],
    required_limitations: [...REQUIRED_LIMITATIONS[args.scoringMode]],
    score_visibility: {
      mode: "authenticated_s10_diagnostic",
      numeric_scores_visible: Boolean(args.numericScoresVisible),
      public_customer_score_release_approved: false,
      performer_report_must_remain_useful_without_numeric_scores: true,
      explanation:
        "Numeric scores may be visible in authenticated/operator/test S10 review, but this is not public customer score-release approval; the recommendation and reasoning remain primary.",
    },
    brief_context: clone(args.briefContext),
    brief_requirements: clone(args.briefRequirements),
    brief_achievement_matrix: clone(args.matrix),
  };
}
