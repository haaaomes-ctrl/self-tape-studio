// SERVER-ONLY. S10.4 brief achievement matrix validation.
//
// The AI authors the matrix. Code only validates, fills missing rows as
// not-assessable/final-check, and downgrades contradictions against S10.3
// observed component verification.

import type {
  BriefAchievementFixCategory,
  BriefAchievementMatrix,
  BriefAchievementMandatoryStatus,
  BriefAchievementOverallStatus,
  BriefAchievementReadinessImpact,
  BriefAchievementStatus,
  BriefAchievementSubmissionImpact,
  BriefRequirement,
  BriefRequirementCategory,
  BriefRequirementImportance,
  RequirementAchievementResult,
} from "@/lib/audition-rules";
import type {
  ComponentVerification,
  MediaObservationSummary,
  ObservedTapeCompletionStatus,
  ObservedTapePresentStatus,
  ObservedTapeSequence,
} from "./evidence-pass.server";

export type S10RequirementEvidenceClass =
  | "material_performance"
  | "technical_video_audio"
  | "admin_process";

export type S10TechnicalMediaSignals = {
  width?: number | null;
  height?: number | null;
  orientation?: string | null;
  landscape?: boolean | null;
  audioAssessable?: boolean | null;
  videoAssessable?: boolean | null;
  framingAssessable?: boolean | null;
  headAndShouldersObserved?: boolean | null;
  oneContinuousVideoObserved?: boolean | null;
  safeFileMetadataPresent?: boolean | null;
  evidenceSummaries?: string[];
};

const ACHIEVEMENT_STATUSES: BriefAchievementStatus[] = [
  "achieved",
  "mostly_achieved",
  "partly_achieved",
  "not_achieved",
  "not_assessable",
  "not_applicable",
];

const OVERALL_STATUSES: BriefAchievementOverallStatus[] = [
  "achieved",
  "mostly_achieved",
  "partly_achieved",
  "not_achieved",
  "not_assessable",
];

const MANDATORY_STATUSES: BriefAchievementMandatoryStatus[] = [
  "clear",
  "some_gaps",
  "blocked",
  "not_assessable",
];

const READINESS_IMPACTS: BriefAchievementReadinessImpact[] = [
  "supports_submission",
  "review_carefully",
  "material_gap",
  "submission_blocker",
  "not_assessable",
];

const SUBMISSION_IMPACTS: BriefAchievementSubmissionImpact[] = [
  "supports_submission",
  "material_gap",
  "submission_blocker",
  "optional_polish",
  "final_check",
  "not_assessable",
];

const FIX_CATEGORIES: BriefAchievementFixCategory[] = [
  "must_fix",
  "should_improve",
  "optional_polish",
  "preserve",
  "final_check",
  "none",
];

const REQUIREMENT_CATEGORIES: BriefRequirementCategory[] = [
  "material",
  "performance",
  "technical",
  "admin_process",
  "deadline",
  "logistics",
  "role_context",
];

const REQUIREMENT_IMPORTANCES: BriefRequirementImportance[] = [
  "mandatory",
  "preferred",
  "optional",
  "ambiguous",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, 40);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function isPositiveAchievement(value: BriefAchievementStatus): boolean {
  return value === "achieved" || value === "mostly_achieved";
}

function lowerRequirementText(requirement: BriefRequirement): string {
  return [
    requirement.summary,
    requirement.brief_text,
    requirement.expected_evidence_in_tape,
    requirement.achievement_test,
    requirement.submission_impact_if_missing,
  ]
    .map((item) => text(item).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function requirementEvidenceClass(requirement: BriefRequirement): S10RequirementEvidenceClass {
  const value = lowerRequirementText(requirement);
  const materialPerformance =
    requirement.category === "material" ||
    requirement.category === "performance" ||
    /\b(side\s*1|side one|acting scene|monologue|scene|song|singing|dance|movement|choreo|choreography|package material|material package)\b/i.test(
      value,
    ) ||
    (/\b(slate|ident|introduction)\b/i.test(value) &&
      !/\b(file|filename|upload|deadline|export|format)\b/i.test(value));
  if (materialPerformance) return "material_performance";

  const technical =
    requirement.category === "technical" ||
    /\b(landscape|portrait|orientation|framing|frame|head[-\s]?and[-\s]?shoulders|head\s*&\s*shoulders|close[-\s]?up|lighting|audio|sound|audible|video assess|visual assess|camera|shot)\b/i.test(
      value,
    );
  if (technical) return "technical_video_audio";

  return "admin_process";
}

function isMaterialRequirement(requirement: BriefRequirement): boolean {
  return requirementEvidenceClass(requirement) === "material_performance";
}

function isAdminLikeRequirement(requirement: BriefRequirement): boolean {
  return requirementEvidenceClass(requirement) === "admin_process";
}

function technicalSignalsEvidenceSummary(signals: S10TechnicalMediaSignals): string {
  return [
    ...(Array.isArray(signals.evidenceSummaries) ? signals.evidenceSummaries : []),
    signals.width && signals.height ? `${signals.width}x${signals.height} media metadata` : "",
    signals.orientation ? `orientation ${signals.orientation}` : "",
  ]
    .map((item) => text(item))
    .filter(Boolean)
    .join("; ");
}

function hasLandscapeSignal(signals: S10TechnicalMediaSignals): boolean {
  if (signals.landscape === true) return true;
  if (typeof signals.orientation === "string" && signals.orientation.toLowerCase() === "landscape") {
    return true;
  }
  return (
    typeof signals.width === "number" &&
    typeof signals.height === "number" &&
    Number.isFinite(signals.width) &&
    Number.isFinite(signals.height) &&
    signals.width > signals.height
  );
}

function hasHeadAndShouldersSignal(signals: S10TechnicalMediaSignals): boolean {
  if (signals.headAndShouldersObserved === true) return true;
  const summary = technicalSignalsEvidenceSummary(signals);
  return (
    signals.framingAssessable === true &&
    /\b(head[-\s]?and[-\s]?shoulders|head\s*&\s*shoulders|head and shoulders|shoulders|upper body|close[-\s]?up|framing|frame)\b/i.test(
      summary,
    )
  );
}

function technicalSignalForRequirement(
  requirement: BriefRequirement,
  signals: S10TechnicalMediaSignals | null | undefined,
): {
  observedStatus: ObservedTapePresentStatus;
  completionStatus: ObservedTapeCompletionStatus;
  evidenceSummary: string;
  confidence: "low" | "medium" | "high";
} | null {
  if (!signals) return null;
  const evidenceClass = requirementEvidenceClass(requirement);
  if (evidenceClass === "material_performance") return null;

  const value = lowerRequirementText(requirement);
  const summary = technicalSignalsEvidenceSummary(signals);
  const hasLandscape = hasLandscapeSignal(signals);
  const hasFraming = signals.framingAssessable === true || hasHeadAndShouldersSignal(signals);
  const hasAudio = signals.audioAssessable === true;
  const hasVideo = signals.videoAssessable === true || signals.framingAssessable === true;
  const hasContinuity = signals.oneContinuousVideoObserved === true;

  if (/\b(landscape|orientation)\b/i.test(value) && hasLandscape) {
    return {
      observedStatus: "present",
      completionStatus: "complete",
      evidenceSummary:
        summary || "Safe media metadata confirms the submitted video is landscape orientation.",
      confidence: "high",
    };
  }
  if (/\b(head[-\s]?and[-\s]?shoulders|head\s*&\s*shoulders|framing|frame|close[-\s]?up|shot)\b/i.test(value) && hasFraming) {
    return {
      observedStatus: "present",
      completionStatus: "complete",
      evidenceSummary:
        summary || "S10 media observation confirms assessable head-and-shoulders framing.",
      confidence: hasHeadAndShouldersSignal(signals) ? "high" : "medium",
    };
  }
  if (/\b(audio|sound|audible|hear|heard)\b/i.test(value) && hasAudio) {
    return {
      observedStatus: "present",
      completionStatus: "complete",
      evidenceSummary: summary || "S10 media observation confirms the audio is assessable.",
      confidence: "high",
    };
  }
  if (/\b(video assess|visual assess|visible|camera|lighting|lit)\b/i.test(value) && hasVideo) {
    return {
      observedStatus: "present",
      completionStatus: "complete",
      evidenceSummary: summary || "S10 media observation confirms the video is assessable.",
      confidence: "high",
    };
  }
  if (/\b(one continuous|continuous video|single video|one video|final video)\b/i.test(value) && hasContinuity) {
    return {
      observedStatus: "present",
      completionStatus: "complete",
      evidenceSummary:
        summary || "S10 media observation confirms this appears to be one continuous video.",
      confidence: "high",
    };
  }
  if (
    evidenceClass === "admin_process" &&
    /\b(file|filename|file name|upload|export|format)\b/i.test(value) &&
    signals.safeFileMetadataPresent === true
  ) {
    return {
      observedStatus: "uncertain",
      completionStatus: "uncertain",
      evidenceSummary:
        summary || "Safe upload metadata is available; final naming/export checks remain admin checks.",
      confidence: "medium",
    };
  }

  return null;
}

function mediaEvidenceSummaryLooksSupported(value: string): boolean {
  if (!value) return false;
  const mentionsBriefOnly =
    /\b(brief|requirement|requested|required|supplied context|operator[- ]declared|declared material|raw[_\s-]?report|detected component|material compliance|score trace|previous report|score)\b/i.test(
      value,
    );
  const mentionsMedia =
    /\b(observed|heard|visible|audible|seen|appears|tape|video|audio|media|section|sings|singing|cuts? off|ends?|starts?|framing|landscape|file|upload)\b/i.test(
      value,
    );
  return mentionsMedia && !mentionsBriefOnly;
}

function findVerification(
  requirement: BriefRequirement,
  componentVerifications: ComponentVerification[],
): ComponentVerification | null {
  return (
    componentVerifications.find((item) => item.requirement_id === requirement.id) ??
    componentVerifications.find(
      (item) =>
        item.requirement_summary.toLowerCase().includes(requirement.summary.toLowerCase()) ||
        requirement.summary.toLowerCase().includes(item.requirement_summary.toLowerCase()),
    ) ??
    null
  );
}

function linkedSequenceIds(
  requirement: BriefRequirement,
  observedTapeSequence: ObservedTapeSequence[],
): string[] {
  return observedTapeSequence
    .filter((item) => item.linked_requirement_ids.includes(requirement.id))
    .map((item) => item.id);
}

function deriveAchievementFromObservation(args: {
  requirement: BriefRequirement;
  observedStatus: ObservedTapePresentStatus;
  completionStatus: ObservedTapeCompletionStatus;
  evidenceSummary: string;
  hasVerification: boolean;
  positiveClaimFromAi: boolean;
}): {
  achievement: BriefAchievementStatus;
  submissionImpact: BriefAchievementSubmissionImpact;
  fixCategory: BriefAchievementFixCategory;
} {
  const { requirement, observedStatus, completionStatus } = args;
  const mandatory = requirement.importance === "mandatory";
  const material = isMaterialRequirement(requirement);
  const adminLike = isAdminLikeRequirement(requirement);

  if (observedStatus === "absent") {
    return {
      achievement: material || mandatory ? "not_achieved" : "not_applicable",
      submissionImpact: mandatory && material ? "submission_blocker" : "optional_polish",
      fixCategory: mandatory && material ? "must_fix" : "optional_polish",
    };
  }

  if (
    observedStatus === "partially_present" ||
    completionStatus === "incomplete" ||
    completionStatus === "cut_off" ||
    (completionStatus === "uncertain" && material && mandatory)
  ) {
    return {
      achievement: "partly_achieved",
      submissionImpact: mandatory && material ? "material_gap" : "optional_polish",
      fixCategory: mandatory && material ? "must_fix" : "should_improve",
    };
  }

  if (observedStatus === "not_assessable" || observedStatus === "uncertain") {
    if (adminLike) {
      return {
        achievement: "partly_achieved",
        submissionImpact: "final_check",
        fixCategory: "final_check",
      };
    }
    if (!mandatory) {
      return {
        achievement: "not_assessable",
        submissionImpact: "optional_polish",
        fixCategory: "optional_polish",
      };
    }
    return {
      achievement: "not_assessable",
      submissionImpact: "not_assessable",
      fixCategory: mandatory ? "must_fix" : "none",
    };
  }

  if (
    !args.hasVerification &&
    args.positiveClaimFromAi &&
    !mediaEvidenceSummaryLooksSupported(args.evidenceSummary)
  ) {
    if (adminLike) {
      return {
        achievement: "partly_achieved",
        submissionImpact: "final_check",
        fixCategory: "final_check",
      };
    }
    return {
      achievement: "not_assessable",
      submissionImpact: "not_assessable",
      fixCategory: mandatory ? "must_fix" : "none",
    };
  }

  if (
    observedStatus === "present" &&
    (completionStatus === "complete" || completionStatus === "not_applicable")
  ) {
    return {
      achievement: "achieved",
      submissionImpact: "supports_submission",
      fixCategory: "preserve",
    };
  }

  return {
    achievement: "not_assessable",
    submissionImpact: "not_assessable",
    fixCategory: mandatory ? "must_fix" : "none",
  };
}

function normaliseRequirementResult(args: {
  requirement: BriefRequirement;
  raw: unknown;
  verification: ComponentVerification | null;
  observedTapeSequence: ObservedTapeSequence[];
  technicalMediaSignals?: S10TechnicalMediaSignals | null;
}): RequirementAchievementResult {
  const { requirement, verification } = args;
  const record = isRecord(args.raw) ? args.raw : {};
  const hasVerification = verification != null;
  const technicalSupport =
    verification == null
      ? technicalSignalForRequirement(requirement, args.technicalMediaSignals)
      : null;
  const hasTechnicalSupport = technicalSupport != null;
  const rawAchievement = oneOf(record.achievement_status, ACHIEVEMENT_STATUSES, "not_assessable");
  const positiveClaimFromAi = isPositiveAchievement(rawAchievement);
  const observedStatus = verification
    ? verification.observed_status
    : technicalSupport
      ? technicalSupport.observedStatus
    : oneOf<ObservedTapePresentStatus>(
        record.observed_status,
        ["present", "partially_present", "absent", "not_assessable", "uncertain"],
        "not_assessable",
      );
  const completionStatus = verification
    ? verification.completion_status
    : technicalSupport
      ? technicalSupport.completionStatus
    : oneOf<ObservedTapeCompletionStatus>(
        record.completion_status,
        ["complete", "incomplete", "cut_off", "not_applicable", "uncertain"],
        "uncertain",
      );
  const evidenceSummary =
    verification?.evidence_summary ||
    technicalSupport?.evidenceSummary ||
    text(record.evidence_summary) ||
    `S10 could not assess this requirement from observed component verification: ${requirement.summary}`;

  const derived = deriveAchievementFromObservation({
    requirement,
    observedStatus,
    completionStatus,
    evidenceSummary,
    hasVerification: hasVerification || hasTechnicalSupport,
    positiveClaimFromAi,
  });

  let achievement = oneOf(record.achievement_status, ACHIEVEMENT_STATUSES, derived.achievement);
  let submissionImpact = oneOf(
    record.submission_impact,
    SUBMISSION_IMPACTS,
    derived.submissionImpact,
  );
  let fixCategory = oneOf(record.fix_category, FIX_CATEGORIES, derived.fixCategory);

  if (
    derived.achievement === "not_achieved" ||
    derived.achievement === "partly_achieved" ||
    derived.achievement === "not_assessable"
  ) {
    achievement = derived.achievement;
    submissionImpact = derived.submissionImpact;
    fixCategory = derived.fixCategory;
  }

  if (
    isPositiveAchievement(achievement) &&
    verification &&
    verification.observed_status !== "present"
  ) {
    achievement = derived.achievement;
    submissionImpact = derived.submissionImpact;
    fixCategory = derived.fixCategory;
  }

  if (
    isPositiveAchievement(achievement) &&
    !hasVerification &&
    !hasTechnicalSupport &&
    !mediaEvidenceSummaryLooksSupported(evidenceSummary)
  ) {
    const downgraded = deriveAchievementFromObservation({
      requirement,
      observedStatus: "not_assessable",
      completionStatus: "uncertain",
      evidenceSummary,
      hasVerification: false,
      positiveClaimFromAi: true,
    });
    achievement = downgraded.achievement;
    submissionImpact = downgraded.submissionImpact;
    fixCategory = downgraded.fixCategory;
  }

  const linkedObservedSequenceIds = [
    ...new Set([
      ...stringList(record.linked_observed_sequence_ids),
      ...linkedSequenceIds(requirement, args.observedTapeSequence),
    ]),
  ];
  const linkedComponentVerificationIds = [
    ...new Set([
      ...stringList(record.linked_component_verification_ids),
      ...(verification ? [verification.requirement_id] : []),
      ...(hasTechnicalSupport ? [requirement.id] : []),
    ]),
  ];

  return {
    requirement_id: requirement.id,
    requirement_summary: text(record.requirement_summary, requirement.summary),
    category: oneOf(record.category, REQUIREMENT_CATEGORIES, requirement.category),
    importance: oneOf(record.importance, REQUIREMENT_IMPORTANCES, requirement.importance),
    observed_status: observedStatus,
    completion_status: completionStatus,
    achievement_status: achievement,
    evidence_summary: evidenceSummary,
    submission_impact: submissionImpact,
    fix_category: fixCategory,
    recommended_action:
      text(record.recommended_action) ||
      (fixCategory === "final_check"
        ? `Check this before upload: ${requirement.summary}`
        : fixCategory === "must_fix"
          ? `Resolve this before submitting: ${requirement.summary}`
          : ""),
    confidence: oneOf(
      record.confidence,
      ["low", "medium", "high"],
      verification?.confidence ?? technicalSupport?.confidence ?? "low",
    ),
    linked_observed_sequence_ids: linkedObservedSequenceIds,
    linked_component_verification_ids: linkedComponentVerificationIds,
    cannot_infer_from_brief_only: true,
  };
}

function aggregateMatrix(args: {
  rawMatrix: Record<string, unknown>;
  results: RequirementAchievementResult[];
}): Pick<
  BriefAchievementMatrix,
  | "overall_status"
  | "mandatory_status"
  | "readiness_impact"
  | "achieved_requirements"
  | "missing_or_incomplete_requirements"
  | "not_assessable_requirements"
  | "final_check_requirements"
> {
  const mandatory = args.results.filter((item) => item.importance === "mandatory");
  const mandatoryMaterial = mandatory.filter(
    (item) => item.category === "material" || item.category === "performance",
  );
  const mandatoryMaterialBlocked = mandatoryMaterial.some(
    (item) =>
      item.achievement_status === "not_achieved" || item.submission_impact === "submission_blocker",
  );
  const mandatoryMaterialGap = mandatoryMaterial.some(
    (item) =>
      item.achievement_status === "partly_achieved" ||
      item.completion_status === "incomplete" ||
      item.completion_status === "cut_off" ||
      item.submission_impact === "material_gap",
  );
  const mandatoryFinalCheck = mandatory.some((item) => item.fix_category === "final_check");
  const mandatoryNotAssessable =
    mandatory.length > 0 && mandatory.every((item) => item.achievement_status === "not_assessable");
  const missingOrIncomplete = args.results.filter(
    (item) =>
      item.fix_category === "must_fix" ||
      item.submission_impact === "material_gap" ||
      item.submission_impact === "submission_blocker" ||
      (item.importance === "mandatory" &&
        item.fix_category !== "final_check" &&
        (item.completion_status === "incomplete" || item.completion_status === "cut_off")),
  );
  const notAssessable = args.results.filter((item) => item.achievement_status === "not_assessable");
  const finalCheck = args.results.filter((item) => item.fix_category === "final_check");
  const achieved = args.results.filter(
    (item) =>
      item.achievement_status === "achieved" || item.achievement_status === "mostly_achieved",
  );

  let mandatoryStatus = oneOf(
    args.rawMatrix.mandatory_status,
    MANDATORY_STATUSES,
    "not_assessable",
  );
  let readinessImpact = oneOf(args.rawMatrix.readiness_impact, READINESS_IMPACTS, "not_assessable");
  let overallStatus = oneOf(args.rawMatrix.overall_status, OVERALL_STATUSES, "not_assessable");

  if (mandatoryMaterialBlocked) {
    mandatoryStatus = "blocked";
    readinessImpact = "submission_blocker";
    overallStatus = "not_achieved";
  } else if (mandatoryMaterialGap) {
    mandatoryStatus = mandatoryStatus === "blocked" ? "blocked" : "some_gaps";
    readinessImpact =
      readinessImpact === "submission_blocker" ? "submission_blocker" : "material_gap";
    overallStatus = overallStatus === "not_achieved" ? "not_achieved" : "partly_achieved";
  } else if (mandatoryNotAssessable) {
    mandatoryStatus = "not_assessable";
    readinessImpact = "not_assessable";
    overallStatus = "not_assessable";
  } else if (mandatoryFinalCheck) {
    mandatoryStatus = mandatoryStatus === "blocked" ? "blocked" : "some_gaps";
    if (
      readinessImpact === "supports_submission" ||
      readinessImpact === "material_gap" ||
      readinessImpact === "submission_blocker" ||
      readinessImpact === "not_assessable"
    ) {
      readinessImpact = "review_carefully";
    }
    if (
      overallStatus === "achieved" ||
      overallStatus === "not_achieved" ||
      overallStatus === "partly_achieved" ||
      overallStatus === "not_assessable"
    ) {
      overallStatus = "mostly_achieved";
    }
  } else if (
    mandatory.length > 0 &&
    mandatory.every((item) => isPositiveAchievement(item.achievement_status))
  ) {
    mandatoryStatus = mandatoryStatus === "blocked" ? "blocked" : "clear";
    if (
      readinessImpact === "material_gap" ||
      readinessImpact === "submission_blocker" ||
      readinessImpact === "not_assessable"
    ) {
      readinessImpact = "supports_submission";
    }
    if (
      overallStatus === "not_achieved" ||
      overallStatus === "partly_achieved" ||
      overallStatus === "not_assessable"
    ) {
      overallStatus = "achieved";
    }
  }

  if ((mandatoryMaterialBlocked || mandatoryMaterialGap) && overallStatus === "achieved") {
    overallStatus = mandatoryMaterialBlocked ? "not_achieved" : "partly_achieved";
  }

  return {
    overall_status: overallStatus,
    mandatory_status: mandatoryStatus,
    readiness_impact: readinessImpact,
    achieved_requirements: achieved.map((item) => item.requirement_id),
    missing_or_incomplete_requirements: missingOrIncomplete.map((item) => item.requirement_id),
    not_assessable_requirements: notAssessable.map((item) => item.requirement_id),
    final_check_requirements: finalCheck.map((item) => item.requirement_id),
  };
}

function requirementResultText(item: RequirementAchievementResult): string {
  return `${item.requirement_summary} ${item.evidence_summary} ${item.recommended_action}`.toLowerCase();
}

function isSideOneRequirementText(value: string): boolean {
  return /\b(side\s*1|side one|acting scene|acting side|scene)\b/i.test(value);
}

function isSongRequirementText(value: string): boolean {
  return /\b(song|singing|vocal selection|mt song|musical theatre song|musical-theatre song)\b/i.test(
    value,
  );
}

function isContinuousPackageRequirementText(value: string): boolean {
  return /\b(one continuous|continuous video|single video|one video|final video|full package|complete package)\b/i.test(
    value,
  );
}

function isCompoundSideAndSongPackageRequirement(result: RequirementAchievementResult): boolean {
  const value = requirementResultText(result);
  return (
    /\b(only record|only include|record only|include only|initial self[-\s]?tape|package)\b/i.test(
      value,
    ) &&
    isSideOneRequirementText(value) &&
    isSongRequirementText(value)
  );
}

function resultIsVerifiedComplete(result: RequirementAchievementResult): boolean {
  return (
    result.observed_status === "present" &&
    (result.completion_status === "complete" || result.completion_status === "not_applicable") &&
    isPositiveAchievement(result.achievement_status) &&
    result.submission_impact !== "material_gap" &&
    result.submission_impact !== "submission_blocker"
  );
}

function verificationIsVerifiedComplete(
  verification: ComponentVerification,
  matcher: (value: string) => boolean,
): boolean {
  const value = `${verification.requirement_summary} ${verification.evidence_summary}`.toLowerCase();
  return (
    matcher(value) &&
    verification.observed_from_media === true &&
    verification.evidence_basis === "observed_audio_video" &&
    verification.observed_status === "present" &&
    (verification.completion_status === "complete" ||
      verification.completion_status === "not_applicable")
  );
}

function hasVerifiedComponent(args: {
  results: RequirementAchievementResult[];
  componentVerifications: ComponentVerification[];
  matcher: (value: string) => boolean;
}): boolean {
  return (
    args.results.some((result) => args.matcher(requirementResultText(result)) && resultIsVerifiedComplete(result)) ||
    args.componentVerifications.some((verification) =>
      verificationIsVerifiedComplete(verification, args.matcher),
    )
  );
}

function extraMaterialStatus(observedTapeSequence: ObservedTapeSequence[]): "clear" | "observed" | "uncertain" {
  const materialSections = observedTapeSequence.filter(
    (item) =>
      item.observed_from_media === true &&
      item.present_status === "present" &&
      !["acting_scene", "song", "ident", "transition", "technical"].includes(item.component_type),
  );
  if (materialSections.length > 0) return "observed";
  return observedTapeSequence.length > 0 ? "clear" : "uncertain";
}

function reconcileCompoundPackageRequirements(args: {
  results: RequirementAchievementResult[];
  componentVerifications: ComponentVerification[];
  observedTapeSequence: ObservedTapeSequence[];
  mediaObservationSummary?: MediaObservationSummary | null;
}): RequirementAchievementResult[] {
  const sideVerified = hasVerifiedComponent({
    results: args.results,
    componentVerifications: args.componentVerifications,
    matcher: isSideOneRequirementText,
  });
  const songVerified = hasVerifiedComponent({
    results: args.results,
    componentVerifications: args.componentVerifications,
    matcher: isSongRequirementText,
  });
  const continuousVerified =
    args.mediaObservationSummary?.one_continuous_video_observed === true ||
    hasVerifiedComponent({
      results: args.results,
      componentVerifications: args.componentVerifications,
      matcher: isContinuousPackageRequirementText,
    });
  const extraStatus = extraMaterialStatus(args.observedTapeSequence);

  return args.results.map((result) => {
    if (!isCompoundSideAndSongPackageRequirement(result) || !sideVerified || !songVerified) {
      return result;
    }

    if (extraStatus === "observed") return result;

    const finalCheck = extraStatus === "uncertain" || !continuousVerified;
    const evidenceBits = [
      "S10 component verification confirms Side 1 is present and complete.",
      "S10 component verification confirms the song is present and complete.",
      continuousVerified
        ? "S10 media/component evidence supports the continuous final-video package condition."
        : "The inclusion requirements are verified; the continuous/final-video condition remains a final check.",
      extraStatus === "clear"
        ? "No additional prohibited material is observed in the S10 tape sequence."
        : "No additional prohibited material was verified, so this remains a final check rather than a missing-material blocker.",
    ];

    return {
      ...result,
      observed_status: "present",
      completion_status: continuousVerified ? "complete" : "not_applicable",
      achievement_status: finalCheck ? "mostly_achieved" : "achieved",
      evidence_summary: evidenceBits.join(" "),
      submission_impact: finalCheck ? "final_check" : "supports_submission",
      fix_category: finalCheck ? "final_check" : "preserve",
      recommended_action: finalCheck
        ? "Keep the verified Side 1 and song package; complete the final upload/export check before submitting."
        : "Keep the verified Side 1 and song package.",
      confidence: continuousVerified ? "high" : "medium",
    };
  });
}

export function normaliseBriefAchievementMatrix(input: {
  matrix: unknown;
  briefRequirements?: BriefRequirement[] | null;
  componentVerifications?: ComponentVerification[] | null;
  observedTapeSequence?: ObservedTapeSequence[] | null;
  mediaObservationSummary?: MediaObservationSummary | null;
  technicalMediaSignals?: S10TechnicalMediaSignals | null;
}): BriefAchievementMatrix {
  const requirements = Array.isArray(input.briefRequirements) ? input.briefRequirements : [];
  const componentVerifications = Array.isArray(input.componentVerifications)
    ? input.componentVerifications
    : [];
  const observedTapeSequence = Array.isArray(input.observedTapeSequence)
    ? input.observedTapeSequence
    : [];
  const rawMatrix = isRecord(input.matrix) ? input.matrix : {};
  const rawResults = Array.isArray(rawMatrix.requirement_results)
    ? rawMatrix.requirement_results
    : [];
  const resultsById = new Map<string, unknown>();
  for (const item of rawResults) {
    if (!isRecord(item)) continue;
    const id = text(item.requirement_id);
    if (id) resultsById.set(id, item);
  }

  const rawRequirementResults = requirements.map((requirement) =>
    normaliseRequirementResult({
      requirement,
      raw: resultsById.get(requirement.id),
      verification: findVerification(requirement, componentVerifications),
      observedTapeSequence,
      technicalMediaSignals: input.technicalMediaSignals,
    }),
  );
  const requirementResults = reconcileCompoundPackageRequirements({
    results: rawRequirementResults,
    componentVerifications,
    observedTapeSequence,
    mediaObservationSummary: input.mediaObservationSummary,
  });

  const aggregate = aggregateMatrix({ rawMatrix, results: requirementResults });
  const summary =
    text(rawMatrix.summary) ||
    (aggregate.readiness_impact === "submission_blocker"
      ? "Mandatory brief material is missing or incomplete, so the package is not yet complete."
      : aggregate.readiness_impact === "material_gap"
        ? "Some mandatory brief requirements are incomplete and need attention before submission."
        : aggregate.readiness_impact === "not_assessable"
          ? "Brief achievement could not be fully assessed from the available observations."
          : "Brief achievement is supported by the observed tape requirements.");

  return {
    overall_status: aggregate.overall_status,
    mandatory_status: aggregate.mandatory_status,
    readiness_impact: aggregate.readiness_impact,
    summary,
    achieved_requirements: aggregate.achieved_requirements,
    missing_or_incomplete_requirements: aggregate.missing_or_incomplete_requirements,
    not_assessable_requirements: aggregate.not_assessable_requirements,
    final_check_requirements: aggregate.final_check_requirements,
    requirement_results: requirementResults,
  };
}

export function matrixHasMandatoryMaterialGap(matrix: BriefAchievementMatrix | null | undefined) {
  if (!matrix) return false;
  return matrix.requirement_results.some(
    (item) =>
      item.importance === "mandatory" &&
      (item.category === "material" || item.category === "performance") &&
      (item.achievement_status === "not_achieved" ||
        item.achievement_status === "partly_achieved" ||
        item.submission_impact === "submission_blocker" ||
        item.submission_impact === "material_gap"),
  );
}

function clampScore(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : max;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function applyBriefAchievementCompatibilityCaps(
  report: Record<string, unknown>,
  matrix: BriefAchievementMatrix | null | undefined,
): { capped: boolean; cap: number | null } {
  if (!matrixHasMandatoryMaterialGap(matrix)) return { capped: false, cap: null };
  const cap = matrix?.readiness_impact === "submission_blocker" ? 55 : 65;
  let capped = false;

  if (!isRecord(report.scores)) report.scores = {};
  const scores = report.scores as Record<string, unknown>;
  const nextBrief = clampScore(scores.brief_adherence, cap);
  if (scores.brief_adherence !== nextBrief) {
    scores.brief_adherence = nextBrief;
    capped = true;
  }

  if (!isRecord(report.brief_adherence_breakdown)) report.brief_adherence_breakdown = {};
  const breakdown = report.brief_adherence_breakdown as Record<string, unknown>;
  const nextMaterial = clampScore(breakdown.material_compliance, cap);
  if (breakdown.material_compliance !== nextMaterial) {
    breakdown.material_compliance = nextMaterial;
    capped = true;
  }
  const note = text(breakdown.note);
  const s10Note =
    "S10 brief achievement matrix caps material compliance because mandatory material is missing or incomplete.";
  if (!note.includes("S10 brief achievement matrix")) {
    breakdown.note = note ? `${note} ${s10Note}` : s10Note;
    capped = true;
  }

  return { capped, cap };
}
