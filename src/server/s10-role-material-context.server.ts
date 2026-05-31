// SERVER-ONLY. S10 role/material bridge.
//
// This is not the full S14 resolver/source-library product. It normalises the
// role/material context S10 can safely carry through prompts, report models and
// route rendering: source basis, truth state, uncertainty and demand boundaries.

import type { BriefContext, BriefRequirement } from "@/lib/audition-rules";

export const S10_ROLE_MATERIAL_TRUTH_STATES = [
  "brief_supplied",
  "uploaded_material_extracted",
  "user_supplied",
  "official_source_researched",
  "known_material_profile",
  "model_inferred_low_confidence",
  "observed_in_tape",
  "not_available",
  "contradicted_or_unreliable",
] as const;

export type S10RoleMaterialTruthState = (typeof S10_ROLE_MATERIAL_TRUTH_STATES)[number];

export type S10RoleMaterialConfidence = "low" | "medium" | "high";

export type S10RoleMaterialPrimaryStandard =
  | "supplied_brief"
  | "uploaded_material"
  | "user_supplied_context"
  | "selected_level_observed_tape"
  | "observed_tape_only";

export type S10RoleMaterialDemandImportance =
  | "mandatory_from_brief"
  | "preferred_from_brief"
  | "optional_from_brief"
  | "known_material_context_only"
  | "ambiguous";

export type S10RoleMaterialScoringUse =
  | "can_drive_brief_achievement"
  | "can_nuance_score"
  | "report_context_only"
  | "not_for_scoring";

export type S10RoleMaterialSourceSummary = {
  source_type:
    | "brief"
    | "uploaded_material"
    | "user_supplied"
    | "official_source"
    | "reputable_reference"
    | "internal_known_material_profile"
    | "model_inferred_low_confidence"
    | "not_available";
  source_label: string;
  truth_state: S10RoleMaterialTruthState;
  confidence: S10RoleMaterialConfidence;
  public_usable: boolean;
};

export type S10RoleMaterialDemand = {
  id: string;
  label: string;
  description: string;
  source_truth_state: S10RoleMaterialTruthState;
  importance: S10RoleMaterialDemandImportance;
  observable_evidence_needed: string[];
  scoring_use: S10RoleMaterialScoringUse;
  unsafe_if_used_for: string[];
};

export type S10RoleMaterialContext = {
  applies: boolean;
  project_name: string | null;
  role_name: string | null;
  discipline: string | null;
  audition_type: string | null;
  material_package_summary: string | null;
  role_description_summary: string | null;
  source_basis: S10RoleMaterialTruthState[];
  primary_standard: S10RoleMaterialPrimaryStandard;
  source_summary: S10RoleMaterialSourceSummary[];
  secondary_context: string | null;
  demands: S10RoleMaterialDemand[];
  blocked_inferences: string[];
  confidence: S10RoleMaterialConfidence;
  uncertainty_notes: string[];
  s14_deferred_maturity: string[];
};

const DEFAULT_BLOCKED_INFERENCES = [
  "Personal attributes and casting outcomes are not assessed.",
  "Known-material context cannot create mandatory requirements unless the supplied brief or uploaded material supports them.",
  "Casting, booking or employment outcomes are never predicted.",
];

const DEFAULT_S14_DEFERRED_MATURITY = [
  "Official-source resolver maturity",
  "Curated source library and licensed-source policy",
  "Source-confidence UI and user confirmation workflows",
];

const UNSAFE_ROLE_MATERIAL_PATTERNS = [
  /\b(?:castable|castability|marketable|marketability|bookable|booking likelihood)\b/i,
  /\b(?:right|wrong)\s+for\s+(?:the\s+)?role\b/i,
  /\b(?:look|looks|appearance|body|type|age|race|class)\b/i,
  /\b(?:callback|recall|job|employment)\s+(?:guarantee|likelihood|chance|outcome)\b/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (value == null) return value;
  return structuredClone(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function unique<T>(items: T[]): T[] {
  return items.filter((item, index, array) => array.indexOf(item) === index);
}

function truthState(value: unknown): S10RoleMaterialTruthState | null {
  return S10_ROLE_MATERIAL_TRUTH_STATES.includes(value as S10RoleMaterialTruthState)
    ? (value as S10RoleMaterialTruthState)
    : null;
}

function confidence(
  value: unknown,
  fallback: S10RoleMaterialConfidence,
): S10RoleMaterialConfidence {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function demandImportance(value: unknown): S10RoleMaterialDemandImportance {
  switch (value) {
    case "mandatory_from_brief":
    case "preferred_from_brief":
    case "optional_from_brief":
    case "known_material_context_only":
    case "ambiguous":
      return value;
    default:
      return "ambiguous";
  }
}

function scoringUse(value: unknown): S10RoleMaterialScoringUse {
  switch (value) {
    case "can_drive_brief_achievement":
    case "can_nuance_score":
    case "report_context_only":
    case "not_for_scoring":
      return value;
    default:
      return "report_context_only";
  }
}

function sourceType(value: unknown): S10RoleMaterialSourceSummary["source_type"] {
  switch (value) {
    case "brief":
    case "uploaded_material":
    case "user_supplied":
    case "official_source":
    case "reputable_reference":
    case "internal_known_material_profile":
    case "model_inferred_low_confidence":
    case "not_available":
      return value;
    default:
      return "not_available";
  }
}

function primaryStandard(
  value: unknown,
  basis: S10RoleMaterialTruthState[],
): S10RoleMaterialPrimaryStandard {
  if (
    value === "supplied_brief" ||
    value === "uploaded_material" ||
    value === "user_supplied_context"
  )
    return value;
  if (value === "selected_level_observed_tape" || value === "observed_tape_only") return value;
  if (basis.includes("brief_supplied")) return "supplied_brief";
  if (basis.includes("uploaded_material_extracted")) return "uploaded_material";
  if (basis.includes("user_supplied")) return "user_supplied_context";
  return "selected_level_observed_tape";
}

function briefHasRoleMaterialSignal(briefContext: BriefContext | null): boolean {
  if (!briefContext) return false;
  return [
    briefContext.project_name,
    briefContext.role_name,
    briefContext.discipline,
    briefContext.audition_type,
    briefContext.material_package_summary,
    briefContext.role_description_summary,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}

function sourceSummaryFromRaw(value: unknown): S10RoleMaterialSourceSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): S10RoleMaterialSourceSummary | null => {
      if (!isRecord(item)) return null;
      const state = truthState(item.truth_state ?? item.truthState);
      const label =
        text(item.source_label) ??
        text(item.sourceLabel) ??
        text(item.source) ??
        text(item.label) ??
        null;
      if (!state || !label) return null;
      return {
        source_type: sourceType(item.source_type ?? item.sourceType),
        source_label: label,
        truth_state: state,
        confidence: confidence(item.confidence, index === 0 ? "high" : "medium"),
        public_usable: bool(item.public_usable ?? item.publicUsable) ?? true,
      };
    })
    .filter((item): item is S10RoleMaterialSourceSummary => item !== null);
}

function demandFromRaw(value: unknown, index: number): S10RoleMaterialDemand | null {
  if (!isRecord(value)) return null;
  const label = text(value.label) ?? text(value.title) ?? text(value.summary);
  const description = text(value.description) ?? text(value.detail) ?? label;
  if (!label || !description) return null;
  const state = truthState(value.source_truth_state ?? value.sourceTruthState) ?? "not_available";
  return {
    id: text(value.id) ?? `role-material-demand-${index + 1}`,
    label,
    description,
    source_truth_state: state,
    importance: demandImportance(value.importance),
    observable_evidence_needed: stringArray(
      value.observable_evidence_needed ?? value.observableEvidenceNeeded,
    ),
    scoring_use: scoringUse(value.scoring_use ?? value.scoringUse),
    unsafe_if_used_for: stringArray(value.unsafe_if_used_for ?? value.unsafeIfUsedFor),
  };
}

function demandsFromRaw(raw: Record<string, unknown> | null): S10RoleMaterialDemand[] {
  if (!raw) return [];
  const rawDemands = [
    ...((Array.isArray(raw.demands) ? raw.demands : []) as unknown[]),
    ...((Array.isArray(raw.brief_primary_demands) ? raw.brief_primary_demands : []) as unknown[]),
    ...((Array.isArray(raw.secondary_known_material_demands)
      ? raw.secondary_known_material_demands
      : []) as unknown[]),
  ];
  return rawDemands
    .map(demandFromRaw)
    .filter((item): item is S10RoleMaterialDemand => item !== null);
}

function roleContextDemandsFromBrief(
  requirements: BriefRequirement[] | null | undefined,
): S10RoleMaterialDemand[] {
  return (requirements ?? [])
    .filter((req) => req.category === "role_context")
    .map(
      (req, index): S10RoleMaterialDemand => ({
        id: req.id || `brief-role-context-${index + 1}`,
        label: req.summary || "Role context",
        description: req.brief_text || req.summary || "Role/material context from supplied brief.",
        source_truth_state: "brief_supplied",
        importance: "ambiguous",
        observable_evidence_needed: req.expected_evidence_in_tape
          ? [req.expected_evidence_in_tape]
          : [],
        scoring_use: "report_context_only",
        unsafe_if_used_for: [
          "hidden mandatory requirement",
          "appearance/type/castability judgement",
        ],
      }),
    );
}

function hasUnsafeRoleMaterialText(value: unknown, key: string | null = null): boolean {
  if (
    key === "unsafe_if_used_for" ||
    key === "blocked_inferences" ||
    key === "s14_deferred_maturity"
  ) {
    return false;
  }
  if (typeof value === "string") {
    return UNSAFE_ROLE_MATERIAL_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some((item) => hasUnsafeRoleMaterialText(item, key));
  if (isRecord(value)) {
    return Object.entries(value).some(([childKey, child]) =>
      hasUnsafeRoleMaterialText(child, childKey),
    );
  }
  return false;
}

export function buildS10RoleMaterialContext(args: {
  report: Record<string, unknown>;
  briefContext: BriefContext | null;
  briefRequirements?: BriefRequirement[] | null;
  override?: S10RoleMaterialContext | Record<string, unknown> | null;
}): S10RoleMaterialContext {
  const raw: Record<string, unknown> | null = isRecord(args.override)
    ? args.override
    : isRecord(args.report.role_material_context)
      ? args.report.role_material_context
      : null;
  const hasBriefContext = briefHasRoleMaterialSignal(args.briefContext);
  const projectName = text(raw?.project_name) ?? args.briefContext?.project_name ?? null;
  const roleName = text(raw?.role_name) ?? args.briefContext?.role_name ?? null;
  const discipline = text(raw?.discipline) ?? args.briefContext?.discipline ?? null;
  const auditionType = text(raw?.audition_type) ?? args.briefContext?.audition_type ?? null;
  const materialPackageSummary =
    text(raw?.material_package_summary) ?? args.briefContext?.material_package_summary ?? null;
  const roleDescriptionSummary =
    text(raw?.role_description_summary) ?? args.briefContext?.role_description_summary ?? null;
  const explicitBasis = stringArray(raw?.source_basis)
    .map(truthState)
    .filter((item): item is S10RoleMaterialTruthState => item !== null);
  const suppliedBasis = hasBriefContext ? ["brief_supplied" as const] : [];
  const sourceBasis = unique([...explicitBasis, ...suppliedBasis]);
  const applies = bool(raw?.applies) ?? sourceBasis.some((basis) => basis !== "not_available");
  const finalBasis = sourceBasis.length > 0 ? sourceBasis : ["not_available" as const];
  const rawSourceSummary = sourceSummaryFromRaw(raw?.source_summary ?? raw?.sourceSummary);
  const sourceSummary =
    rawSourceSummary.length > 0
      ? rawSourceSummary
      : applies
        ? [
            {
              source_type: "brief" as const,
              source_label: "Supplied brief/context",
              truth_state: "brief_supplied" as const,
              confidence: hasBriefContext ? ("high" as const) : ("medium" as const),
              public_usable: true,
            },
          ]
        : [];
  const rawDemands = demandsFromRaw(raw);
  const briefDemands = roleContextDemandsFromBrief(args.briefRequirements);
  const demands = rawDemands.length > 0 ? rawDemands : briefDemands;
  const uncertaintyNotes = unique([
    ...stringArray(raw?.uncertainty_notes ?? raw?.uncertaintyNotes),
    ...(applies
      ? []
      : [
          "No supplied or confidently resolved role/material context was available, so role-specific fit was not assessed.",
        ]),
  ]);

  return {
    applies,
    project_name: projectName,
    role_name: roleName,
    discipline,
    audition_type: auditionType,
    material_package_summary: materialPackageSummary,
    role_description_summary: roleDescriptionSummary,
    source_basis: finalBasis,
    primary_standard: primaryStandard(raw?.primary_standard ?? raw?.primaryStandard, finalBasis),
    source_summary: sourceSummary,
    secondary_context: text(raw?.secondary_context ?? raw?.secondaryContext),
    demands,
    blocked_inferences: unique([
      ...stringArray(raw?.blocked_inferences ?? raw?.blockedInferences),
      ...DEFAULT_BLOCKED_INFERENCES,
    ]),
    confidence: confidence(raw?.confidence, applies ? "medium" : "low"),
    uncertainty_notes: uncertaintyNotes,
    s14_deferred_maturity: unique([
      ...stringArray(raw?.s14_deferred_maturity ?? raw?.s14DeferredMaturity),
      ...DEFAULT_S14_DEFERRED_MATURITY,
    ]),
  };
}

export function validateS10RoleMaterialContext(
  context: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!isRecord(context)) return { ok: false, reason: "role_material_context_not_object" };
  const sourceBasis = Array.isArray(context.source_basis) ? context.source_basis : [];
  if (sourceBasis.length === 0) return { ok: false, reason: "missing_source_basis" };
  if (sourceBasis.some((item) => !truthState(item))) {
    return { ok: false, reason: "invalid_source_basis_truth_state" };
  }
  if (hasUnsafeRoleMaterialText(context)) {
    return { ok: false, reason: "unsafe_role_material_claim" };
  }
  const demands = Array.isArray(context.demands) ? context.demands : [];
  for (const demand of demands) {
    if (!isRecord(demand)) continue;
    const state = truthState(demand.source_truth_state);
    if (
      demand.importance === "mandatory_from_brief" &&
      state !== "brief_supplied" &&
      state !== "uploaded_material_extracted"
    ) {
      return { ok: false, reason: "known_material_mandatory_blocker" };
    }
    if (
      demand.scoring_use === "can_drive_brief_achievement" &&
      state !== "brief_supplied" &&
      state !== "uploaded_material_extracted"
    ) {
      return { ok: false, reason: "known_material_drives_brief_achievement" };
    }
  }
  return { ok: true };
}

export function cloneS10RoleMaterialContext(
  context: S10RoleMaterialContext,
): S10RoleMaterialContext {
  return clone(context);
}
