// Canonical lossless report view-model (tc_report_vm_v1).
//
// This is the shared contract between the persisted `v2-component` report
// (takes.report JSONB) and the Template 3 report surface. Three layers per
// module:
//
//   data    — LOSSLESS capture of the exact persisted S10/legacy fields for
//             the module. No narrowing, no relabelling. If a renderer wants
//             the raw truth, it reads `data`.
//   display — derived, render-friendly shape (labels, chips, rows) modelled
//             on the design bundle's report-data.js. Display may collapse
//             wording, never facts: every display value is derivable from
//             `data`.
//   state   — honesty. populated | empty | limited, with `reason` and an
//             `emptyKind` presentation hint (hidden / positive / not
//             assessed). Modules with no output render a VISIBLE empty
//             state; they are never silently dropped.
//
// `rawFallback` carries the whole persisted report object so no field can be
// silently lost even if a module typing misses it (diagnostic mode dumps it;
// it must never be rendered into performer prose — raw model output is a
// red-line).
//
// State resolution degrades deliberately: `s10_module_readiness` is only
// persisted by newer pipeline runs. When the block is absent (ALL currently
// persisted reports), states are presence-derived and `readiness` is null —
// the view-model never claims readiness-grounding it does not have.
//
// Client-safe: structural access over the persisted JSON plus type-only
// imports from @/lib/audition-rules. No server imports.

import { isUsableS10PerformerReportViewModel } from "@/lib/audition-rules";
import type {
  BriefAchievementMatrix,
  BriefAchievementStatus,
  BriefContext,
  BriefRequirement,
  S10ComparisonTruth,
  S10FixHierarchy,
  S10NextActionPlan,
  S10ProfessionalCritique,
  S10SameVideoEvidence,
  S10TechniqueCommentary,
  S10TimestampedCommentary,
} from "@/lib/audition-rules";

// ── safe structural accessors (ported from V2ReportView) ──────────────────

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function safeArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function safeObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function safeStrArr(v: unknown): string[] {
  return safeArr(v).filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

function labelize(value: unknown): string {
  return (safeStr(value) ?? "").replace(/_/g, " ");
}

function sentenceLabelize(value: unknown): string {
  const label = labelize(value).trim();
  if (!label) return "";
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function itemTitle(item: unknown): string | null {
  if (typeof item === "string") return item;
  const o = safeObj(item);
  if (!o) return null;
  return safeStr(o.title) ?? safeStr(o.headline) ?? safeStr(o.point) ?? safeStr(o.summary);
}

function itemDetail(item: unknown): string | null {
  if (typeof item === "string") return null;
  const o = safeObj(item);
  if (!o) return null;
  return (
    safeStr(o.detail) ??
    safeStr(o.exact_action) ??
    safeStr(o.evidence_summary) ??
    safeStr(o.why_it_matters) ??
    safeStr(o.why_to_preserve) ??
    safeStr(o.recommended_action) ??
    null
  );
}

function itemText(item: unknown): string | null {
  const title = itemTitle(item);
  const detail = itemDetail(item);
  if (title && detail && title !== detail) return `${title} — ${detail}`;
  return title ?? detail;
}

function hasRenderableItem(item: unknown): boolean {
  return itemTitle(item) != null || itemDetail(item) != null;
}

// ── module keys ────────────────────────────────────────────────────────────

export const REPORT_MODULE_KEYS = [
  "recommendation",
  "selectedLevelCalibration",
  "scoreSummary",
  "scoringContext",
  "roleMaterialContext",
  "briefContext",
  "briefRequirements",
  "briefAchievement",
  "observedTape",
  "componentBreakdown",
  "fixHierarchy",
  "nextActionPlan",
  "strengthsAndPreserve",
  "professionalCritique",
  "techniqueCommentary",
  "timestampedCommentary",
  "professionalCompetitiveCalibration",
  "sameVideoStatus",
  "comparison",
  "submissionRisk",
  "presentationNotes",
  "limitations",
] as const;

export type ReportModuleKey = (typeof REPORT_MODULE_KEYS)[number];

// ── envelope ───────────────────────────────────────────────────────────────

export type ModuleState = "populated" | "empty" | "limited";

/** Presentation hint for non-populated modules (hide-vs-empty policy). */
export type ModuleEmptyKind =
  | "hidden" // genuinely not applicable — the card does not render at all
  | "positive" // absent-but-meaningful — good news, render as good news
  | "not_assessed"; // could have been generated but was not — visible empty state

export type ModuleReadinessLite = {
  status:
    | "complete"
    | "missing"
    | "thin"
    | "generic"
    | "contradictory"
    | "unsupported"
    | "not_assessable";
  decision_critical: boolean;
  repair_triggered: boolean;
  blocks_report_value: boolean;
};

export type ModuleProvenance = {
  /** Free-text module names used by S10_REPORT_MODULE_COVERAGE + s10_module_readiness. */
  reportModules: string[];
  /** Step 2 structured-output field path(s) that populate the module. */
  structuredOutputFields: string[];
  /** Route section keys (section_source_map) the module renders through. */
  routeSectionKeys: string[];
  /** Step 1 EvidencePass field names that feed the module (diagnostic traceability). */
  step1EvidenceFields: string[];
};

export type ReportModuleEnvelope<TData = unknown, TDisplay = unknown> = {
  key: ReportModuleKey;
  data: TData | null;
  display: TDisplay | null;
  state: ModuleState;
  emptyKind: ModuleEmptyKind | null;
  reason: string | null;
  readiness: ModuleReadinessLite | null;
  provenance: ModuleProvenance;
};

export type ReportMetaVM = {
  project: string | null;
  role: string | null;
  discipline: string | null;
  auditionType: string | null;
  takeLabel: string | null;
  takeVersionLabel: string | null;
  takeVersionStatusLabel: string | null;
  takeReplacementLabel: string | null;
  takeSameVideoLabel: string | null;
  judgedAgainst: string | null;
  scoringBasis: string | null;
};

export type ReportViewModel = {
  version: "tc_report_vm_v1";
  sourceMode: "s10" | "legacy";
  meta: ReportMetaVM;
  /** Mandatory visible scoring-basis / judged-against line (AGENTS.md). */
  scoringBasisLine: string;
  reportStatus: { status: string | null; limitationReason: string | null; isLimited: boolean };
  modules: Record<ReportModuleKey, ReportModuleEnvelope>;
  limitations: string[];
  /** Whole persisted report — diagnostic-only lossless escape hatch. */
  rawFallback: Record<string, unknown>;
};

export type ReportViewModelTakeMeta = {
  takeNumber?: number;
  takeSlot?: number | null;
  takeVersionNumber?: number | null;
  takeVersionStatus?: string | null;
  replacesTakeId?: string | null;
  sameVideoStatus?: string | null;
  auditionType?: string | null;
};

// ── provenance map ─────────────────────────────────────────────────────────
//
// reportModules / structuredOutputFields / routeSectionKeys mirror
// S10_REPORT_MODULE_COVERAGE (src/server/s10-report-prompt-map.server.ts) —
// that server map stays authoritative; a unit test pins consistency.
// step1EvidenceFields name the EvidencePass fields feeding each module.

export const REPORT_MODULE_PROVENANCE: Record<ReportModuleKey, ModuleProvenance> = {
  recommendation: {
    reportModules: ["overall readiness", "verdict"],
    structuredOutputFields: ["readiness_score_judgement", "verdict_final", "casting_headline"],
    routeSectionKeys: ["readiness_header", "submission_guidance"],
    step1EvidenceFields: ["raw_scores", "evidence_sufficiency"],
  },
  selectedLevelCalibration: {
    reportModules: ["performer level calibration"],
    structuredOutputFields: ["readiness_score_judgement.selected_level_calibration"],
    routeSectionKeys: ["selected_level_calibration"],
    step1EvidenceFields: ["raw_scores", "evidence_sufficiency"],
  },
  scoreSummary: {
    reportModules: ["score/chip", "category scores", "why this score"],
    structuredOutputFields: [
      "readiness_score_judgement",
      "readiness_score_judgement.category_scores",
      "overall_score",
      "scores",
    ],
    routeSectionKeys: ["score_summary", "category_scores", "category_rationale"],
    step1EvidenceFields: ["raw_scores", "category_notes_evidence"],
  },
  scoringContext: {
    reportModules: ["scoring basis"],
    structuredOutputFields: ["scoring_context"],
    routeSectionKeys: ["scoring_context"],
    step1EvidenceFields: ["evidence_sufficiency"],
  },
  roleMaterialContext: {
    reportModules: ["role/material context", "role fit"],
    structuredOutputFields: ["role_material_context", "role_fit_notes", "role_fit_modifier"],
    routeSectionKeys: ["role_material_context"],
    step1EvidenceFields: ["role_fit_evidence"],
  },
  briefContext: {
    reportModules: ["brief intelligence", "brief context"],
    structuredOutputFields: ["brief_context"],
    routeSectionKeys: ["brief_context"],
    step1EvidenceFields: [],
  },
  briefRequirements: {
    reportModules: ["brief requirements"],
    structuredOutputFields: ["brief_requirements"],
    routeSectionKeys: ["brief_requirements"],
    step1EvidenceFields: ["component_verifications"],
  },
  briefAchievement: {
    reportModules: ["brief achievement", "brief adherence/material compliance"],
    structuredOutputFields: ["brief_achievement_matrix"],
    routeSectionKeys: ["brief_achievement", "brief_adherence_material_compliance"],
    step1EvidenceFields: ["brief_adherence_evidence", "component_verifications"],
  },
  observedTape: {
    reportModules: ["observed tape"],
    structuredOutputFields: ["observed_tape"],
    routeSectionKeys: ["observed_tape"],
    step1EvidenceFields: [
      "observed_tape_sequence",
      "media_observation_summary",
      "component_verifications",
    ],
  },
  componentBreakdown: {
    reportModules: ["component breakdown"],
    structuredOutputFields: ["component_breakdown", "detected_components"],
    routeSectionKeys: ["component_breakdown"],
    step1EvidenceFields: ["component_verifications", "detected_components"],
  },
  fixHierarchy: {
    reportModules: ["fix-first", "prioritised fixes", "improvements", "preserve/do-not-overfix"],
    structuredOutputFields: ["s10_fix_hierarchy"],
    routeSectionKeys: ["fix_hierarchy"],
    step1EvidenceFields: ["fix_first_evidence", "core_improvements_evidence"],
  },
  nextActionPlan: {
    reportModules: ["next action"],
    structuredOutputFields: ["s10_next_action_plan"],
    routeSectionKeys: ["next_action_plan"],
    step1EvidenceFields: ["fix_first_evidence", "core_improvements_evidence"],
  },
  strengthsAndPreserve: {
    reportModules: ["strengths"],
    structuredOutputFields: ["s10_professional_critique", "strengths"],
    routeSectionKeys: ["strengths_and_preserve"],
    step1EvidenceFields: ["core_strengths_evidence"],
  },
  professionalCritique: {
    reportModules: ["professional critique"],
    structuredOutputFields: ["s10_professional_critique"],
    routeSectionKeys: ["professional_critique"],
    step1EvidenceFields: ["core_strengths_evidence", "presentation_evidence"],
  },
  techniqueCommentary: {
    reportModules: ["technique commentary"],
    structuredOutputFields: ["s10_technique_commentary"],
    routeSectionKeys: ["technique_commentary"],
    step1EvidenceFields: ["candidate_technique_evidence"],
  },
  timestampedCommentary: {
    reportModules: ["timestamped notes"],
    structuredOutputFields: ["s10_timestamped_commentary", "timestamped_notes"],
    routeSectionKeys: ["timestamped_commentary"],
    step1EvidenceFields: ["timestamped_evidence"],
  },
  professionalCompetitiveCalibration: {
    reportModules: ["professional competitive calibration"],
    structuredOutputFields: ["readiness_score_judgement.selected_level_calibration"],
    routeSectionKeys: ["selected_level_calibration", "score_summary"],
    step1EvidenceFields: ["raw_scores"],
  },
  sameVideoStatus: {
    reportModules: ["same-video status"],
    structuredOutputFields: ["s10_same_video_evidence", "same_video_status"],
    routeSectionKeys: ["same_video_status"],
    step1EvidenceFields: [],
  },
  comparison: {
    reportModules: ["comparison"],
    structuredOutputFields: ["s10_comparison_truth", "comparison_truth"],
    routeSectionKeys: ["comparison_truth"],
    step1EvidenceFields: [],
  },
  submissionRisk: {
    reportModules: ["submission risk"],
    structuredOutputFields: ["submission_risk_flags", "at_risk"],
    routeSectionKeys: ["submission_risk"],
    step1EvidenceFields: ["risk_evidence"],
  },
  presentationNotes: {
    reportModules: ["presentation notes"],
    structuredOutputFields: ["presentation_notes"],
    routeSectionKeys: ["presentation_notes"],
    step1EvidenceFields: ["presentation_evidence"],
  },
  limitations: {
    reportModules: ["not-assessable limitations"],
    structuredOutputFields: ["limitations"],
    routeSectionKeys: ["limitations"],
    step1EvidenceFields: ["evidence_sufficiency"],
  },
};

// ── display mappers ────────────────────────────────────────────────────────

/** Live readiness decision → design-bundle verdict semantics. */
export type VerdictDisplayKey = "submit" | "submit_if_close" | "review_carefully" | "retake";

export type VerdictDisplay = {
  key: VerdictDisplayKey;
  /** Short chip word (design bundle verdictMeta). */
  chipWord: string;
  tone: "success" | "royal" | "warning" | "danger";
};

const VERDICT_DISPLAY: Record<string, VerdictDisplay> = {
  submit: { key: "submit", chipWord: "Ready to submit", tone: "success" },
  submit_if_deadline_is_close: {
    key: "submit_if_close",
    chipWord: "Submit only if you're out of time",
    tone: "royal",
  },
  review_carefully: {
    key: "review_carefully",
    chipWord: "Check the report before you submit",
    tone: "warning",
  },
  retake_required_if_possible: {
    key: "retake",
    chipWord: "Retake before submitting",
    tone: "danger",
  },
};

export function verdictDisplay(decision: unknown): VerdictDisplay | null {
  const key = safeStr(decision);
  if (!key) return null;
  return (
    VERDICT_DISPLAY[key] ?? {
      key: "review_carefully",
      chipWord: sentenceLabelize(key),
      tone: "warning",
    }
  );
}

/**
 * Brief/requirement achievement status → status chip.
 *
 * not_assessable and not_applicable stay DISTINCT kinds — never collapsed
 * into "Not met". Absent vs not-assessable is a core honesty rule:
 * not_assessable is a VISIBLE, scoring-relevant gap ("Missing from your
 * tape"), while not_applicable rows are hidden at the row level (a
 * requirement that does not apply to the tape is noise, not honesty).
 */
export type StatusChipKind =
  | "achieved"
  | "partial"
  | "missing"
  | "not_assessable"
  | "not_applicable";

export type StatusChipDisplay = {
  kind: StatusChipKind;
  label: string;
  tone: "success" | "warning" | "danger" | "muted";
};

const STATUS_CHIPS: Record<BriefAchievementStatus, StatusChipDisplay> = {
  achieved: { kind: "achieved", label: "Met", tone: "success" },
  mostly_achieved: { kind: "partial", label: "Mostly there", tone: "success" },
  partly_achieved: { kind: "partial", label: "Partly there", tone: "warning" },
  not_achieved: { kind: "missing", label: "Not met", tone: "danger" },
  not_assessable: { kind: "not_assessable", label: "Missing from your tape", tone: "muted" },
  not_applicable: { kind: "not_applicable", label: "Not applicable", tone: "muted" },
};

export function statusChipDisplay(status: unknown): StatusChipDisplay | null {
  const key = safeStr(status);
  if (!key) return null;
  return (
    STATUS_CHIPS[key as BriefAchievementStatus] ?? {
      kind: "not_assessable",
      label: sentenceLabelize(key),
      tone: "muted",
    }
  );
}

/** Observed-status (present/partially_present/absent/...) → status chip. */
export function observedStatusChipDisplay(status: unknown): StatusChipDisplay | null {
  const key = safeStr(status);
  if (!key) return null;
  switch (key) {
    case "present":
      return { kind: "achieved", label: "Shown", tone: "success" };
    case "partially_present":
      return { kind: "partial", label: "Partly shown", tone: "warning" };
    case "absent":
      return { kind: "missing", label: "Not shown", tone: "danger" };
    case "not_assessable":
      return { kind: "not_assessable", label: "Not assessable", tone: "muted" };
    case "uncertain":
      return { kind: "not_assessable", label: "Uncertain", tone: "muted" };
    case "not_applicable":
      return { kind: "not_applicable", label: "Not applicable", tone: "muted" };
    default:
      return { kind: "not_assessable", label: sentenceLabelize(key), tone: "muted" };
  }
}

export type ScoreTone = "success" | "royal" | "warning" | "danger";

/** Design-bundle score colour thresholds. */
export function scoreTone(value: number): ScoreTone {
  if (value >= 80) return "success";
  if (value >= 70) return "royal";
  if (value >= 55) return "warning";
  return "danger";
}

// ── red-line guards (ported from V2ReportView) ─────────────────────────────

export function professionalCompetitiveScoreZone(score: number | null): string | null {
  if (score == null || score < 90) return null;
  if (score <= 91) return "90-91 · Professionally viable";
  if (score <= 93) return "92-93 · Solid professional contender";
  if (score <= 95) return "94-95 · Strong professional contender";
  if (score <= 97) return "96-97 · Standout professional take";
  return "98-100 · Exceptional / benchmark take";
}

export function containsProfessional90PlusClaim(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\b90\s*\+|\b90\b|competitive zone/i.test(value);
}

// ── section authority (section_source_map) ─────────────────────────────────

function sectionSource(
  sourceMap: Record<string, unknown> | null,
  section: string,
): { source: string | null; limitation: string | null } {
  const entry = safeObj(sourceMap?.[section]);
  return { source: safeStr(entry?.source), limitation: safeStr(entry?.limitation) };
}

function hasS10SectionRenderAuthority(
  sourceMap: Record<string, unknown> | null,
  section: string,
): boolean {
  const { source } = sectionSource(sourceMap, section);
  return source === "s10_authoritative_module" || source === "s10_compatibility_projection";
}

function sourceLimitation(
  sourceMap: Record<string, unknown> | null,
  section: string,
  fallback: string,
): string | null {
  const { source, limitation } = sectionSource(sourceMap, section);
  return source === "specific_limitation" ? (limitation ?? fallback) : null;
}

// ── module readiness lookup ────────────────────────────────────────────────

type ReadinessResultRow = {
  report_module: string | null;
  status: ModuleReadinessLite["status"] | null;
  reason: string | null;
  repair_triggered: boolean;
  blocks_report_value: boolean;
  decision_critical: boolean;
};

const READINESS_SEVERITY: Record<ModuleReadinessLite["status"], number> = {
  complete: 0,
  not_assessable: 1,
  thin: 2,
  generic: 2,
  unsupported: 3,
  contradictory: 3,
  missing: 4,
};

function readReadinessResults(report: Record<string, unknown>): ReadinessResultRow[] | null {
  const block = safeObj(report.s10_module_readiness);
  if (!block) return null;
  const results = safeArr(block.results)
    .map((row) => {
      const o = safeObj(row);
      if (!o) return null;
      const status = safeStr(o.status) as ModuleReadinessLite["status"] | null;
      return {
        report_module: safeStr(o.report_module),
        status: status && status in READINESS_SEVERITY ? status : null,
        reason: safeStr(o.reason),
        repair_triggered: o.repair_triggered === true,
        blocks_report_value: o.blocks_report_value === true,
        decision_critical: o.decision_critical === true,
      };
    })
    .filter((row): row is ReadinessResultRow => row !== null);
  return results.length > 0 ? results : null;
}

function readinessForModule(
  results: ReadinessResultRow[] | null,
  key: ReportModuleKey,
): { lite: ModuleReadinessLite | null; reason: string | null } {
  if (!results) return { lite: null, reason: null };
  const names = REPORT_MODULE_PROVENANCE[key].reportModules;
  const matches = results.filter((row) => row.report_module && names.includes(row.report_module));
  if (matches.length === 0) return { lite: null, reason: null };
  const worst = matches.reduce((a, b) =>
    READINESS_SEVERITY[(b.status ?? "complete") as ModuleReadinessLite["status"]] >
    READINESS_SEVERITY[(a.status ?? "complete") as ModuleReadinessLite["status"]]
      ? b
      : a,
  );
  return {
    lite: {
      status: (worst.status ?? "complete") as ModuleReadinessLite["status"],
      decision_critical: worst.decision_critical,
      repair_triggered: worst.repair_triggered,
      blocks_report_value: worst.blocks_report_value,
    },
    reason: worst.reason,
  };
}

// ── display row shapes (report-data.js-modelled) ───────────────────────────

export type TitleDetailRow = { title: string | null; detail: string | null };

export type CategoryScoreRow = {
  categoryId: string;
  score: number | null;
  tone: ScoreTone | null;
  note: string | null;
  whatWorks: string | null;
  whyNotFullScore: string | null;
  closeGap: string | null;
  confidence: string | null;
  blockedReason: string | null;
};

export type BriefRequirementRow = {
  id: string | null;
  summary: string | null;
  briefText: string | null;
  importance: string | null;
  category: string | null;
  expectedEvidence: string | null;
  chip: StatusChipDisplay | null; // from the achievement matrix where linked
  evidence: string | null;
};

export type AchievementRequirementRow = {
  requirementId: string | null;
  summary: string | null;
  importance: string | null;
  category: string | null;
  chip: StatusChipDisplay | null;
  observedChip: StatusChipDisplay | null;
  completionStatus: string | null;
  evidence: string | null;
  submissionImpact: string | null;
  fixCategory: string | null;
  recommendedAction: string | null;
  confidence: string | null;
};

export type ObservedSequenceRow = {
  label: string | null;
  componentType: string | null;
  startTime: string | null;
  endTime: string | null;
  presentChip: StatusChipDisplay | null;
  completionStatus: string | null;
  evidence: string | null;
  assessabilityNotes: string | null;
};

export type ComponentBreakdownRow = {
  label: string | null;
  observedChip: StatusChipDisplay | null;
  completionStatus: string | null;
  evidence: string | null;
  assessabilityNotes: string | null;
  score: number | null;
  scoreBasis: string | null;
  cannotScoreReason: string | null;
  observedFromMedia: boolean | null;
  timestampRef: string | null;
  confidence: string | null;
};

export type TimelineNoteRow = {
  displayLabel: string | null;
  timecode: string | null;
  section: string | null;
  kind: "strength" | "issue" | "improve" | "info";
  title: string | null;
  detail: string | null;
  action: string | null;
  evidence: string | null;
  precision: string | null;
};

export type TechniqueSectionRow = {
  area: string;
  areaLabel: string;
  status: string | null;
  headline: string | null;
  working: string[];
  improve: string[];
  practicalActions: string[];
  preserve: string[];
  notAssessableReason: string | null;
};

// ── per-module display types ───────────────────────────────────────────────

export type RecommendationDisplay = {
  verdict: VerdictDisplay | null;
  decisionRaw: string | null;
  headline: string | null;
  scoreExplanation: string | null;
  rationale: TitleDetailRow[];
  confidence: string | null;
};

export type SelectedLevelCalibrationDisplay = {
  judgedAgainst: string | null;
  standardApplied: string | null;
  readinessStandard: string | null;
  scoreMeaning: string | null;
  scoreMeaningSuppressed: boolean;
  recommendationImpact: string | null;
  comparisonToOtherLevels: string | null;
  meetsLevel: string[];
  fallsShort: string[];
};

export type ScoreSummaryDisplay = {
  overall: number | null;
  overallTone: ScoreTone | null;
  performanceQuality: number | null;
  briefCompletion: number | null;
  bandLabel: string | null;
  categories: CategoryScoreRow[];
};

export type ScoringContextDisplay = {
  scoringBasis: string | null;
  scoringBasisSummary: string | null;
  scoringMode: string | null;
  requiredLimitations: string[];
  scoreVisibilityExplanation: string | null;
};

export type FixHierarchyDisplay = {
  fixFirst: TitleDetailRow | null;
  priority: TitleDetailRow[];
  mustFix: TitleDetailRow[];
  shouldImprove: TitleDetailRow[];
  optionalPolish: TitleDetailRow[];
  preserve: TitleDetailRow[];
  doNotOverfix: TitleDetailRow[];
};

export type NextActionPlanDisplay = {
  submitChecklist: string[];
  retakePlan: string[];
  finalChecks: string[];
  playbackChecks: string[];
  doNotOverfix: string[];
  ifTimeIsShort: string[];
  noRetakeNeededReason: string | null;
};

export type StrengthsAndPreserveDisplay = {
  summary: string | null;
  strengths: TitleDetailRow[];
  preserve: TitleDetailRow[];
  doNotOverfix: TitleDetailRow[];
  limitations: string[];
};

export type ProfessionalCritiqueDisplay = {
  summary: string | null;
  buckets: Array<{ label: string; items: TitleDetailRow[] }>;
  preserve: TitleDetailRow[];
  doNotOverfix: TitleDetailRow[];
  limitations: string[];
};

export type TechniqueCommentaryDisplay = {
  summary: string | null;
  sections: TechniqueSectionRow[];
  limitations: string[];
};

export type TimestampedCommentaryDisplay = {
  summary: string | null;
  notes: TimelineNoteRow[];
  missingComponents: string[];
  timestampLimitations: string[];
};

export type ProfessionalCalibrationDisplay = {
  scoreZone: string | null;
  scoreSuppressor: string | null;
  retakeStrategy: string | null;
  preserve: string | null;
};

export type SameVideoDisplay = {
  statusLabel: string | null;
  performerSummary: string | null;
  comparisonWarning: string | null;
  limitations: string[];
};

export type ComparisonDisplay = {
  displayMode: string | null;
  summary: string | null;
  warning: string | null;
  limitations: string[];
};

export type SubmissionRiskDisplay = {
  atRisk: boolean | null;
  flags: TitleDetailRow[];
};

export type BriefContextDisplay = { rows: Array<[string, string]> };

export type RoleMaterialContextDisplay = { rows: Array<[string, string]> };

export type BriefRequirementsDisplay = {
  requirements: BriefRequirementRow[];
  classificationCounts: Array<[string, number]>;
};

export type BriefAchievementDisplay = {
  overallChip: StatusChipDisplay | null;
  mandatoryStatus: string | null;
  readinessImpact: string | null;
  summary: string | null;
  achievedCount: number;
  totalCount: number;
  requirements: AchievementRequirementRow[];
};

export type ObservedTapeDisplay = {
  sequence: ObservedSequenceRow[];
  media: Array<[string, string]>;
  uncertainties: string[];
};

export type ComponentBreakdownDisplay = { rows: ComponentBreakdownRow[] };

export type PresentationNotesDisplay = { notes: string[] };

export type LimitationsDisplay = { items: string[] };

// ── row builders ───────────────────────────────────────────────────────────

function titleDetailRows(items: unknown[]): TitleDetailRow[] {
  return items
    .filter(hasRenderableItem)
    .map((item) => ({ title: itemTitle(item), detail: itemDetail(item) }));
}

function displayStrings(value: unknown): string[] {
  return safeArr(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return itemTitle(item) ?? itemDetail(item) ?? "";
    })
    .filter((item): item is string => item.trim().length > 0);
}

const BRIEF_REQUIREMENT_IMPORTANCE_ORDER = [
  ["mandatory", "Mandatory"],
  ["preferred", "Preferred"],
  ["optional", "Optional"],
  ["ambiguous", "Ambiguous"],
] as const;

const BRIEF_REQUIREMENT_CATEGORY_ORDER = [
  ["material", "Material"],
  ["performance", "Performance"],
  ["technical", "Technical"],
  ["admin_process", "Admin process"],
  ["deadline", "Deadline"],
  ["logistics", "Logistics"],
  ["role_context", "Role context"],
] as const;

function classificationCounts(
  requirements: Array<Record<string, unknown>>,
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const requirement of requirements) {
    for (const key of [safeStr(requirement.importance), safeStr(requirement.category)]) {
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...BRIEF_REQUIREMENT_IMPORTANCE_ORDER, ...BRIEF_REQUIREMENT_CATEGORY_ORDER].flatMap(
    ([key, label]) => {
      const count = counts.get(key) ?? 0;
      return count > 0 ? ([[label, count]] as Array<[string, number]>) : [];
    },
  );
}

const TECHNIQUE_AREA_LABELS: Array<[string, string]> = [
  ["acting", "Acting"],
  ["vocal_singing", "Vocal / singing"],
  ["movement_dance", "Movement / dance"],
  ["musical_theatre_package", "Musical theatre package"],
  ["self_tape_presentation", "Self-tape presentation"],
  ["commercial_screen_task", "Commercial / screen task"],
];

function timelineKind(section: string | null): TimelineNoteRow["kind"] {
  switch (section) {
    case "strength":
      return "strength";
    case "fix":
    case "technical":
    case "missing_component":
    case "limitation":
      return "issue";
    case "technique":
    case "next_action":
      return "improve";
    default:
      return "info";
  }
}

// ── envelope construction helpers ──────────────────────────────────────────

type EnvelopeInput<TData, TDisplay> = {
  key: ReportModuleKey;
  data: TData | null;
  display: TDisplay | null;
  hasContent: boolean;
  limitation?: string | null;
  emptyKindWhenAbsent?: ModuleEmptyKind;
  readinessResults: ReadinessResultRow[] | null;
};

function buildEnvelope<TData, TDisplay>(
  input: EnvelopeInput<TData, TDisplay>,
): ReportModuleEnvelope<TData, TDisplay> {
  const { lite, reason } = readinessForModule(input.readinessResults, input.key);
  const provenance = REPORT_MODULE_PROVENANCE[input.key];

  let state: ModuleState;
  let emptyKind: ModuleEmptyKind | null = null;
  let stateReason: string | null = null;

  if (input.limitation) {
    state = "limited";
    stateReason = input.limitation;
  } else if (lite && READINESS_SEVERITY[lite.status] > 0) {
    // Readiness present (newer pipeline runs only): it drives the state.
    if (lite.status === "missing" && !input.hasContent) {
      state = "empty";
      emptyKind = input.emptyKindWhenAbsent ?? "not_assessed";
    } else {
      state = "limited";
    }
    stateReason = reason;
  } else if (input.hasContent) {
    state = "populated";
  } else {
    // Presence-derived (the only path for currently persisted reports,
    // which carry no s10_module_readiness block).
    state = "empty";
    emptyKind = input.emptyKindWhenAbsent ?? "not_assessed";
    stateReason = reason;
  }

  return {
    key: input.key,
    data: input.data,
    display: input.display,
    state,
    emptyKind,
    reason: stateReason,
    readiness: lite,
    provenance,
  };
}

// ── the shim ───────────────────────────────────────────────────────────────

export function buildReportViewModel(
  reportInput: unknown,
  takeMeta: ReportViewModelTakeMeta = {},
): ReportViewModel | null {
  const report = safeObj(reportInput);
  if (!report) return null;

  const rawS10View = report.s10_view_model;
  const usableS10View = isUsableS10PerformerReportViewModel(rawS10View);
  const isS10 =
    safeStr(report.source_mode) === "s10_ai_report_model" ||
    rawS10View != null ||
    ["brief_achievement_matrix", "readiness_score_judgement", "s10_fix_hierarchy"].some(
      (key) => safeObj(report[key]) !== null,
    );
  const isLimitedS10Report =
    isS10 &&
    (safeStr(report.report_status) === "limited" ||
      safeStr(report.limitation_reason) === "s10_v2_build_or_validation_failed" ||
      !usableS10View);

  const s10 = usableS10View ? safeObj(rawS10View) : null;
  const sourceMap = safeObj(s10?.section_source_map);
  const readinessResults = readReadinessResults(report);

  // ── section authority gates (red lines preserved) ──
  const readinessAuthorized = hasS10SectionRenderAuthority(sourceMap, "readiness_header");
  const guidanceAuthorized = hasS10SectionRenderAuthority(sourceMap, "submission_guidance");
  const scoreAuthorized = hasS10SectionRenderAuthority(sourceMap, "score_summary");
  const levelAuthorized = hasS10SectionRenderAuthority(sourceMap, "selected_level_calibration");
  const roleMaterialAuthorized = hasS10SectionRenderAuthority(sourceMap, "role_material_context");

  // ── recommendation ──
  const recommendation = safeObj(s10?.recommendation);
  const decisionRaw = guidanceAuthorized ? safeStr(recommendation?.decision) : null;
  const headline = isS10
    ? readinessAuthorized
      ? safeStr(recommendation?.headline)
      : null
    : safeStr(report.headline);
  const scoreExplanation = isS10
    ? readinessAuthorized
      ? safeStr(recommendation?.score_explanation)
      : null
    : safeStr(report.insight);
  const legacyVerdict = !isS10 ? safeStr(report.verdict) : null;
  const rationaleRows = guidanceAuthorized
    ? titleDetailRows(safeArr(recommendation?.rationale))
    : [];

  // ── score summary ──
  const scoreSummary = safeObj(s10?.score_summary);
  // Δ6: the visible S10 headline reads canonical D (s10.canonical_overall_score), gated by
  // the UNCHANGED scoreAuthorized provenance predicate; score_summary stays = A.
  const overall = isS10
    ? scoreAuthorized
      ? safeNum(s10?.canonical_overall_score)
      : null
    : safeNum(report.overall_readiness);
  const categoryRowsRaw = scoreAuthorized
    ? safeArr<Record<string, unknown>>(scoreSummary?.category_scores)
    : [];
  const legacyScores = !isS10 ? safeObj(report.scores) : null;
  const legacyCategoryNotes = !isS10 ? safeObj(report.category_notes) : null;
  const categoryRows: CategoryScoreRow[] = isS10
    ? categoryRowsRaw
        .map((row) => {
          const categoryId = safeStr(row.category_id);
          if (!categoryId) return null;
          const score = safeNum(row.score);
          return {
            categoryId,
            score,
            tone: score != null ? scoreTone(score) : null,
            note:
              safeStr(row.score_basis) ?? safeStr(row.why_not_full_score) ?? safeStr(row.close_gap),
            whatWorks: safeStr(row.what_works),
            whyNotFullScore: safeStr(row.why_not_full_score),
            closeGap: safeStr(row.close_gap),
            confidence: safeStr(row.confidence),
            blockedReason: safeStr(row.blocked_or_not_assessable_reason),
          } satisfies CategoryScoreRow;
        })
        .filter((row): row is CategoryScoreRow => row !== null)
    : Object.entries(legacyScores ?? {}).flatMap(([categoryId, raw]) => {
        const score = safeNum(raw);
        return [
          {
            categoryId,
            score,
            tone: score != null ? scoreTone(score) : null,
            note: safeStr(legacyCategoryNotes?.[categoryId]),
            whatWorks: null,
            whyNotFullScore: null,
            closeGap: null,
            confidence: null,
            blockedReason: null,
          } satisfies CategoryScoreRow,
        ];
      });

  // ── selected-level calibration (with 90+ claim red line) ──
  const levelCalibration = levelAuthorized ? safeObj(s10?.selected_level_calibration) : null;
  const judgedAgainst = safeStr(levelCalibration?.selected_level_label);
  const rawScoreMeaning = safeStr(levelCalibration?.score_meaning);
  const suppressesUnsupported90Claim =
    isS10 &&
    typeof overall === "number" &&
    overall < 90 &&
    containsProfessional90PlusClaim(rawScoreMeaning);
  const scoreMeaning = suppressesUnsupported90Claim ? null : rawScoreMeaning;

  // ── scoring context ──
  const scoringContext = safeObj(s10?.scoring_context);
  const scoringBasis =
    safeStr(scoringContext?.scoring_basis_label) ??
    (safeStr(scoringContext?.scoring_mode)
      ? sentenceLabelize(safeStr(scoringContext?.scoring_mode))
      : null);

  // ── brief context / requirements / achievement ──
  const briefContext = safeObj(s10?.brief_context);
  const briefContextRows: Array<[string, string]> = (
    [
      ["Project", briefContext?.project_name],
      ["Role", briefContext?.role_name],
      ["Discipline", briefContext?.discipline],
      ["Audition type", briefContext?.audition_type],
      ["Material", briefContext?.material_package_summary],
      ["Role context", briefContext?.role_description_summary],
      ["Deadline", briefContext?.deadline_summary],
      ["Upload", briefContext?.upload_summary],
      ["File naming", briefContext?.file_naming_summary],
    ] as Array<[string, unknown]>
  ).flatMap(([label, raw]) => {
    const value = safeStr(raw);
    return value ? ([[label, value]] as Array<[string, string]>) : [];
  });

  const briefRequirementsRaw = safeArr<Record<string, unknown>>(s10?.brief_requirements);
  const matrix = safeObj(s10?.brief_achievement_matrix);
  const matrixResults = safeArr<Record<string, unknown>>(matrix?.requirement_results);
  const matrixByRequirementId = new Map<string, Record<string, unknown>>();
  for (const row of matrixResults) {
    const id = safeStr(row.requirement_id);
    if (id) matrixByRequirementId.set(id, row);
  }

  // not_applicable rows are hidden at the row level (same hide pattern as
  // technique areas and comparison). not_assessable rows STAY visible — they
  // are the scoring-relevant "Missing from your tape" gap.
  const briefRequirementRows: BriefRequirementRow[] = briefRequirementsRaw
    .map((row) => {
      const id = safeStr(row.id);
      const matrixRow = id ? matrixByRequirementId.get(id) : undefined;
      return {
        id,
        summary: safeStr(row.summary),
        briefText: safeStr(row.brief_text),
        importance: safeStr(row.importance),
        category: safeStr(row.category),
        expectedEvidence: safeStr(row.expected_evidence_in_tape),
        chip: matrixRow ? statusChipDisplay(matrixRow.achievement_status) : null,
        evidence: matrixRow ? safeStr(matrixRow.evidence_summary) : null,
      };
    })
    .filter((row) => row.chip?.kind !== "not_applicable");

  const achievementRows: AchievementRequirementRow[] = matrixResults
    .map((row) => ({
      requirementId: safeStr(row.requirement_id),
      summary: safeStr(row.requirement_summary),
      importance: safeStr(row.importance),
      category: safeStr(row.category),
      chip: statusChipDisplay(row.achievement_status),
      observedChip: observedStatusChipDisplay(row.observed_status),
      completionStatus: safeStr(row.completion_status),
      evidence: safeStr(row.evidence_summary),
      submissionImpact: safeStr(row.submission_impact),
      fixCategory: safeStr(row.fix_category),
      recommendedAction: safeStr(row.recommended_action),
      confidence: safeStr(row.confidence),
    }))
    .filter((row) => row.chip?.kind !== "not_applicable");
  const achievedCount = achievementRows.filter((row) => row.chip?.kind === "achieved").length;

  // ── observed tape / component breakdown ──
  const observedTape = safeObj(s10?.observed_tape);
  const observedSequenceRaw = safeArr<Record<string, unknown>>(
    observedTape?.observed_tape_sequence,
  );
  const mediaSummary = safeObj(observedTape?.media_observation_summary);
  const observedSequenceRows: ObservedSequenceRow[] = observedSequenceRaw
    .filter((row) =>
      [
        row.present_status,
        row.completion_status,
        row.evidence_summary,
        row.assessability_notes,
      ].some((candidate) => !!safeStr(candidate)),
    )
    .map((row) => ({
      label: safeStr(row.label),
      componentType: safeStr(row.component_type),
      startTime: safeStr(row.start_time),
      endTime: safeStr(row.end_time),
      presentChip: observedStatusChipDisplay(row.present_status),
      completionStatus: safeStr(row.completion_status),
      evidence: safeStr(row.evidence_summary),
      assessabilityNotes: safeStr(row.assessability_notes),
    }))
    .filter((row) => row.presentChip?.kind !== "not_applicable");
  const mediaRows: Array<[string, string]> = mediaSummary
    ? (
        [
          ["Audio", mediaSummary.audio_assessable],
          ["Video", mediaSummary.video_assessable],
          ["Framing", mediaSummary.framing_assessable],
          ["Continuity", mediaSummary.continuity_assessable],
          ["Abrupt cut-off", mediaSummary.abrupt_cutoff_detected],
          ["One continuous video", mediaSummary.one_continuous_video_observed],
        ] as Array<[string, unknown]>
      ).flatMap(([label, raw]) => {
        if (typeof raw === "boolean") {
          return [[label, raw ? "Yes" : "No"]] as Array<[string, string]>;
        }
        const value = safeStr(raw);
        return value ? ([[label, sentenceLabelize(value)]] as Array<[string, string]>) : [];
      })
    : [];
  const durationSummary = safeStr(mediaSummary?.duration_summary);
  if (durationSummary) mediaRows.push(["Duration", durationSummary]);
  const mediaUncertainties = displayStrings(mediaSummary?.uncertainties);

  const componentVerificationsRaw = [
    ...safeArr<Record<string, unknown>>(s10?.component_breakdown),
    ...safeArr<Record<string, unknown>>(observedTape?.component_verifications),
  ];
  const componentScoresRaw = safeArr<Record<string, unknown>>(scoreSummary?.component_scores);
  const seenComponentIds = new Set<string>();
  const componentRows: ComponentBreakdownRow[] = componentVerificationsRaw
    .filter((row) => {
      const id = safeStr(row.requirement_id) ?? JSON.stringify(row);
      if (seenComponentIds.has(id)) return false;
      seenComponentIds.add(id);
      return [
        row.observed_status,
        row.completion_status,
        row.evidence_summary,
        row.assessability_notes,
      ].some((candidate) => !!safeStr(candidate));
    })
    .map((row, index) => {
      const requirementId = safeStr(row.requirement_id);
      const scoreRow = componentScoresRaw.find((candidate) =>
        safeArr<string>(candidate.linked_requirement_ids).includes(requirementId ?? ""),
      );
      return {
        label:
          safeStr(row.requirement_summary) ??
          safeStr(row.observed_status) ??
          safeStr(row.evidence_summary) ??
          `Component ${index + 1}`,
        observedChip: observedStatusChipDisplay(row.observed_status),
        completionStatus: safeStr(row.completion_status),
        evidence: safeStr(row.evidence_summary),
        assessabilityNotes: safeStr(row.assessability_notes),
        score: safeNum(scoreRow?.score),
        scoreBasis: safeStr(scoreRow?.score_basis),
        cannotScoreReason: safeStr(scoreRow?.cannot_score_reason),
        observedFromMedia:
          typeof row.observed_from_media === "boolean" ? row.observed_from_media : null,
        timestampRef: safeArr<string>(row.timestamp_refs)[0] ?? null,
        confidence: safeStr(row.confidence),
      } satisfies ComponentBreakdownRow;
    })
    .filter((row) => row.observedChip?.kind !== "not_applicable");

  // ── fix hierarchy ──
  const fixHierarchy = safeObj(s10?.fix_hierarchy);
  const fixHierarchyLimitation = sourceLimitation(
    sourceMap,
    "fix_hierarchy",
    "Fix hierarchy was unavailable for this S10 report.",
  );
  const fixFirstRow = (() => {
    const s10FixFirst = safeObj(fixHierarchy?.fix_first);
    if (s10FixFirst && hasRenderableItem(s10FixFirst)) {
      return { title: itemTitle(s10FixFirst), detail: itemDetail(s10FixFirst) };
    }
    const legacyFixFirst = safeStr(report.fix_first);
    return legacyFixFirst ? { title: legacyFixFirst, detail: null } : null;
  })();
  const fixDisplay: FixHierarchyDisplay = {
    fixFirst: fixFirstRow,
    priority: titleDetailRows(
      isS10 ? safeArr(fixHierarchy?.priority_fixes) : safeArr(report.priority_fixes),
    ),
    mustFix: titleDetailRows(safeArr(fixHierarchy?.must_fix_before_submitting)),
    shouldImprove: titleDetailRows(
      isS10 ? safeArr(fixHierarchy?.should_improve_if_retaking) : safeArr(report.improvements),
    ),
    optionalPolish: titleDetailRows(safeArr(fixHierarchy?.optional_polish)),
    preserve: titleDetailRows(safeArr(fixHierarchy?.preserve)),
    doNotOverfix: titleDetailRows(safeArr(fixHierarchy?.do_not_overfix)),
  };
  const hasFixContent =
    fixDisplay.fixFirst !== null ||
    [
      fixDisplay.priority,
      fixDisplay.mustFix,
      fixDisplay.shouldImprove,
      fixDisplay.optionalPolish,
      fixDisplay.preserve,
      fixDisplay.doNotOverfix,
    ].some((rows) => rows.length > 0);

  // ── next action plan ──
  const nextActionPlan = safeObj(s10?.next_action_plan);
  const nextActionLimitation = sourceLimitation(
    sourceMap,
    "next_action_plan",
    "Next action plan was unavailable for this S10 report.",
  );
  const legacyNextPlan = safeStrArr(safeObj(report.next_take_plan)?.steps);
  const nextActionDisplay: NextActionPlanDisplay = {
    submitChecklist: displayStrings(nextActionPlan?.submit_checklist),
    retakePlan:
      displayStrings(nextActionPlan?.retake_plan).length > 0
        ? displayStrings(nextActionPlan?.retake_plan)
        : legacyNextPlan,
    finalChecks: displayStrings(nextActionPlan?.final_checks),
    playbackChecks: displayStrings(nextActionPlan?.playback_checks),
    doNotOverfix: displayStrings(nextActionPlan?.do_not_overfix),
    ifTimeIsShort: displayStrings(nextActionPlan?.if_time_is_short_guidance),
    noRetakeNeededReason: safeStr(nextActionPlan?.no_retake_needed_reason),
  };
  const hasNextActionContent =
    nextActionDisplay.noRetakeNeededReason !== null ||
    [
      nextActionDisplay.submitChecklist,
      nextActionDisplay.retakePlan,
      nextActionDisplay.finalChecks,
      nextActionDisplay.playbackChecks,
      nextActionDisplay.doNotOverfix,
      nextActionDisplay.ifTimeIsShort,
    ].some((rows) => rows.length > 0);

  // ── strengths & preserve ──
  const strengthsAndPreserve = safeObj(s10?.strengths_and_preserve);
  const strengthsLimitation = sourceLimitation(
    sourceMap,
    "strengths_and_preserve",
    "Strengths and preserve guidance are not available for this report.",
  );
  const strengthsDisplay: StrengthsAndPreserveDisplay = {
    summary: safeStr(strengthsAndPreserve?.summary),
    strengths: titleDetailRows(
      isS10 ? safeArr(strengthsAndPreserve?.strengths) : safeArr(report.strengths),
    ),
    preserve: titleDetailRows(safeArr(strengthsAndPreserve?.preserve)),
    doNotOverfix: titleDetailRows(safeArr(strengthsAndPreserve?.do_not_overfix)),
    limitations: displayStrings(strengthsAndPreserve?.limitations),
  };
  const hasStrengthsContent =
    strengthsDisplay.summary !== null ||
    [strengthsDisplay.strengths, strengthsDisplay.preserve, strengthsDisplay.doNotOverfix].some(
      (rows) => rows.length > 0,
    );

  // ── professional critique ──
  const professionalCritique = safeObj(s10?.professional_critique);
  const critiqueBuckets: Array<{ label: string; items: TitleDetailRow[] }> = (
    [
      ["Performance", "performance_strengths"],
      ["Brief & package", "brief_package_strengths"],
      ["Technical presentation", "technical_presentation_strengths"],
      ["Vocal / singing", "vocal_or_singing_strengths"],
      ["Acting", "acting_strengths"],
      ["Movement / physical", "movement_or_physical_strengths"],
      ["Professional presentation", "professional_presentation_notes"],
    ] as Array<[string, string]>
  ).flatMap(([label, field]) => {
    const items = titleDetailRows(safeArr(professionalCritique?.[field]));
    return items.length > 0 ? [{ label, items }] : [];
  });
  const critiqueDisplay: ProfessionalCritiqueDisplay = {
    summary: safeStr(professionalCritique?.summary),
    buckets: critiqueBuckets,
    preserve: titleDetailRows(safeArr(professionalCritique?.preserve)),
    doNotOverfix: titleDetailRows(safeArr(professionalCritique?.do_not_overfix)),
    limitations: displayStrings(professionalCritique?.critique_limitations),
  };
  const hasCritiqueContent =
    critiqueDisplay.summary !== null ||
    critiqueDisplay.buckets.length > 0 ||
    critiqueDisplay.preserve.length > 0 ||
    critiqueDisplay.doNotOverfix.length > 0;

  // ── technique commentary ──
  const technique = safeObj(s10?.technique_commentary);
  const techniqueLimitation = sourceLimitation(
    sourceMap,
    "technique_commentary",
    "Technique commentary is not available for this report.",
  );
  const techniqueSections: TechniqueSectionRow[] = TECHNIQUE_AREA_LABELS.flatMap(
    ([area, areaLabel]) => {
      const section = safeObj(technique?.[area]);
      if (!section) return [];
      const status = safeStr(section.status);
      // Genuinely not-applicable areas are hidden per the hide-vs-empty
      // policy (a sung-note card on a screen-acting tape is noise).
      if (status === "not_applicable") return [];
      return [
        {
          area,
          areaLabel,
          status,
          headline: safeStr(section.headline),
          working: displayStrings(section.what_is_working),
          improve: displayStrings(section.what_could_improve),
          practicalActions: displayStrings(section.practical_actions),
          preserve: displayStrings(section.preserve),
          notAssessableReason: safeStr(section.not_assessable_reason),
        } satisfies TechniqueSectionRow,
      ];
    },
  );
  const techniqueDisplay: TechniqueCommentaryDisplay = {
    summary: safeStr(technique?.summary),
    sections: techniqueSections,
    limitations: displayStrings(technique?.limitations),
  };
  const hasTechniqueContent =
    techniqueDisplay.sections.some(
      (section) =>
        section.headline !== null ||
        section.working.length > 0 ||
        section.improve.length > 0 ||
        section.practicalActions.length > 0,
    ) || techniqueDisplay.summary !== null;

  // ── timestamped commentary ──
  const timestamped = safeObj(s10?.timestamped_commentary);
  const timestampedNotesRaw = safeArr<Record<string, unknown>>(timestamped?.notes).filter((note) =>
    [note.title, note.detail, note.action, note.evidence_summary].some(
      (candidate) => !!safeStr(candidate),
    ),
  );
  const legacyTimestampedNotes = safeArr<Record<string, unknown>>(report.timestamped_notes);
  const timelineRows: TimelineNoteRow[] = isS10
    ? timestampedNotesRaw.map((note) => ({
        displayLabel: safeStr(note.display_label),
        timecode: safeStr(note.timecode) ?? safeStr(note.start_time),
        section: safeStr(note.section),
        kind: timelineKind(safeStr(note.section)),
        title: safeStr(note.title),
        detail: safeStr(note.detail),
        action: safeStr(note.action),
        evidence: safeStr(note.evidence_summary),
        precision: safeStr(note.timestamp_precision),
      }))
    : legacyTimestampedNotes
        .filter((note) => safeStr(note.note) || safeStr(note.timestamp))
        .map((note) => ({
          displayLabel: safeStr(note.timestamp),
          timecode: safeStr(note.timestamp),
          section: null,
          kind: "info" as const,
          title: null,
          detail: safeStr(note.note),
          action: null,
          evidence: null,
          precision: null,
        }));
  const timestampedDisplay: TimestampedCommentaryDisplay = {
    summary: safeStr(timestamped?.summary),
    notes: timelineRows,
    missingComponents: displayStrings(timestamped?.missing_or_unobserved_components),
    timestampLimitations: displayStrings(timestamped?.timestamp_limitations),
  };
  const hasTimestampedContent =
    timestampedDisplay.notes.length > 0 || timestampedDisplay.missingComponents.length > 0;

  // ── professional competitive calibration (red-line gated) ──
  const professionalZone =
    isS10 && judgedAgainst?.toLowerCase().includes("professional")
      ? professionalCompetitiveScoreZone(overall)
      : null;
  const professionalCalibrationDisplay: ProfessionalCalibrationDisplay = {
    scoreZone: professionalZone,
    scoreSuppressor:
      categoryRows
        .map((row) => row.whyNotFullScore ?? row.closeGap)
        .find((value): value is string => Boolean(value)) ??
      itemText(safeArr(fixHierarchy?.optional_polish)[0]) ??
      itemText(safeArr(fixHierarchy?.should_improve_if_retaking)[0]),
    retakeStrategy:
      safeStr(nextActionPlan?.no_retake_needed_reason) ??
      displayStrings(nextActionPlan?.if_time_is_short_guidance)[0] ??
      itemText(safeArr(fixHierarchy?.should_improve_if_retaking)[0]),
    preserve:
      itemText(safeArr(strengthsAndPreserve?.preserve)[0]) ??
      itemText(safeArr(fixHierarchy?.preserve)[0]),
  };

  // ── same-video / comparison ──
  const sameVideo = safeObj(s10?.same_video_status);
  const comparison = safeObj(s10?.comparison_truth);
  const comparisonDisplayMode = safeStr(s10?.comparison_display_mode);
  const comparisonSummary =
    safeStr(s10?.comparison_summary) ??
    safeStr(comparison?.performer_facing_summary) ??
    safeStr(sameVideo?.performer_facing_summary);
  const comparisonWarning =
    safeStr(sameVideo?.comparison_warning) ?? safeStr(comparison?.comparison_warning);
  const comparisonLimitations = [
    ...safeStrArr(s10?.comparison_limitations),
    ...safeStrArr(comparison?.limitations),
    ...safeStrArr(sameVideo?.limitations),
  ];
  // Genuinely not-applicable (sole take) → hidden, per the hide-vs-empty policy.
  const comparisonHidden = comparisonDisplayMode === "hidden" || comparisonDisplayMode === null;

  // ── submission risk ──
  const legacyRiskFlags = !isS10
    ? safeArr<Record<string, unknown>>(report.risk_flags).filter(
        (flag) =>
          hasRenderableItem(flag) ||
          !!safeStr(safeObj(flag)?.flag) ||
          !!safeStr(safeObj(flag)?.severity),
      )
    : [];
  const s10RiskSource = sectionSource(sourceMap, "submission_risk");
  const s10HasRiskSource = s10RiskSource.source === "s10_authoritative_module";
  const s10HasBlockingDecision =
    !!decisionRaw && !["submit", "submit_if_deadline_is_close"].includes(decisionRaw);
  const riskRows: TitleDetailRow[] = isS10
    ? s10HasRiskSource || s10HasBlockingDecision
      ? rationaleRows
      : []
    : legacyRiskFlags.map((flag) => ({
        title: safeStr(flag.flag) ? sentenceLabelize(flag.flag) : safeStr(flag.severity),
        detail:
          itemDetail(flag) ??
          (safeStr(flag.flag) && safeStr(flag.severity)
            ? `Severity: ${sentenceLabelize(flag.severity)}`
            : null),
      }));
  const atRisk = typeof report.at_risk === "boolean" ? report.at_risk : null;

  // ── presentation notes ──
  const selfTapePresentation = safeObj(technique?.self_tape_presentation);
  const presentationNotes = isS10
    ? [
        ...displayStrings(selfTapePresentation?.what_is_working),
        ...displayStrings(professionalCritique?.professional_presentation_notes),
      ].slice(0, 6)
    : safeStrArr(report.presentation_notes);

  // ── role / material context ──
  const roleMaterialContext = roleMaterialAuthorized ? safeObj(s10?.role_material_context) : null;
  const legacyRoleFit = !isS10 ? safeObj(report.role_fit) : null;
  const roleMaterialRows: Array<[string, string]> = [];
  if (roleMaterialContext) {
    for (const [label, field] of [
      ["Role / material context", "context_summary"],
      ["Source basis", "source_basis_label"],
      ["Primary standard", "primary_standard"],
      ["Secondary context", "secondary_context"],
      ["Confidence", "confidence"],
    ] as Array<[string, string]>) {
      const value = safeStr(roleMaterialContext[field]);
      if (value) roleMaterialRows.push([label, value]);
    }
    // Lossless catch-all: surface any remaining primitive string fields the
    // named rows above did not cover, so no role/material claim is dropped.
    for (const [field, raw] of Object.entries(roleMaterialContext)) {
      const value = safeStr(raw);
      if (!value) continue;
      const known = [
        "context_summary",
        "source_basis_label",
        "primary_standard",
        "secondary_context",
        "confidence",
      ].includes(field);
      if (!known) roleMaterialRows.push([sentenceLabelize(field), value]);
    }
  }
  if (legacyRoleFit) {
    const notes = safeStr(legacyRoleFit.notes);
    if (notes) roleMaterialRows.push(["Role fit", notes]);
    const confidence = safeStr(legacyRoleFit.confidence);
    if (confidence) roleMaterialRows.push(["Confidence", confidence]);
  }

  // ── scoring context display ──
  const scoreVisibility = safeObj(scoringContext?.score_visibility);
  const scoringContextDisplay: ScoringContextDisplay = {
    scoringBasis,
    scoringBasisSummary: safeStr(scoringContext?.scoring_basis_summary),
    scoringMode: safeStr(scoringContext?.scoring_mode),
    requiredLimitations: displayStrings(scoringContext?.required_limitations),
    scoreVisibilityExplanation: safeStr(scoreVisibility?.explanation),
  };

  // ── limitations ──
  const limitations = safeStrArr(s10?.limitations);

  // ── meta ──
  const takeLabel =
    typeof takeMeta.takeSlot === "number"
      ? `Take ${takeMeta.takeSlot}`
      : typeof takeMeta.takeNumber === "number"
        ? `Take ${takeMeta.takeNumber}`
        : null;
  const meta: ReportMetaVM = {
    project: safeStr(briefContext?.project_name),
    role: safeStr(briefContext?.role_name),
    discipline: safeStr(briefContext?.discipline),
    auditionType: safeStr(takeMeta.auditionType) ?? safeStr(report.audition_type),
    takeLabel,
    takeVersionLabel:
      typeof takeMeta.takeVersionNumber === "number"
        ? `Version ${takeMeta.takeVersionNumber}`
        : null,
    takeVersionStatusLabel: safeStr(takeMeta.takeVersionStatus)
      ? sentenceLabelize(takeMeta.takeVersionStatus)
      : null,
    takeReplacementLabel: safeStr(takeMeta.replacesTakeId)
      ? "Replacement version; prior take proof is retained separately."
      : null,
    takeSameVideoLabel: safeStr(takeMeta.sameVideoStatus)
      ? sentenceLabelize(takeMeta.sameVideoStatus)
      : null,
    judgedAgainst,
    scoringBasis,
  };

  const scoringBasisLine = [
    scoringBasis ? `Scoring basis: ${scoringBasis}` : null,
    judgedAgainst ? `Judged against: ${judgedAgainst}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── assemble envelopes ──
  const env = <TData, TDisplay>(
    input: Omit<EnvelopeInput<TData, TDisplay>, "readinessResults">,
  ): ReportModuleEnvelope<TData, TDisplay> => buildEnvelope({ ...input, readinessResults });

  const modules: Record<ReportModuleKey, ReportModuleEnvelope> = {
    recommendation: env<unknown, RecommendationDisplay>({
      key: "recommendation",
      data: recommendation ?? (legacyVerdict ? { verdict: legacyVerdict } : null),
      display: {
        verdict: isS10 ? verdictDisplay(decisionRaw) : null,
        decisionRaw: decisionRaw ?? legacyVerdict,
        headline,
        scoreExplanation,
        rationale: rationaleRows,
        confidence: safeStr(recommendation?.confidence),
      },
      hasContent: Boolean(headline || scoreExplanation || decisionRaw || legacyVerdict),
    }),
    selectedLevelCalibration: env<unknown, SelectedLevelCalibrationDisplay>({
      key: "selectedLevelCalibration",
      data: levelCalibration,
      display: {
        judgedAgainst,
        standardApplied: safeStr(levelCalibration?.standard_applied),
        readinessStandard: safeStr(levelCalibration?.readiness_standard),
        scoreMeaning,
        scoreMeaningSuppressed: suppressesUnsupported90Claim,
        recommendationImpact: safeStr(levelCalibration?.recommendation_impact),
        comparisonToOtherLevels: safeStr(levelCalibration?.comparison_to_other_levels),
        meetsLevel: displayStrings(levelCalibration?.what_meets_level),
        fallsShort: displayStrings(levelCalibration?.what_falls_short),
      },
      hasContent: Boolean(
        judgedAgainst ||
        safeStr(levelCalibration?.standard_applied) ||
        scoreMeaning ||
        suppressesUnsupported90Claim ||
        displayStrings(levelCalibration?.what_meets_level).length > 0 ||
        displayStrings(levelCalibration?.what_falls_short).length > 0,
      ),
    }),
    scoreSummary: env<unknown, ScoreSummaryDisplay>({
      key: "scoreSummary",
      data: scoreSummary ?? legacyScores,
      display: {
        overall,
        overallTone: overall != null ? scoreTone(overall) : null,
        performanceQuality: safeNum(scoreSummary?.performance_quality_score),
        briefCompletion: safeNum(scoreSummary?.brief_completion_score),
        bandLabel: safeStr(scoreSummary?.score_band_label)
          ? sentenceLabelize(scoreSummary?.score_band_label)
          : null,
        categories: categoryRows,
      },
      hasContent: overall != null || categoryRows.length > 0,
      limitation: sourceLimitation(
        sourceMap,
        "category_scores",
        "S10 category score semantics are not available for this report.",
      ),
    }),
    scoringContext: env<unknown, ScoringContextDisplay>({
      key: "scoringContext",
      data: scoringContext,
      display: scoringContextDisplay,
      hasContent: Boolean(scoringBasis || scoringContextDisplay.scoringBasisSummary),
    }),
    roleMaterialContext: env<unknown, RoleMaterialContextDisplay>({
      key: "roleMaterialContext",
      data: roleMaterialContext ?? legacyRoleFit,
      display: { rows: roleMaterialRows },
      hasContent: roleMaterialRows.length > 0,
      // No role/material input on most runs — absence is normal, not a gap.
      emptyKindWhenAbsent: "hidden",
    }),
    briefContext: env<BriefContext | null, BriefContextDisplay>({
      key: "briefContext",
      data: (briefContext as BriefContext | null) ?? null,
      display: { rows: briefContextRows },
      hasContent: briefContextRows.length > 0,
      // No-brief baseline runs legitimately have no brief context.
      emptyKindWhenAbsent: "not_assessed",
    }),
    briefRequirements: env<BriefRequirement[] | null, BriefRequirementsDisplay>({
      key: "briefRequirements",
      data: briefRequirementsRaw.length > 0 ? (briefRequirementsRaw as never) : null,
      display: {
        requirements: briefRequirementRows,
        classificationCounts: classificationCounts(briefRequirementsRaw),
      },
      hasContent: briefRequirementRows.length > 0,
      emptyKindWhenAbsent: "not_assessed",
    }),
    briefAchievement: env<BriefAchievementMatrix | null, BriefAchievementDisplay>({
      key: "briefAchievement",
      data: (matrix as BriefAchievementMatrix | null) ?? null,
      display: {
        overallChip: statusChipDisplay(matrix?.overall_status),
        mandatoryStatus: safeStr(matrix?.mandatory_status)
          ? sentenceLabelize(matrix?.mandatory_status)
          : null,
        readinessImpact: safeStr(matrix?.readiness_impact)
          ? sentenceLabelize(matrix?.readiness_impact)
          : null,
        summary: safeStr(matrix?.summary),
        achievedCount,
        totalCount: achievementRows.length,
        requirements: achievementRows,
      },
      hasContent: Boolean(matrix && (achievementRows.length > 0 || safeStr(matrix.summary))),
      emptyKindWhenAbsent: "not_assessed",
    }),
    observedTape: env<unknown, ObservedTapeDisplay>({
      key: "observedTape",
      data: observedTape,
      display: {
        sequence: observedSequenceRows,
        media: mediaRows,
        uncertainties: mediaUncertainties,
      },
      hasContent: observedSequenceRows.length > 0 || mediaRows.length > 0,
    }),
    componentBreakdown: env<unknown, ComponentBreakdownDisplay>({
      key: "componentBreakdown",
      data: componentVerificationsRaw.length > 0 ? componentVerificationsRaw : null,
      display: { rows: componentRows },
      hasContent: componentRows.length > 0,
      limitation: sourceLimitation(
        sourceMap,
        "component_breakdown",
        "Component verification was unavailable for this S10 report.",
      ),
    }),
    fixHierarchy: env<S10FixHierarchy | null, FixHierarchyDisplay>({
      key: "fixHierarchy",
      data: (fixHierarchy as S10FixHierarchy | null) ?? null,
      display: fixDisplay,
      hasContent: hasFixContent,
      limitation: fixHierarchyLimitation,
    }),
    nextActionPlan: env<S10NextActionPlan | null, NextActionPlanDisplay>({
      key: "nextActionPlan",
      data: (nextActionPlan as S10NextActionPlan | null) ?? null,
      display: nextActionDisplay,
      hasContent: hasNextActionContent,
      limitation: nextActionLimitation,
    }),
    strengthsAndPreserve: env<unknown, StrengthsAndPreserveDisplay>({
      key: "strengthsAndPreserve",
      data: strengthsAndPreserve,
      display: strengthsDisplay,
      hasContent: hasStrengthsContent,
      limitation: strengthsLimitation,
    }),
    professionalCritique: env<S10ProfessionalCritique | null, ProfessionalCritiqueDisplay>({
      key: "professionalCritique",
      data: (professionalCritique as S10ProfessionalCritique | null) ?? null,
      display: critiqueDisplay,
      hasContent: hasCritiqueContent,
    }),
    techniqueCommentary: env<S10TechniqueCommentary | null, TechniqueCommentaryDisplay>({
      key: "techniqueCommentary",
      data: (technique as S10TechniqueCommentary | null) ?? null,
      display: techniqueDisplay,
      hasContent: hasTechniqueContent,
      limitation: techniqueLimitation,
    }),
    timestampedCommentary: env<S10TimestampedCommentary | null, TimestampedCommentaryDisplay>({
      key: "timestampedCommentary",
      data: (timestamped as S10TimestampedCommentary | null) ?? null,
      display: timestampedDisplay,
      hasContent: hasTimestampedContent,
    }),
    professionalCompetitiveCalibration: env<unknown, ProfessionalCalibrationDisplay>({
      key: "professionalCompetitiveCalibration",
      data: professionalZone ? { score_zone: professionalZone } : null,
      display: professionalCalibrationDisplay,
      hasContent: professionalZone !== null,
      // Only renders for Professional-level 90+ takes — otherwise hidden,
      // never an empty card (the 90+ zone language is a red-line elsewhere).
      emptyKindWhenAbsent: "hidden",
    }),
    sameVideoStatus: env<S10SameVideoEvidence | null, SameVideoDisplay>({
      key: "sameVideoStatus",
      data: (sameVideo as S10SameVideoEvidence | null) ?? null,
      display: {
        statusLabel: safeStr(sameVideo?.status) ? sentenceLabelize(sameVideo?.status) : null,
        performerSummary: safeStr(sameVideo?.performer_facing_summary),
        comparisonWarning: safeStr(sameVideo?.comparison_warning),
        limitations: safeStrArr(sameVideo?.limitations),
      },
      hasContent: Boolean(
        sameVideo &&
        safeStr(sameVideo.status) &&
        safeStr(sameVideo.status) !== "new_media" &&
        safeStr(sameVideo.performer_facing_summary),
      ),
      emptyKindWhenAbsent: "hidden",
    }),
    comparison: env<S10ComparisonTruth | null, ComparisonDisplay>({
      key: "comparison",
      data: (comparison as S10ComparisonTruth | null) ?? null,
      display: {
        displayMode: comparisonDisplayMode,
        summary: comparisonSummary,
        warning: comparisonWarning,
        limitations: comparisonLimitations,
      },
      hasContent: !comparisonHidden && Boolean(comparisonSummary || comparisonWarning),
      emptyKindWhenAbsent: "hidden",
    }),
    submissionRisk: env<unknown, SubmissionRiskDisplay>({
      key: "submissionRisk",
      data: riskRows.length > 0 || atRisk !== null ? { at_risk: atRisk, rows: riskRows } : null,
      display: { atRisk, flags: riskRows },
      hasContent: riskRows.length > 0,
      // No flags on an assessable tape is good news — render it as such.
      emptyKindWhenAbsent: "positive",
    }),
    presentationNotes: env<unknown, PresentationNotesDisplay>({
      key: "presentationNotes",
      data: presentationNotes.length > 0 ? presentationNotes : null,
      display: { notes: presentationNotes },
      hasContent: presentationNotes.length > 0,
      // S10.P1d fallback guard: when presentation notes are deliberately
      // omitted (no legacy recovery), the route must not mention them at
      // all — absence is hidden, not a "not assessed" gap. They are
      // cosmetic camera-readability tips and never affect the score.
      emptyKindWhenAbsent: "hidden",
    }),
    limitations: env<string[] | null, LimitationsDisplay>({
      key: "limitations",
      data: limitations.length > 0 ? limitations : null,
      display: { items: limitations },
      hasContent: limitations.length > 0,
      // No limitations recorded is good news, not a gap.
      emptyKindWhenAbsent: "positive",
    }),
  };

  return {
    version: "tc_report_vm_v1",
    sourceMode: isS10 ? "s10" : "legacy",
    meta,
    scoringBasisLine,
    reportStatus: {
      status: safeStr(report.report_status),
      limitationReason: safeStr(report.limitation_reason),
      isLimited: isLimitedS10Report,
    },
    modules,
    limitations,
    rawFallback: report,
  };
}

// ── cost attribution (estimated; pure math) ───────────────────────────────
//
// take_ai_usage rows are per AI CALL; Step 2 is one composed call, so
// per-module cost is an ESTIMATE: the step's real cost is redistributed
// proportional to each module's serialized output size (Step 2) or the
// serialized size of its Step 1 evidence fields (Step 1). Totals always
// reconcile to the sum of the real rows — estimation redistributes within a
// step, never invents spend. Render with an "est." label only.

export type AiUsageRowLite = {
  step: string | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
};

export type ModuleCostEstimate = {
  key: ReportModuleKey;
  estTokens: number;
  estCostUsd: number;
  basis: "estimated";
};

export type ReportCostAttribution = {
  perModule: ModuleCostEstimate[];
  overheadCostUsd: number;
  overheadTokens: number;
  totalCostUsd: number;
  totalTokens: number;
};

const STEP1_STEPS = new Set(["evidence_pass"]);
const STEP2_STEPS = new Set(["report_polish", "single_pass_report"]);

function moduleJsonSize(value: unknown): number {
  if (value == null) return 0;
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function proportionalSplit(
  totalCost: number,
  totalTokens: number,
  weights: Map<ReportModuleKey, number>,
): Map<ReportModuleKey, { cost: number; tokens: number }> {
  const out = new Map<ReportModuleKey, { cost: number; tokens: number }>();
  const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return out;
  for (const [key, weight] of weights) {
    const share = weight / totalWeight;
    out.set(key, { cost: totalCost * share, tokens: totalTokens * share });
  }
  return out;
}

export function estimateReportModuleCosts(
  usageRows: AiUsageRowLite[],
  viewModel: Pick<ReportViewModel, "modules">,
  step1Evidence?: Record<string, unknown> | null,
): ReportCostAttribution {
  const totals = { cost: 0, tokens: 0 };
  const stepTotals = new Map<"step1" | "step2" | "other", { cost: number; tokens: number }>([
    ["step1", { cost: 0, tokens: 0 }],
    ["step2", { cost: 0, tokens: 0 }],
    ["other", { cost: 0, tokens: 0 }],
  ]);
  for (const row of usageRows) {
    const cost = safeNum(row.estimated_cost_usd) ?? 0;
    const tokens = safeNum(row.total_tokens) ?? 0;
    totals.cost += cost;
    totals.tokens += tokens;
    const bucket = STEP1_STEPS.has(row.step ?? "")
      ? "step1"
      : STEP2_STEPS.has(row.step ?? "")
        ? "step2"
        : "other";
    const entry = stepTotals.get(bucket)!;
    entry.cost += cost;
    entry.tokens += tokens;
  }

  // Step 2 weights: serialized size of each module's lossless data.
  const step2Weights = new Map<ReportModuleKey, number>();
  for (const key of REPORT_MODULE_KEYS) {
    const size = moduleJsonSize(viewModel.modules[key]?.data);
    if (size > 0) step2Weights.set(key, size);
  }

  // Step 1 weights: serialized size of each module's named evidence fields.
  const step1Weights = new Map<ReportModuleKey, number>();
  if (step1Evidence) {
    for (const key of REPORT_MODULE_KEYS) {
      const fields = REPORT_MODULE_PROVENANCE[key].step1EvidenceFields;
      const size = fields.reduce(
        (acc, field) => acc + moduleJsonSize((step1Evidence as Record<string, unknown>)[field]),
        0,
      );
      if (size > 0) step1Weights.set(key, size);
    }
  }

  const step2 = stepTotals.get("step2")!;
  const step1 = stepTotals.get("step1")!;
  const step2Split = proportionalSplit(step2.cost, step2.tokens, step2Weights);
  const step1Split = proportionalSplit(step1.cost, step1.tokens, step1Weights);

  const perModule: ModuleCostEstimate[] = [];
  let attributedCost = 0;
  let attributedTokens = 0;
  for (const key of REPORT_MODULE_KEYS) {
    const a = step2Split.get(key);
    const b = step1Split.get(key);
    const cost = (a?.cost ?? 0) + (b?.cost ?? 0);
    const tokens = (a?.tokens ?? 0) + (b?.tokens ?? 0);
    if (cost <= 0 && tokens <= 0) continue;
    attributedCost += cost;
    attributedTokens += tokens;
    perModule.push({ key, estTokens: Math.round(tokens), estCostUsd: cost, basis: "estimated" });
  }

  return {
    perModule,
    overheadCostUsd: Math.max(0, totals.cost - attributedCost),
    overheadTokens: Math.max(0, Math.round(totals.tokens - attributedTokens)),
    totalCostUsd: totals.cost,
    totalTokens: totals.tokens,
  };
}
