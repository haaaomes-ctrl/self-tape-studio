// SERVER-ONLY. Evidence-backed S10 report fallback for recoverable Step 2
// polish parser failures. This must never invent professional judgement.

import type { BriefRequirement } from "@/lib/audition-rules";
import type {
  ComponentVerification,
  EvidencePass,
  MediaObservationSummary,
  ObservedTapeSequence,
} from "./evidence-pass.server";
import { normaliseBriefAchievementMatrix } from "./s10-brief-achievement-matrix.server";
import { normaliseReadinessScoreJudgement } from "./s10-readiness-score-semantics.server";
import { applyS10FixHierarchyNextAction } from "./s10-fix-hierarchy-next-action.server";
import { normaliseS10ProfessionalCritique } from "./s10-strengths-preserve-professional-critique.server";
import { normaliseS10TechniqueCommentary } from "./s10-technique-library-commentary.server";
import { normaliseS10TimestampedCommentary } from "./s10-timestamped-commentary.server";

type FallbackMode = "brief" | "baseline";
type S10EvidenceRecoveryKind = "polish_parser" | "module_quality";

export type BuildS10ReportPolishFallbackInput = {
  evidence: EvidencePass | null;
  briefContext?: unknown;
  briefRequirements?: BriefRequirement[] | null;
  auditionTitle: string;
  selectedLevel?: string | null;
  mode: FallbackMode;
  reason: string;
  retryAttempted: boolean;
  retrySucceeded: boolean;
  recoveryKind?: S10EvidenceRecoveryKind;
};

export type BuildS10ReportPolishFallbackResult =
  | { ok: true; report: Record<string, unknown>; limitationCount: number }
  | { ok: false; reason: string };

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function evidenceList(values: unknown[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = text(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function clampScore(value: unknown, fallback = 0): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function averageScore(values: Array<number | null | undefined>): number {
  const nums = values.filter((value): value is number => typeof value === "number");
  if (nums.length === 0) return 0;
  return clampScore(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function hasMinimumStep1Evidence(evidence: EvidencePass | null): evidence is EvidencePass {
  if (!evidence || typeof evidence !== "object") return false;
  const hasObservation =
    (evidence.observed_tape_sequence?.length ?? 0) > 0 ||
    (evidence.component_verifications?.length ?? 0) > 0 ||
    (evidence.timestamped_evidence?.length ?? 0) > 0 ||
    evidence.core_strengths_evidence.length > 0 ||
    evidence.core_improvements_evidence.length > 0 ||
    evidence.candidate_technique_evidence?.length;
  const sufficiency = evidence.evidence_sufficiency;
  const hasAssessableSignal =
    sufficiency.audio_assessable ||
    sufficiency.video_assessable ||
    sufficiency.acting_assessable ||
    sufficiency.vocal_assessable ||
    sufficiency.movement_assessable ||
    sufficiency.brief_assessable;
  return Boolean(hasObservation && hasAssessableSignal);
}

function componentStatus(status: ComponentVerification["observed_status"]) {
  if (status === "present") return "present";
  if (status === "partially_present") return "partially_present";
  if (status === "absent") return "absent";
  if (status === "not_assessable") return "not_assessable";
  return "uncertain";
}

function sourceCategoryFor(componentType: string | undefined, fallback = "performance") {
  if (componentType === "acting_scene") return "acting";
  if (componentType === "song") return "vocal";
  if (componentType === "dance" || componentType === "movement") return "movement";
  if (componentType === "technical") return "technical";
  return fallback;
}

function firstSequenceForRequirement(
  requirementId: string,
  sequence: ObservedTapeSequence[],
): ObservedTapeSequence | null {
  return (
    sequence.find((item) => item.linked_requirement_ids.includes(requirementId)) ??
    sequence.find((item) => item.evidence_summary) ??
    null
  );
}

function componentLabel(value: ComponentVerification | ObservedTapeSequence): string {
  return text(
    "requirement_summary" in value ? value.requirement_summary : value.label,
    "observed component",
  );
}

function componentSummary(value: ComponentVerification | ObservedTapeSequence): string {
  return text(value.evidence_summary, "Step 1 observed this component in the tape.");
}

function techniqueAreaForEvidence(value: ComponentVerification | ObservedTapeSequence) {
  const combined = `${componentLabel(value)} ${componentSummary(value)} ${
    "component_type" in value ? value.component_type : ""
  }`;
  if (/\bsong|sing|vocal|voice\b/i.test(combined)) return "vocal_singing";
  if (/\bdance|movement|physical|choreo\b/i.test(combined)) return "movement_dance";
  if (/\bcommercial|screen|copy\b/i.test(combined)) return "commercial_screen_task";
  if (/\bself[-\s]?tape|presentation|framing|audio|video|technical\b/i.test(combined)) {
    return "self_tape_presentation";
  }
  return "acting";
}

function buildStrengths(
  evidence: EvidencePass,
  componentVerifications: ComponentVerification[],
  observedTapeSequence: ObservedTapeSequence[],
) {
  const verified = componentVerifications.filter(
    (item) => item.observed_status === "present" || item.observed_status === "partially_present",
  );
  const fromComponents = verified.slice(0, 6).map((item, index) => {
    const sequence = firstSequenceForRequirement(item.requirement_id, observedTapeSequence);
    const sourceCategory = sourceCategoryFor(sequence?.component_type, "performance");
    return {
      id: `polish_fallback_strength_${index + 1}`,
      title: `Verified evidence for ${item.requirement_summary}`,
      detail: item.evidence_summary,
      why_it_matters:
        "This is included because Step 1 observed the component directly; it is not an added polish judgement.",
      evidence_summary: item.evidence_summary,
      source_category: sourceCategory,
      linked_requirement_ids: [item.requirement_id],
      linked_component_verification_ids: [item.requirement_id],
      linked_matrix_result_ids: [item.requirement_id],
      confidence: item.confidence,
      is_component_verified: true,
      component_status: componentStatus(item.observed_status),
      applies_to_observed_portion_only:
        item.completion_status === "incomplete" || item.completion_status === "cut_off",
    };
  });

  const fromStep1 = evidence.core_strengths_evidence.slice(0, 4).map((item, index) => ({
    id: `polish_fallback_step1_strength_${index + 1}`,
    title: `Step 1 ${item.area || "observed"} evidence`,
    detail: item.evidence,
    why_it_matters:
      "This is a locked Step 1 observation, so the fallback can preserve it without inventing extra judgement.",
    evidence_summary: item.evidence,
    source_category: "performance",
    linked_requirement_ids: [],
    linked_component_verification_ids: [],
    linked_matrix_result_ids: [],
    confidence: "medium",
    is_component_verified: verified.length > 0,
    component_status: verified.length > 0 ? "present" : "uncertain",
    applies_to_observed_portion_only: false,
  }));

  return [...fromComponents, ...fromStep1].filter((item) => text(item.detail)).slice(0, 8);
}

function buildLevelMeetsEvidence(
  evidence: EvidencePass,
  componentVerifications: ComponentVerification[],
  observedTapeSequence: ObservedTapeSequence[],
  mediaObservationSummary: MediaObservationSummary | null,
) {
  return evidenceList(
    [
      ...evidence.core_strengths_evidence.map((item) => item.evidence),
      ...componentVerifications.map(
        (item) =>
          `${item.requirement_summary}: ${item.evidence_summary}. This is observed Step 1 evidence for the selected-level standard.`,
      ),
      ...observedTapeSequence.map(
        (item) =>
          `${item.label}: ${item.evidence_summary}. This supports observable performance/setup calibration.`,
      ),
      evidence.category_notes_evidence.acting,
      evidence.category_notes_evidence.audio,
      evidence.category_notes_evidence.technical,
      mediaObservationSummary?.duration_summary,
      evidence.evidence_sufficiency.audio_assessable ||
      evidence.evidence_sufficiency.video_assessable
        ? "Step 1 confirmed assessable media evidence, so the level judgement can use observable performance and setup rather than failing the report."
        : "",
    ],
    6,
  );
}

function buildLevelShortfallEvidence(input: {
  evidence: EvidencePass;
  matrix: ReturnType<typeof normaliseBriefAchievementMatrix>;
  mode: FallbackMode;
}) {
  // The matrix requirement arrays hold raw requirement IDs (e.g. "br006") for
  // internal linking. Render the human-readable requirement summary instead, and
  // drop any ID that cannot be resolved, so a raw truth/requirement ID never
  // leaks into performer-facing prose (high-risk red line).
  const summaryById = new Map(
    input.matrix.requirement_results.map((result) => [
      result.requirement_id,
      result.requirement_summary,
    ]),
  );
  const requirementText = (ids: string[], suffix: string): string[] =>
    ids
      .map((id) => summaryById.get(id))
      .filter(
        (summary): summary is string => typeof summary === "string" && summary.trim().length > 0,
      )
      .map((summary) => `${summary}${suffix}`);
  return evidenceList(
    [
      ...input.evidence.core_improvements_evidence.map((item) => item.evidence),
      input.evidence.fix_first_evidence,
      ...requirementText(
        input.matrix.missing_or_incomplete_requirements,
        " is missing or incomplete.",
      ),
      ...requirementText(
        input.matrix.not_assessable_requirements,
        " could not be assessed from the observed tape.",
      ),
      input.mode === "baseline"
        ? "No supplied brief was available, so TapeCoach cannot judge brief fit, required-material completion, deadline, upload or file-compliance claims from this run."
        : "",
      input.evidence.candidate_technique_evidence?.length
        ? ""
        : "Detailed technique nuance is limited because Step 1 did not provide safe candidate technique observations beyond component and media evidence.",
      input.evidence.evidence_sufficiency.notes,
    ],
    6,
  );
}

function buildTechniqueCommentary(evidence: EvidencePass, kind: S10EvidenceRecoveryKind) {
  const observations = evidence.candidate_technique_evidence ?? [];
  const techniqueItems = observations
    .map((item, index) => {
      const summary = text(item.safe_evidence_summary) || text(item.evidence);
      if (!summary) return null;
      const area = /sing|vocal|voice/i.test(`${item.label} ${summary}`)
        ? "vocal_singing"
        : /dance|movement|physical/i.test(`${item.label} ${summary}`)
          ? "movement_dance"
          : "acting";
      return {
        id: `polish_fallback_technique_${index + 1}`,
        technique_area: area,
        title: text(item.label, "Step 1 technique evidence"),
        detail: summary,
        evidence_summary: summary,
        linked_requirement_ids: [],
        linked_component_verification_ids: [],
        linked_matrix_result_ids: [],
        linked_readiness_reason_ids: [],
        linked_strength_ids: [],
        linked_fix_ids: [],
        linked_timestamp_refs: item.timestamp ? [item.timestamp] : [],
        component_status: "present",
        confidence: "medium",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 6);
  const componentItems = [
    ...(evidence.component_verifications ?? []),
    ...(evidence.observed_tape_sequence ?? []),
  ]
    .map((item, index) => {
      const label = componentLabel(item);
      const summary = componentSummary(item);
      if (!summary) return null;
      const area = techniqueAreaForEvidence(item);
      return {
        id: `polish_fallback_component_technique_${index + 1}`,
        technique_area: area,
        title:
          area === "self_tape_presentation"
            ? "Self-tape presentation evidence"
            : `Component-level ${label} evidence`,
        detail: `${summary} Use this as component-level guidance; do not infer detailed technique beyond what Step 1 observed.`,
        evidence_summary: summary,
        linked_requirement_ids:
          "requirement_id" in item ? [item.requirement_id] : item.linked_requirement_ids,
        linked_component_verification_ids: "requirement_id" in item ? [item.requirement_id] : [],
        linked_matrix_result_ids:
          "requirement_id" in item ? [item.requirement_id] : item.linked_requirement_ids,
        linked_readiness_reason_ids: [],
        linked_strength_ids: [],
        linked_fix_ids: [],
        linked_timestamp_refs:
          "timestamp_refs" in item
            ? item.timestamp_refs
            : [item.start_time, item.end_time].filter((value): value is string => Boolean(value)),
        component_status: componentStatus(
          "observed_status" in item ? item.observed_status : item.present_status,
        ),
        confidence: "medium",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const mediaPresentationItem =
    evidence.media_observation_summary &&
    (evidence.media_observation_summary.audio_assessable ||
      evidence.media_observation_summary.video_assessable ||
      evidence.media_observation_summary.framing_assessable)
      ? {
          id: "polish_fallback_media_presentation_1",
          technique_area: "self_tape_presentation",
          title: "Assessable self-tape setup",
          detail: text(
            evidence.media_observation_summary.duration_summary,
            "Step 1 confirmed enough audio/video/framing evidence for practical self-tape presentation guidance.",
          ),
          evidence_summary: text(
            evidence.media_observation_summary.duration_summary,
            "Audio/video/framing were assessable in Step 1.",
          ),
          linked_requirement_ids: [],
          linked_component_verification_ids: [],
          linked_matrix_result_ids: [],
          linked_readiness_reason_ids: [],
          linked_strength_ids: [],
          linked_fix_ids: [],
          linked_timestamp_refs: [],
          component_status: "present",
          confidence: "medium",
        }
      : null;
  const allTechniqueItems = [...techniqueItems, ...componentItems, mediaPresentationItem]
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 10);

  const byArea = (area: string) => allTechniqueItems.filter((item) => item.technique_area === area);
  const sectionActions = (area: string) =>
    byArea(area).length > 0
      ? [
          "Use the verified component/media evidence as the next recording check; avoid adding unsupported technique claims.",
        ]
      : [];
  return {
    summary:
      allTechniqueItems.length > 0
        ? kind === "module_quality"
          ? "Technique commentary is limited to locked Step 1 evidence because module-readiness checks rejected the thin polished modules."
          : "Technique commentary is limited to locked Step 1 evidence because the polish response was unusable."
        : "Technique commentary is limited because Step 1 did not provide enough technique-specific evidence.",
    acting: {
      observations: byArea("acting"),
      what_is_working: byArea("acting")
        .map((item) => item.detail)
        .slice(0, 3),
      practical_actions: sectionActions("acting"),
    },
    vocal_singing: {
      observations: byArea("vocal_singing"),
      what_is_working: byArea("vocal_singing")
        .map((item) => item.detail)
        .slice(0, 3),
      practical_actions: sectionActions("vocal_singing"),
    },
    movement_dance: {
      observations: byArea("movement_dance"),
      what_is_working: byArea("movement_dance")
        .map((item) => item.detail)
        .slice(0, 3),
      practical_actions: sectionActions("movement_dance"),
    },
    musical_theatre_package: {
      observations: byArea("musical_theatre_package"),
      what_is_working: byArea("musical_theatre_package")
        .map((item) => item.detail)
        .slice(0, 3),
      practical_actions: sectionActions("musical_theatre_package"),
    },
    self_tape_presentation: {
      observations: byArea("self_tape_presentation"),
      what_is_working: byArea("self_tape_presentation")
        .map((item) => item.detail)
        .slice(0, 3),
      practical_actions: sectionActions("self_tape_presentation"),
    },
    limitations: ["This fallback does not add technique claims beyond locked Step 1 evidence."],
  };
}

function buildTimestampedCommentary(evidence: EvidencePass) {
  const exactNotes = evidence.timestamped_evidence.slice(0, 12).map((item, index) => ({
    id: `polish_fallback_timestamp_${index + 1}`,
    timecode: item.timestamp,
    start_time: item.timestamp,
    display_label: item.timestamp,
    timestamp_precision: "exact",
    section: "observed_component",
    title: item.observation,
    detail: item.why_it_matters,
    action: null,
    evidence_summary: item.observation,
    linked_requirement_ids: [],
    linked_observed_sequence_ids: [],
    linked_component_verification_ids: [],
    linked_matrix_result_ids: [],
    linked_fix_ids: [],
    linked_strength_ids: [],
    linked_technique_observation_ids: [],
    component_type: "unknown",
    component_status: "present",
    is_exact_timestamp_supported: true,
    note_source_authority: "step1_timestamped_evidence",
    confidence: "medium",
  }));
  const notes =
    exactNotes.length > 0
      ? exactNotes
      : (evidence.observed_tape_sequence ?? []).slice(0, 8).map((item, index) => ({
          id: `polish_fallback_component_note_${index + 1}`,
          timecode: item.start_time || "Component order only",
          start_time: item.start_time || null,
          display_label: item.start_time || item.label || `Component ${index + 1}`,
          timestamp_precision: item.start_time ? "approximate" : "component_order",
          section: "observed_component",
          title: text(item.label, `Observed component ${index + 1}`),
          detail: text(
            item.evidence_summary || item.assessability_notes,
            "Step 1 identified this component in the observed tape sequence.",
          ),
          action:
            item.completion_status === "complete"
              ? "Preserve this component in the final export."
              : "Review this component before submitting.",
          evidence_summary: text(
            item.evidence_summary || item.assessability_notes,
            "Observed from Step 1 component evidence.",
          ),
          linked_requirement_ids: item.linked_requirement_ids,
          linked_observed_sequence_ids: [item.id],
          linked_component_verification_ids: [],
          linked_matrix_result_ids: item.linked_requirement_ids,
          linked_fix_ids: [],
          linked_strength_ids: [],
          linked_technique_observation_ids: [],
          component_type: item.component_type,
          component_status: item.present_status,
          is_exact_timestamp_supported: false,
          note_source_authority: "step1_observed_tape_sequence",
          confidence: item.confidence,
        }));
  return {
    summary:
      exactNotes.length > 0
        ? "Time-based notes are projected only from locked Step 1 timestamp evidence."
        : notes.length > 0
          ? "Exact timestamps were unavailable, so this section uses Step 1 component-order evidence."
          : "No exact timestamp or component-order evidence was available from Step 1.",
    notes,
    timestamp_limitations:
      exactNotes.length > 0
        ? ["No additional timestamps were invented by the fallback."]
        : [
            "Step 1 did not provide safe exact timestamp evidence; component-order notes are used instead.",
          ],
  };
}

function buildRawFixHierarchy(evidence: EvidencePass) {
  const improvements = evidence.core_improvements_evidence.slice(0, 5).map((item, index) => ({
    id: `polish_fallback_improvement_${index + 1}`,
    title: `Address ${item.area || "the Step 1 improvement"}`,
    issue: item.evidence,
    why_it_matters:
      "This comes from locked Step 1 improvement evidence and is kept evidence-bound.",
    exact_action: item.evidence,
    source_category: "performance",
    urgency: index === 0 ? "medium" : "low",
    submission_impact: "review_carefully",
    evidence_summary: item.evidence,
    confidence: "medium",
    is_fix_first_candidate: index === 0,
    source_authority: "s10_normalised",
  }));
  const fixFirst = text(evidence.fix_first_evidence)
    ? {
        id: "polish_fallback_fix_first",
        title: "Start with the verified Step 1 priority",
        issue: evidence.fix_first_evidence,
        why_it_matters:
          "This is the locked Step 1 priority note; no extra polish judgement was added.",
        exact_action: evidence.fix_first_evidence,
        source_category: "performance",
        urgency: "high",
        submission_impact: "review_carefully",
        evidence_summary: evidence.fix_first_evidence,
        confidence: "medium",
        is_fix_first_candidate: true,
        source_authority: "s10_normalised",
      }
    : null;
  return {
    fix_first: fixFirst,
    priority_fixes: [fixFirst, ...improvements].filter(Boolean),
    should_improve_if_retaking: improvements,
    optional_polish: [],
    preserve: [],
    do_not_overfix: [],
  };
}

function buildFallbackLimitations(evidence: EvidencePass, kind: S10EvidenceRecoveryKind): string[] {
  const recoveryReason =
    kind === "module_quality"
      ? "The polished report left critical S10 modules unavailable, so this report is recovered from locked Step 1 evidence."
      : "The polish provider returned unusable structured content, so this report is recovered from locked Step 1 evidence.";
  return evidenceList(
    [
      recoveryReason,
      "No professional judgement has been added beyond observed Step 1 evidence and deterministic brief/component checks.",
      evidence.evidence_sufficiency.notes,
    ],
    8,
  );
}

function fallbackDecision(matrixImpact: unknown, overallScore: number, scoresAvailable: boolean) {
  if (matrixImpact === "submission_blocker") return "retake_required_if_possible";
  // No genuine category scores were produced (Step 1 under-produced). Do NOT
  // infer "retake required" from a defaulted 0 — that contradicts a supported
  // brief achievement. Decide from brief achievement only and route to a
  // review, since this is a degraded evidence-only report.
  if (!scoresAvailable) return "review_carefully";
  if (overallScore >= 85) return "submit";
  if (overallScore >= 70) return "submit_if_deadline_is_close";
  if (overallScore >= 55) return "review_carefully";
  return "retake_required_if_possible";
}

function buildCategoryScores(input: {
  evidence: EvidencePass;
  scores: {
    technical: number;
    audio: number;
    vocal: number | null;
    acting: number;
    brief_adherence: number;
    professional_presentation: number;
  };
  mode: FallbackMode;
}) {
  const notes = input.evidence.category_notes_evidence;
  const buildRow = (
    categoryId:
      | "acting"
      | "vocal"
      | "audio"
      | "technical"
      | "brief_adherence"
      | "professional_presentation",
    score: number | null,
    note: string,
    fallbackBasis: string,
  ) => ({
    category_id: categoryId,
    score,
    score_basis: text(note, fallbackBasis),
    what_works: text(note, fallbackBasis),
    why_not_full_score:
      score != null && score >= 95
        ? "Step 1 evidence left only narrow refinements visible for this category."
        : "The score is limited to locked Step 1 evidence; no extra polish judgement was invented.",
    close_gap:
      categoryId === "brief_adherence" && input.mode === "baseline"
        ? "No brief was supplied, so use this as baseline setup/performance guidance only."
        : "Use the named Step 1 evidence and component checks as the next recording focus.",
    confidence: "medium",
    blocked_or_not_assessable_reason:
      categoryId === "brief_adherence" && input.mode === "baseline"
        ? "No supplied brief was available; brief achievement is not assessed."
        : null,
  });

  return [
    buildRow("acting", input.scores.acting, notes.acting, "Acting evidence was assessable."),
    buildRow(
      "vocal",
      input.scores.vocal,
      notes.vocal,
      "Vocal evidence was assessable where present.",
    ),
    buildRow("audio", input.scores.audio, notes.audio, "Audio was assessable."),
    buildRow(
      "technical",
      input.scores.technical,
      notes.technical,
      "Technical setup was assessable.",
    ),
    buildRow(
      "brief_adherence",
      input.scores.brief_adherence,
      input.mode === "baseline"
        ? "No brief was supplied; this score is baseline task-readability, not brief achievement."
        : notes.brief_adherence,
      "Brief/component evidence was assessed from locked Step 1 evidence.",
    ),
    buildRow(
      "professional_presentation",
      input.scores.professional_presentation,
      notes.professional_presentation,
      "Presentation was assessable from locked Step 1 evidence.",
    ),
  ];
}

function normaliseFallbackMatrix(input: {
  mode: FallbackMode;
  briefRequirements: BriefRequirement[];
  componentVerifications: ComponentVerification[];
  observedTapeSequence: ObservedTapeSequence[];
  mediaObservationSummary: MediaObservationSummary | null;
}) {
  let matrix = normaliseBriefAchievementMatrix({
    matrix: null,
    briefRequirements: input.briefRequirements,
    componentVerifications: input.componentVerifications,
    observedTapeSequence: input.observedTapeSequence,
    mediaObservationSummary: input.mediaObservationSummary,
  });
  if (input.mode === "baseline" && input.briefRequirements.length === 0) {
    matrix = {
      ...matrix,
      overall_status: "not_assessable",
      mandatory_status: "not_assessable",
      readiness_impact: "not_assessable",
      summary: "No brief was supplied, so brief achievement is not assessed.",
      achieved_requirements: [],
      missing_or_incomplete_requirements: [],
      not_assessable_requirements: ["No supplied brief was available for requirement checks."],
      final_check_requirements: [],
      requirement_results: [],
    };
  }
  return matrix;
}

function buildFallbackScores(evidence: EvidencePass) {
  const scores = {
    technical: clampScore(evidence.raw_scores.technical),
    audio: clampScore(evidence.raw_scores.audio),
    vocal:
      typeof evidence.raw_scores.vocal === "number" ? clampScore(evidence.raw_scores.vocal) : null,
    acting: clampScore(evidence.raw_scores.acting),
    brief_adherence: clampScore(evidence.raw_scores.brief_adherence),
    professional_presentation: clampScore(evidence.raw_scores.professional_presentation),
  };
  const overallScore = averageScore([
    scores.technical,
    scores.audio,
    scores.vocal,
    scores.acting,
    scores.brief_adherence,
    scores.professional_presentation,
  ]);
  // Distinguish "Step 1 returned real category scores" from "Step 1 under-
  // produced and the scores were defaulted to 0". When Step 1 truncates/omits
  // raw_scores they all default to 0, which must NOT be read as a genuine
  // zero-readiness score that forces a retake verdict.
  const scoresAvailable = [
    evidence.raw_scores.technical,
    evidence.raw_scores.audio,
    evidence.raw_scores.acting,
    evidence.raw_scores.brief_adherence,
    evidence.raw_scores.professional_presentation,
  ].some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  return { scores, overallScore, scoresAvailable };
}

export function buildS10ReportPolishFallback(
  input: BuildS10ReportPolishFallbackInput,
): BuildS10ReportPolishFallbackResult {
  if (!hasMinimumStep1Evidence(input.evidence)) {
    return { ok: false, reason: "missing_or_insufficient_step1_evidence" };
  }

  const evidence = input.evidence;
  const recoveryKind = input.recoveryKind ?? "polish_parser";
  const briefRequirements = input.briefRequirements ?? [];
  const observedTapeSequence = evidence.observed_tape_sequence ?? [];
  const componentVerifications = evidence.component_verifications ?? [];
  const mediaObservationSummary = evidence.media_observation_summary ?? null;
  const { scores, overallScore, scoresAvailable } = buildFallbackScores(evidence);
  // When Step 1 produced no real category scores, withhold the numeric score
  // (render as "—") rather than showing a misleading 0.
  const displayOverallScore = scoresAvailable ? overallScore : null;

  const report: Record<string, unknown> = {
    source_mode: "s10_ai_report_model",
    schema_version: "v1-legacy",
    mode: input.mode === "brief" ? "brief" : "baseline",
    audition_type: evidence.audition_type,
    audition_title: input.auditionTitle,
    scores,
    overall_score: displayOverallScore,
    confidence: "medium",
    detected_components: evidence.detected_components,
    brief_context: input.briefContext ?? null,
    brief_requirements: briefRequirements,
    observed_tape_sequence: observedTapeSequence,
    component_verifications: componentVerifications,
    media_observation_summary: mediaObservationSummary,
    report_polish_fallback_used: recoveryKind === "polish_parser",
    polish_fallback_reason: recoveryKind === "polish_parser" ? input.reason : null,
    polish_retry_attempted: recoveryKind === "polish_parser" ? input.retryAttempted : false,
    polish_retry_succeeded: recoveryKind === "polish_parser" ? input.retrySucceeded : false,
    s10_module_quality_recovery_used: recoveryKind === "module_quality",
    module_quality_recovery_reason: recoveryKind === "module_quality" ? input.reason : null,
    module_repair_retry_attempted: recoveryKind === "module_quality" ? input.retryAttempted : false,
    module_repair_retry_succeeded: recoveryKind === "module_quality" ? input.retrySucceeded : false,
    fallback_limitations: buildFallbackLimitations(evidence, recoveryKind),
    strengths: evidence.core_strengths_evidence.map((item) => item.evidence).filter(Boolean),
    improvements: evidence.core_improvements_evidence.map((item) => item.evidence).filter(Boolean),
    timestamped_notes: evidence.timestamped_evidence.map((item) => ({
      timestamp: item.timestamp,
      note: `${item.observation} - ${item.why_it_matters}`,
    })),
  };

  const matrix = normaliseFallbackMatrix({
    mode: input.mode,
    briefRequirements,
    componentVerifications,
    observedTapeSequence,
    mediaObservationSummary,
  });
  report.brief_achievement_matrix = matrix;
  const decision = fallbackDecision(matrix.readiness_impact, overallScore, scoresAvailable);

  const readiness = normaliseReadinessScoreJudgement({
    judgement: {
      decision,
      headline:
        matrix.readiness_impact === "submission_blocker"
          ? "Retake if possible to address the verified brief blocker."
          : "Review this evidence-backed fallback report before deciding whether to submit.",
      rationale: [
        matrix.summary,
        recoveryKind === "module_quality"
          ? "This report was recovered from locked Step 1 evidence after module-readiness checks found critical unavailable S10 modules."
          : "This report was recovered from locked Step 1 evidence after the polish provider returned unusable structured content.",
      ],
      confidence: "medium",
      performance_quality_score: displayOverallScore,
      brief_completion_score: scoresAvailable ? scores.brief_adherence : null,
      overall_submission_readiness_score: displayOverallScore,
      score_explanation: !scoresAvailable
        ? "A numeric readiness score was withheld because Step 1 did not return category scores for this run; the recommendation is based on observed brief achievement and the locked evidence."
        : recoveryKind === "module_quality"
          ? "The visible score is derived from locked Step 1 category evidence and deterministic S10 checks after the polished report left critical modules unavailable."
          : "The visible score is derived from locked Step 1 category evidence and deterministic S10 checks, not from a completed polish pass.",
      performance_quality_summary:
        "Performance quality is limited to what Step 1 observed and recorded as evidence.",
      technical_assessability_summary:
        mediaObservationSummary?.duration_summary ??
        "Technical assessability is limited to locked Step 1 media evidence.",
      selected_level_calibration: {
        selected_level: input.selectedLevel,
        what_meets_level: buildLevelMeetsEvidence(
          evidence,
          componentVerifications,
          observedTapeSequence,
          mediaObservationSummary,
        ),
        what_falls_short: buildLevelShortfallEvidence({
          evidence,
          matrix,
          mode: input.mode,
        }),
        recommendation_impact:
          input.mode === "baseline"
            ? "Read the recommendation as selected-level baseline performance/setup guidance only because no supplied brief was available for brief-fit or required-material judgement."
            : recoveryKind === "module_quality"
              ? "Selected-level guidance is limited to locked evidence because module-readiness checks rejected the thin polished modules."
              : "Selected-level guidance is limited to locked evidence because the polish response was unusable.",
        confidence: "medium",
      },
      category_scores: scoresAvailable
        ? buildCategoryScores({
            evidence,
            scores,
            mode: input.mode,
          })
        : buildCategoryScores({
            evidence,
            scores,
            mode: input.mode,
          }).map((row) => ({
            ...row,
            score: null,
            score_basis:
              "Not scored in this evidence-only fallback because Step 1 did not return category scores.",
          })),
    },
    matrix,
    currentOverallScore: overallScore,
    currentScores: scores,
    selectedLevel: input.selectedLevel,
  });
  report.readiness_score_judgement = readiness;

  report.s10_fix_hierarchy = buildRawFixHierarchy(evidence);
  report.s10_next_action_plan = {
    retake_plan: evidence.core_improvements_evidence.map((item) => item.evidence),
    submit_checklist:
      matrix.readiness_impact === "supports_submission"
        ? ["Review the recovered report against the uploaded tape before submitting."]
        : [],
    final_checks: ["Confirm the final file still contains the verified required material."],
    playback_checks: ["Play the final file through once to confirm nothing cuts off."],
    do_not_overfix: ["Do not add changes that are not supported by the Step 1 evidence."],
    if_time_is_short_guidance:
      matrix.readiness_impact === "submission_blocker"
        ? ["Prioritise the verified brief blocker before optional polish."]
        : ["Use the recovered evidence as a final check if the deadline is close."],
    confidence: "medium",
  };
  const actionModules = applyS10FixHierarchyNextAction({
    report,
    matrix,
    readiness,
  });
  const nextActionSteps = evidenceList(
    [
      ...actionModules.nextActionPlan.retake_plan,
      ...actionModules.nextActionPlan.submit_checklist,
      ...actionModules.nextActionPlan.final_checks,
      ...actionModules.nextActionPlan.playback_checks,
    ],
    10,
  );
  (actionModules.nextActionPlan as Record<string, unknown>).steps = nextActionSteps;
  report.s10_fix_hierarchy = actionModules.hierarchy;
  report.s10_next_action_plan = actionModules.nextActionPlan;

  const rawCritique = {
    summary:
      "This section preserves only strengths and limitations grounded in locked Step 1 evidence.",
    performance_strengths: buildStrengths(evidence, componentVerifications, observedTapeSequence),
    critique_limitations: buildFallbackLimitations(evidence, recoveryKind),
    preserve: buildStrengths(evidence, componentVerifications, observedTapeSequence)
      .slice(0, 3)
      .map((item, index) => ({
        id: `polish_fallback_preserve_${index + 1}`,
        title: item.title,
        detail: item.detail,
        evidence_summary: item.evidence_summary,
        why_to_preserve:
          "This is preserved because it is directly supported by locked Step 1 evidence.",
        linked_component_verification_ids: item.linked_component_verification_ids,
        confidence: item.confidence,
      })),
    do_not_overfix: [
      {
        id: "polish_fallback_do_not_overfix_1",
        title: "Do not add unsupported changes.",
        detail:
          "Only adjust areas named by verified Step 1 evidence or the brief achievement matrix.",
        evidence_summary:
          "The fallback is intentionally limited to locked evidence after polish parsing failed.",
        why_to_preserve:
          "Avoid creating new issues by changing parts of the tape that Step 1 did not flag.",
        linked_component_verification_ids: [],
        confidence: "medium",
      },
    ],
  };
  const critique = normaliseS10ProfessionalCritique({
    critique: rawCritique,
    matrix,
    readiness,
    fixHierarchy: actionModules.hierarchy,
    nextActionPlan: actionModules.nextActionPlan,
    componentVerifications,
    mediaObservationSummary,
    report,
  });
  report.s10_professional_critique = critique;

  const technique = normaliseS10TechniqueCommentary({
    commentary: buildTechniqueCommentary(evidence, recoveryKind),
    matrix,
    readiness,
    fixHierarchy: actionModules.hierarchy,
    nextActionPlan: actionModules.nextActionPlan,
    professionalCritique: critique,
    componentVerifications,
    mediaObservationSummary,
    report,
  });
  report.s10_technique_commentary = technique;

  report.s10_timestamped_commentary = normaliseS10TimestampedCommentary({
    commentary: buildTimestampedCommentary(evidence),
    matrix,
    readiness,
    fixHierarchy: actionModules.hierarchy,
    nextActionPlan: actionModules.nextActionPlan,
    professionalCritique: critique,
    techniqueCommentary: technique,
    observedTapeSequence,
    componentVerifications,
    timestampedEvidence: evidence.timestamped_evidence,
    report,
  });

  return {
    ok: true,
    report,
    limitationCount: buildFallbackLimitations(evidence, recoveryKind).length,
  };
}

export function buildS10ModuleQualityRecoveryReport(
  input: Omit<BuildS10ReportPolishFallbackInput, "recoveryKind">,
): BuildS10ReportPolishFallbackResult {
  return buildS10ReportPolishFallback({
    ...input,
    recoveryKind: "module_quality",
  });
}

export function applyS10ResidualModuleRecovery(input: {
  report: Record<string, unknown>;
  evidence: EvidencePass;
  briefRequirements?: BriefRequirement[] | null;
  selectedLevel?: string | null;
  mode: FallbackMode;
  residualModules: string[];
}): { recoveredModules: string[] } {
  const residualModules = input.residualModules.filter((module) =>
    ["performer level calibration", "technique commentary"].includes(module),
  );
  if (residualModules.length === 0) return { recoveredModules: [] };

  const briefRequirements = input.briefRequirements ?? [];
  const componentVerifications = input.evidence.component_verifications ?? [];
  const observedTapeSequence = input.evidence.observed_tape_sequence ?? [];
  const mediaObservationSummary = input.evidence.media_observation_summary ?? null;
  const { scores, overallScore } = buildFallbackScores(input.evidence);
  const matrix = normaliseFallbackMatrix({
    mode: input.mode,
    briefRequirements,
    componentVerifications,
    observedTapeSequence,
    mediaObservationSummary,
  });
  input.report.brief_achievement_matrix = matrix;

  const existingReadiness = isRecord(input.report.readiness_score_judgement)
    ? input.report.readiness_score_judgement
    : {};
  const readiness = normaliseReadinessScoreJudgement({
    judgement: {
      ...existingReadiness,
      performance_quality_score:
        typeof existingReadiness.performance_quality_score === "number"
          ? existingReadiness.performance_quality_score
          : overallScore,
      brief_completion_score:
        typeof existingReadiness.brief_completion_score === "number"
          ? existingReadiness.brief_completion_score
          : scores.brief_adherence,
      overall_submission_readiness_score:
        typeof existingReadiness.overall_submission_readiness_score === "number"
          ? existingReadiness.overall_submission_readiness_score
          : overallScore,
      selected_level_calibration: {
        ...(isRecord(existingReadiness.selected_level_calibration)
          ? existingReadiness.selected_level_calibration
          : {}),
        selected_level: input.selectedLevel,
        what_meets_level: buildLevelMeetsEvidence(
          input.evidence,
          componentVerifications,
          observedTapeSequence,
          mediaObservationSummary,
        ),
        what_falls_short: buildLevelShortfallEvidence({
          evidence: input.evidence,
          matrix,
          mode: input.mode,
        }),
        recommendation_impact:
          input.mode === "baseline"
            ? "Read the recommendation as selected-level baseline performance/setup guidance only because no supplied brief was available for brief-fit or required-material judgement."
            : "The recommendation is calibrated only to locked Step 1 evidence and the supplied brief/context that could be verified.",
        confidence: "medium",
      },
    },
    matrix,
    currentOverallScore: overallScore,
    currentScores: scores,
    selectedLevel: input.selectedLevel,
  });
  input.report.readiness_score_judgement = readiness;

  const actionModules = applyS10FixHierarchyNextAction({
    report: input.report,
    matrix,
    readiness,
  });
  const nextActionSteps = evidenceList(
    [
      ...actionModules.nextActionPlan.retake_plan,
      ...actionModules.nextActionPlan.submit_checklist,
      ...actionModules.nextActionPlan.final_checks,
      ...actionModules.nextActionPlan.playback_checks,
    ],
    10,
  );
  (actionModules.nextActionPlan as Record<string, unknown>).steps = nextActionSteps;
  input.report.s10_fix_hierarchy = actionModules.hierarchy;
  input.report.s10_next_action_plan = actionModules.nextActionPlan;

  const critique = normaliseS10ProfessionalCritique({
    critique: input.report.s10_professional_critique,
    matrix,
    readiness,
    fixHierarchy: actionModules.hierarchy,
    nextActionPlan: actionModules.nextActionPlan,
    componentVerifications,
    mediaObservationSummary,
    report: input.report,
  });
  input.report.s10_professional_critique = critique;

  const technique = normaliseS10TechniqueCommentary({
    commentary: buildTechniqueCommentary(input.evidence, "module_quality"),
    matrix,
    readiness,
    fixHierarchy: actionModules.hierarchy,
    nextActionPlan: actionModules.nextActionPlan,
    professionalCritique: critique,
    componentVerifications,
    mediaObservationSummary,
    report: input.report,
  });
  input.report.s10_technique_commentary = technique;
  input.report.residual_module_recovery_used = true;
  input.report.residual_module_recovery_reason =
    "performer_level_calibration_and_or_technique_commentary";
  input.report.residual_modules_recovered = residualModules;

  return { recoveredModules: residualModules };
}
