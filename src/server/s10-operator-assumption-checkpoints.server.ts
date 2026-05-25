import type {
  S10ComparisonTruth,
  S10OperatorAssumptionCheckpoint,
  S10OperatorAssumptionComparison,
  S10OperatorAssumptionMismatch,
  S10OperatorAssumptionMismatchType,
  S10OperatorAssumptionNextStep,
  S10OperatorExpectation,
} from "@/lib/audition-rules";

export type S10OperatorAssumptionComparisonInput = {
  checkpoint?: S10OperatorAssumptionCheckpoint | null;
  expectation?: S10OperatorExpectation | null;
  reportModules?: Record<string, unknown> | null;
  viewModel?: Record<string, unknown> | null;
  comparisonTruth?: S10ComparisonTruth | null;
  renderedText?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalise(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function addMismatch(
  mismatches: S10OperatorAssumptionMismatch[],
  mismatch_type: S10OperatorAssumptionMismatchType,
  field: string,
  expected: string | number | boolean | null,
  actual: string | number | boolean | null,
  message: string,
) {
  mismatches.push({ mismatch_type, field, expected, actual, message });
}

function getReadiness(
  report: Record<string, unknown> | null,
  view: Record<string, unknown> | null,
) {
  return asRecord(report?.readiness_score_judgement) ?? asRecord(view?.recommendation) ?? null;
}

function getMatrix(report: Record<string, unknown> | null, view: Record<string, unknown> | null) {
  return (
    asRecord(report?.brief_achievement_matrix) ?? asRecord(view?.brief_achievement_matrix) ?? null
  );
}

function getFixHierarchy(
  report: Record<string, unknown> | null,
  view: Record<string, unknown> | null,
) {
  return asRecord(report?.s10_fix_hierarchy) ?? asRecord(view?.fix_hierarchy) ?? null;
}

function getTechnique(
  report: Record<string, unknown> | null,
  view: Record<string, unknown> | null,
) {
  return asRecord(report?.s10_technique_commentary) ?? asRecord(view?.technique_commentary) ?? null;
}

function getTimestamped(
  report: Record<string, unknown> | null,
  view: Record<string, unknown> | null,
) {
  return (
    asRecord(report?.s10_timestamped_commentary) ?? asRecord(view?.timestamped_commentary) ?? null
  );
}

function getRequirementRows(
  report: Record<string, unknown> | null,
  view: Record<string, unknown> | null,
) {
  const matrix = getMatrix(report, view);
  return [
    ...asArray(report?.component_verifications),
    ...asArray(matrix?.requirement_results),
    ...asArray(asRecord(view?.observed_tape)?.component_verifications),
  ].filter(isRecord);
}

function rowMatchesRequirement(row: Record<string, unknown>, expected: string): boolean {
  const needle = normalise(expected);
  return [row.requirement_id, row.requirement_summary, row.summary, row.requirement_text]
    .map(normalise)
    .filter(Boolean)
    .some((value) => value.includes(needle) || needle.includes(value));
}

function requirementStatus(
  rows: Record<string, unknown>[],
  expected: string,
): Record<string, unknown> | null {
  return rows.find((row) => rowMatchesRequirement(row, expected)) ?? null;
}

function phraseMatches(text: string, phrase: string): boolean {
  const alternatives = phrase
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return alternatives.some((part) => text.includes(part));
}

function actualText(input: S10OperatorAssumptionComparisonInput): string {
  return [input.renderedText ?? "", input.viewModel ? JSON.stringify(input.viewModel) : ""].join(
    "\n",
  );
}

function expectedSourceSections(expectation: S10OperatorExpectation): string[] {
  const sections = new Set<string>();
  if (expectation.expected_recommendation) {
    sections.add("readiness_header");
    sections.add("submission_guidance");
  }
  if (expectation.expected_score_band) sections.add("score_summary");
  if (expectation.expected_brief_achievement_status) sections.add("brief_achievement");
  if (
    expectation.expected_missing_requirements.length > 0 ||
    expectation.expected_present_requirements.length > 0
  ) {
    sections.add("component_breakdown");
    sections.add("observed_tape");
  }
  if (expectation.expected_fix_first !== null) sections.add("fix_hierarchy");
  if (expectation.expected_not_assessable_areas.length > 0) sections.add("technique_commentary");
  if (expectation.expected_same_video_status || expectation.expected_comparison_policy) {
    sections.add("same_video_status");
    sections.add("comparison_truth");
  }
  return [...sections];
}

function nextStepFor(
  mismatch: S10OperatorAssumptionMismatch | null,
): S10OperatorAssumptionNextStep {
  switch (mismatch?.mismatch_type) {
    case "component_observation_mismatch":
    case "professional_critique_mismatch":
    case "technique_commentary_mismatch":
    case "timestamped_commentary_mismatch":
      return "review_ai_observation";
    case "brief_extraction_mismatch":
    case "brief_achievement_mismatch":
    case "readiness_score_mismatch":
    case "fix_hierarchy_mismatch":
    case "same_video_classification_mismatch":
      return "review_prompt_contract";
    case "route_projection_mismatch":
      return "review_route_projection";
    case "operator_assumption_missing":
    case "operator_assumption_uncertain":
      return "ask_operator";
    case "fixture_expectation_mismatch":
      return "accept_fixture";
    default:
      return "accept_fixture";
  }
}

export function compareS10OperatorAssumptions(
  input: S10OperatorAssumptionComparisonInput,
): S10OperatorAssumptionComparison {
  const checkpoint = input.checkpoint ?? null;
  const expectation = input.expectation ?? null;
  const fixtureId = checkpoint?.fixture_id ?? null;

  if (!checkpoint || !expectation) {
    return {
      checkpoint_id: checkpoint?.checkpoint_id ?? null,
      report_id_or_fixture_id: fixtureId,
      comparison_status: "assumption_missing",
      mismatches: [
        {
          mismatch_type: "operator_assumption_missing",
          field: "checkpoint",
          expected: "operator assumption checkpoint",
          actual: checkpoint ? "expectation_missing" : "checkpoint_missing",
          message: "Operator assumption checkpoint or expectation is missing.",
        },
      ],
      matched_expectations: [],
      unresolved_assumptions: ["operator assumption missing"],
      recommended_next_step: "ask_operator",
    };
  }

  if (checkpoint.confidence === "uncertain") {
    return {
      checkpoint_id: checkpoint.checkpoint_id,
      report_id_or_fixture_id: fixtureId,
      comparison_status: "assumption_uncertain",
      mismatches: [
        {
          mismatch_type: "operator_assumption_uncertain",
          field: "checkpoint.confidence",
          expected: "confirmed or likely",
          actual: checkpoint.confidence,
          message: "Operator assumption is uncertain and cannot produce a pass.",
        },
      ],
      matched_expectations: [],
      unresolved_assumptions: ["operator assumption uncertain"],
      recommended_next_step: "ask_operator",
    };
  }

  const report = input.reportModules ?? null;
  const view = input.viewModel ?? null;
  const readiness = getReadiness(report, view);
  const matrix = getMatrix(report, view);
  const fixHierarchy = getFixHierarchy(report, view);
  const technique = getTechnique(report, view);
  const timestamped = getTimestamped(report, view);
  const comparisonTruth =
    input.comparisonTruth ??
    (asRecord(view?.comparison_truth) as S10ComparisonTruth | null) ??
    null;
  const rows = getRequirementRows(report, view);
  const text = actualText(input);
  const sourceMap = asRecord(view?.section_source_map);
  const mismatches: S10OperatorAssumptionMismatch[] = [];
  const matched: string[] = [];
  const unresolved: string[] = [];

  if (expectation.expected_recommendation) {
    const actual = asText(readiness?.decision);
    if (actual === expectation.expected_recommendation) {
      matched.push("expected recommendation");
    } else {
      addMismatch(
        mismatches,
        "readiness_score_mismatch",
        "readiness.decision",
        expectation.expected_recommendation,
        actual,
        "Readiness decision does not match operator expectation.",
      );
    }
  }

  if (expectation.expected_score_band) {
    const actual = asText(readiness?.score_band_label);
    if (actual === expectation.expected_score_band) {
      matched.push("expected score band");
    } else {
      addMismatch(
        mismatches,
        "readiness_score_mismatch",
        "readiness.score_band_label",
        expectation.expected_score_band,
        actual,
        "Score band does not match operator expectation.",
      );
    }
  }

  if (expectation.expected_brief_achievement_status) {
    const actual = asText(matrix?.overall_status);
    if (actual === expectation.expected_brief_achievement_status) {
      matched.push("expected brief achievement status");
    } else {
      addMismatch(
        mismatches,
        "brief_achievement_mismatch",
        "brief_achievement_matrix.overall_status",
        expectation.expected_brief_achievement_status,
        actual,
        "Brief achievement status does not match operator expectation.",
      );
    }
  }

  for (const expected of expectation.expected_missing_requirements) {
    const row = requirementStatus(rows, expected);
    const status = [
      row?.observed_status,
      row?.achievement_status,
      row?.completion_status,
      row?.status,
    ]
      .map(asText)
      .filter(Boolean)
      .join(" ");
    if (
      /absent|not_achieved|incomplete|partly_present|partially_present|partly_achieved|cut_off|uncertain/.test(
        status,
      )
    ) {
      matched.push(`missing requirement:${expected}`);
    } else {
      addMismatch(
        mismatches,
        "component_observation_mismatch",
        `missing_requirement:${expected}`,
        "absent/not_achieved/incomplete",
        status.trim() || null,
        "Expected missing requirement was not represented as missing or incomplete.",
      );
    }
  }

  for (const expected of expectation.expected_present_requirements) {
    const row = requirementStatus(rows, expected);
    const status = [
      row?.observed_status,
      row?.achievement_status,
      row?.completion_status,
      row?.status,
    ]
      .map(asText)
      .filter(Boolean)
      .join(" ");
    if (/present|achieved|mostly_achieved/.test(status) && !/absent|not_achieved/.test(status)) {
      matched.push(`present requirement:${expected}`);
    } else {
      addMismatch(
        mismatches,
        "component_observation_mismatch",
        `present_requirement:${expected}`,
        "present/achieved",
        status.trim() || null,
        "Expected present requirement was not represented as present or achieved.",
      );
    }
  }

  for (const area of expectation.expected_not_assessable_areas) {
    const areaRecord = asRecord(technique?.[area]);
    const status = asText(areaRecord?.status);
    if (status === "not_assessable" || status === "partially_assessable") {
      matched.push(`not assessable area:${area}`);
    } else {
      addMismatch(
        mismatches,
        "technique_commentary_mismatch",
        `technique.${area}.status`,
        "not_assessable/partially_assessable",
        status,
        "Expected technique limitation is not represented.",
      );
    }
  }

  if (expectation.expected_fix_first !== null) {
    const fixFirst = asRecord(fixHierarchy?.fix_first);
    const actual = [fixFirst?.title, fixFirst?.exact_action].map(asText).filter(Boolean).join(" ");
    if (
      /^(none|null|no mandatory fix)/i.test(expectation.expected_fix_first) &&
      (!fixFirst || /no mandatory fix/i.test(actual))
    ) {
      matched.push("expected no mandatory fix first");
    } else if (phraseMatches(normalise(actual), normalise(expectation.expected_fix_first))) {
      matched.push("expected fix first");
    } else {
      addMismatch(
        mismatches,
        "fix_hierarchy_mismatch",
        "s10_fix_hierarchy.fix_first",
        expectation.expected_fix_first,
        actual || null,
        "Fix-first item does not match operator expectation.",
      );
    }
  }

  if (expectation.expected_same_video_status) {
    const actual = comparisonTruth?.same_video_status?.status ?? null;
    if (actual === expectation.expected_same_video_status) {
      matched.push("expected same-video status");
    } else {
      addMismatch(
        mismatches,
        "same_video_classification_mismatch",
        "comparison_truth.same_video_status.status",
        expectation.expected_same_video_status,
        actual,
        "Same-video status does not match operator expectation.",
      );
    }
  }

  if (expectation.expected_comparison_policy) {
    const actual = comparisonTruth?.recommendation_policy ?? null;
    if (actual === expectation.expected_comparison_policy) {
      matched.push("expected comparison policy");
    } else {
      addMismatch(
        mismatches,
        "same_video_classification_mismatch",
        "comparison_truth.recommendation_policy",
        expectation.expected_comparison_policy,
        actual,
        "Comparison policy does not match operator expectation.",
      );
    }
  }

  for (const phrase of expectation.expected_forbidden_phrases) {
    if (text.includes(phrase)) {
      addMismatch(
        mismatches,
        "route_projection_mismatch",
        `forbidden_phrase:${phrase}`,
        "absent",
        "present",
        "Forbidden legacy/generic phrase is visible in report-facing output.",
      );
    } else {
      matched.push(`forbidden phrase absent:${phrase}`);
    }
  }

  const searchableText = normalise(text);
  for (const phrase of expectation.expected_required_phrases) {
    if (phraseMatches(searchableText, normalise(phrase))) {
      matched.push(`required phrase present:${phrase}`);
    } else {
      addMismatch(
        mismatches,
        "route_projection_mismatch",
        `required_phrase:${phrase}`,
        "present",
        "absent",
        "Required fixture-facing wording or equivalent is missing.",
      );
    }
  }

  if (sourceMap) {
    for (const section of expectedSourceSections(expectation)) {
      const entry = asRecord(sourceMap[section]);
      const source = asText(entry?.source);
      const module = asText(entry?.module);
      if (source === "s10_authoritative_module" && !/raw_report/i.test(module ?? "")) {
        matched.push(`source map:${section}`);
      } else {
        addMismatch(
          mismatches,
          "route_projection_mismatch",
          `section_source_map.${section}`,
          "s10_authoritative_module",
          source,
          "S10-covered section is not sourced from an authoritative S10 module.",
        );
      }
    }
  } else {
    unresolved.push("section source map unavailable");
  }

  if (expectation.expected_not_assessable_areas.length > 0 && !technique) {
    unresolved.push("technique commentary unavailable");
  }
  if (expectation.expected_missing_requirements.length > 0 && rows.length === 0) {
    unresolved.push("component verification unavailable");
  }
  if (checkpoint.expected_secondary_notes.length > 0 && !timestamped) {
    unresolved.push("timestamped/professional notes unavailable for secondary expectation review");
  }

  const firstMismatch = mismatches[0] ?? null;
  return {
    checkpoint_id: checkpoint.checkpoint_id,
    report_id_or_fixture_id: checkpoint.fixture_id,
    comparison_status:
      mismatches.length === 0
        ? "matches_operator_expectation"
        : checkpoint.confidence === "confirmed"
          ? "contradicts_operator_expectation"
          : "partially_matches_operator_expectation",
    mismatches,
    matched_expectations: matched,
    unresolved_assumptions: unresolved,
    recommended_next_step: nextStepFor(firstMismatch),
  };
}
