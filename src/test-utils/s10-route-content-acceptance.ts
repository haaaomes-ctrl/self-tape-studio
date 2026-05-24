import type { S10OperatorAssumptionComparison } from "@/lib/audition-rules";
import type { S10PerformerReportViewModel } from "@/server/s10-report-view-model.server";

export type S10RouteContentProfile =
  | "canary_a_incomplete_package"
  | "strong_complete_professional"
  | "same_video_notice"
  | "missing_module";

export type S10RouteContentFailureCategory =
  | "required_content"
  | "forbidden_content"
  | "density"
  | "source_map"
  | "score_verdict"
  | "fix_first"
  | "comparison_truth"
  | "operator_comparison"
  | "internal_leak";

export type S10RouteContentFailure = {
  category: S10RouteContentFailureCategory;
  fixture_id: string;
  message: string;
  expected?: string | string[];
  actual?: string | null;
  section?: string;
  expected_source?: string;
  actual_source?: string | null;
  expected_module?: string;
  actual_module?: string | null;
};

export type S10SourceExpectation = {
  section: string;
  expected_source?: string;
  expected_module?: string | RegExp;
  allow_specific_limitation?: boolean;
};

export type S10RouteContentAcceptanceInput = {
  fixture_id: string;
  profile: S10RouteContentProfile;
  view_model: S10PerformerReportViewModel | Record<string, unknown> | null | undefined;
  v2_report?: Record<string, unknown> | null;
  rendered_route_html: string;
  print_pdf_text?: string | null;
  operator_comparison?: S10OperatorAssumptionComparison | null;
  forbiddenExact?: readonly string[];
  requiredAnyOf?: readonly (readonly string[])[];
  requiredAllOf?: readonly string[];
  densitySections?: readonly (readonly string[])[];
  sourceExpectations?: readonly S10SourceExpectation[];
  expectedDecision?: string | readonly string[];
  expectedComparisonPolicy?: string | readonly string[];
  expectedFixFirstIncludes?: string | null;
  internalLeakTerms?: readonly string[];
};

export type S10RouteContentAcceptanceResult = {
  ok: boolean;
  failures: S10RouteContentFailure[];
  matched: string[];
};

const DEFAULT_INTERNAL_LEAK_TERMS = [
  "raw_report",
  "raw_prompt",
  "raw_response",
  "raw_model_response",
  "GateTrace",
  "ValidatorTrace",
  "RuntimeVerificationTrace",
  "qa-artifacts/",
  "qa_artifacts",
  "value_hash",
  "original_upload_file_hash",
  "mux_playback_id",
  "mux_asset_id",
  "checkpoint_id",
  "operator_notes",
  "analysis_run_id",
  "s10-canary-a-operator-checkpoint",
] as const;

const CORE_SOURCE_EXPECTATIONS: S10SourceExpectation[] = [
  { section: "readiness_header", expected_module: /readiness_score_judgement/ },
  { section: "submission_guidance", expected_module: /readiness_score_judgement/ },
  { section: "score_summary", expected_module: /readiness_score_judgement/ },
  { section: "brief_achievement", expected_module: /brief_achievement_matrix/ },
  { section: "observed_tape", expected_module: /observed_tape_sequence|component_verifications/ },
  { section: "component_breakdown", expected_module: /component_verifications/ },
  { section: "fix_hierarchy", expected_module: /s10_fix_hierarchy/ },
  { section: "next_action_plan", expected_module: /s10_next_action_plan/ },
  { section: "strengths_and_preserve", expected_module: /s10_professional_critique/ },
  { section: "technique_commentary", expected_module: /s10_technique_commentary/ },
  { section: "timestamped_commentary", expected_module: /s10_timestamped_commentary/ },
];

const SAME_VIDEO_SOURCE_EXPECTATIONS: S10SourceExpectation[] = [
  { section: "same_video_status", expected_module: /s10_same_video_evidence/ },
  { section: "comparison_truth", expected_module: /s10_comparison_truth/ },
];

const DENSITY_BY_PROFILE: Record<S10RouteContentProfile, readonly (readonly string[])[]> = {
  canary_a_incomplete_package: [
    ["Overall readiness"],
    ["Brief achievement"],
    ["What the brief asked for"],
    ["Observed tape"],
    ["Prioritised fixes"],
    ["Next action plan"],
    ["Technique commentary"],
    ["Timestamped and time-banded notes", "Timestamped or time-banded commentary is not available"],
    ["Do not overfix"],
  ],
  strong_complete_professional: [
    ["Overall readiness"],
    ["Brief achievement"],
    ["Observed tape"],
    ["Strengths and preserve"],
    ["Technique commentary"],
    ["Timestamped and time-banded notes", "Timestamped or time-banded commentary is not available"],
    ["Submit checklist"],
    ["Optional polish", "No mandatory fix"],
    ["Do not overfix"],
  ],
  same_video_notice: [
    ["Same-video comparison"],
    [
      "same underlying video",
      "same video retest",
      "same media",
      "changed brief",
      "changed performer level",
      "report version",
      "report or analysis-context",
      "uncertain",
    ],
  ],
  missing_module: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normaliseSmartQuotes(value: string): string {
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ");
}

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normaliseS10RouteText(value: unknown): string {
  return normaliseSmartQuotes(decodeCommonEntities(String(value ?? "")))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisedIncludes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(normaliseS10RouteText(phrase).toLowerCase());
}

function addFailure(failures: S10RouteContentFailure[], failure: S10RouteContentFailure) {
  failures.push(failure);
}

function matchesSourceModule(
  actual: string | null,
  expected: string | RegExp | undefined,
): boolean {
  if (!expected) return true;
  if (!actual) return false;
  return typeof expected === "string" ? actual === expected : expected.test(actual);
}

function expectedSourceForProfile(profile: S10RouteContentProfile): S10SourceExpectation[] {
  if (profile === "same_video_notice") return SAME_VIDEO_SOURCE_EXPECTATIONS;
  if (profile === "missing_module") return [];
  return CORE_SOURCE_EXPECTATIONS;
}

function checkSourceMap(
  input: S10RouteContentAcceptanceInput,
  failures: S10RouteContentFailure[],
  matched: string[],
) {
  const sourceMap = isRecord(input.view_model)
    ? (input.view_model.section_source_map as Record<string, unknown> | undefined)
    : undefined;
  const expectations = input.sourceExpectations ?? expectedSourceForProfile(input.profile);

  for (const expectation of expectations) {
    const entry = isRecord(sourceMap?.[expectation.section])
      ? sourceMap[expectation.section]
      : null;
    const source = isRecord(entry) ? asText(entry.source) : null;
    const module = isRecord(entry) ? asText(entry.module) : null;
    const expectedSource = expectation.expected_source ?? "s10_authoritative_module";
    const sourceOk =
      source === expectedSource ||
      (expectation.allow_specific_limitation && source === "specific_limitation");
    const moduleOk =
      expectation.allow_specific_limitation && source === "specific_limitation"
        ? true
        : matchesSourceModule(module, expectation.expected_module);

    if (!sourceOk || !moduleOk || /raw_report/i.test(`${source ?? ""} ${module ?? ""}`)) {
      addFailure(failures, {
        category: "source_map",
        fixture_id: input.fixture_id,
        section: expectation.section,
        expected_source: expectation.allow_specific_limitation
          ? `${expectedSource} or specific_limitation`
          : expectedSource,
        actual_source: source,
        expected_module:
          typeof expectation.expected_module === "string"
            ? expectation.expected_module
            : expectation.expected_module?.source,
        actual_module: module,
        message: `Section ${expectation.section} is not sourced from the expected S10 module.`,
      });
    } else {
      matched.push(`source:${expectation.section}`);
    }
  }

  if (isRecord(sourceMap)) {
    for (const [section, rawEntry] of Object.entries(sourceMap)) {
      const entry = isRecord(rawEntry) ? rawEntry : null;
      const source = asText(entry?.source);
      const module = asText(entry?.module);
      if (/raw_report/i.test(`${source ?? ""} ${module ?? ""}`)) {
        addFailure(failures, {
          category: "source_map",
          fixture_id: input.fixture_id,
          section,
          expected_source: "non-raw-report S10 source",
          actual_source: source,
          actual_module: module,
          message: `S10 view model section ${section} is sourced from raw_report.`,
        });
      }
    }
  }
}

function checkInternalLeaks(
  input: S10RouteContentAcceptanceInput,
  combinedText: string,
  failures: S10RouteContentFailure[],
  matched: string[],
) {
  const terms = input.internalLeakTerms ?? DEFAULT_INTERNAL_LEAK_TERMS;
  const viewText = JSON.stringify(input.view_model ?? {});
  const reportText = JSON.stringify(input.v2_report ?? {});
  const searchable = `${combinedText}\n${viewText}\n${reportText}`;
  for (const term of terms) {
    if (searchable.includes(term)) {
      addFailure(failures, {
        category: "internal_leak",
        fixture_id: input.fixture_id,
        expected: "internal term absent",
        actual: term,
        message: `Internal or diagnostic term is visible in route/view-model output: ${term}`,
      });
    } else {
      matched.push(`internal absent:${term}`);
    }
  }
}

function checkExpectedValue(
  input: S10RouteContentAcceptanceInput,
  failures: S10RouteContentFailure[],
  matched: string[],
) {
  if (!isRecord(input.view_model)) return;
  const recommendation = isRecord(input.view_model.recommendation)
    ? input.view_model.recommendation
    : null;
  const decision = asText(recommendation?.decision);
  if (input.expectedDecision) {
    const allowed = Array.isArray(input.expectedDecision)
      ? input.expectedDecision
      : [input.expectedDecision];
    if (!decision || !allowed.includes(decision)) {
      addFailure(failures, {
        category: "score_verdict",
        fixture_id: input.fixture_id,
        expected: allowed,
        actual: decision,
        message: "S10 recommendation decision does not match route acceptance expectation.",
      });
    } else {
      matched.push("decision");
    }
  }

  if (input.expectedComparisonPolicy) {
    const comparison = isRecord(input.view_model.comparison_truth)
      ? input.view_model.comparison_truth
      : null;
    const policy = asText(comparison?.recommendation_policy);
    const allowed = Array.isArray(input.expectedComparisonPolicy)
      ? input.expectedComparisonPolicy
      : [input.expectedComparisonPolicy];
    if (!policy || !allowed.includes(policy)) {
      addFailure(failures, {
        category: "comparison_truth",
        fixture_id: input.fixture_id,
        expected: allowed,
        actual: policy,
        message: "S10 comparison policy does not match route acceptance expectation.",
      });
    } else {
      matched.push("comparison_policy");
    }
  }

  if (input.expectedFixFirstIncludes !== undefined) {
    const reportFix = isRecord(input.v2_report) ? input.v2_report.fix_first : null;
    const fixHierarchy = isRecord(input.view_model.fix_hierarchy)
      ? input.view_model.fix_hierarchy
      : null;
    const fixFirst = isRecord(fixHierarchy?.fix_first) ? fixHierarchy.fix_first : null;
    const actual = [reportFix, fixFirst?.title, fixFirst?.exact_action]
      .map(asText)
      .filter(Boolean)
      .join(" ");
    const expected = input.expectedFixFirstIncludes;
    if (expected === null) {
      if (actual.trim()) {
        addFailure(failures, {
          category: "fix_first",
          fixture_id: input.fixture_id,
          expected: "no mandatory fix first",
          actual,
          message: "Fix-first content is present where the fixture expects none.",
        });
      } else {
        matched.push("fix_first_absent");
      }
    } else if (!normalisedIncludes(actual, expected)) {
      addFailure(failures, {
        category: "fix_first",
        fixture_id: input.fixture_id,
        expected,
        actual: actual || null,
        message: "Fix-first content does not match route acceptance expectation.",
      });
    } else {
      matched.push("fix_first");
    }
  }
}

export function assertS10RouteContentAcceptance(
  input: S10RouteContentAcceptanceInput,
): S10RouteContentAcceptanceResult {
  const failures: S10RouteContentFailure[] = [];
  const matched: string[] = [];
  const routeText = normaliseS10RouteText(input.rendered_route_html);
  const pdfText = input.print_pdf_text ? normaliseS10RouteText(input.print_pdf_text) : "";
  const combinedText = [routeText, pdfText].filter(Boolean).join(" ");

  for (const phrase of input.forbiddenExact ?? []) {
    if (normalisedIncludes(combinedText, phrase)) {
      addFailure(failures, {
        category: "forbidden_content",
        fixture_id: input.fixture_id,
        expected: "absent",
        actual: phrase,
        message: `Forbidden regression phrase is visible: ${phrase}`,
      });
    } else {
      matched.push(`forbidden absent:${phrase}`);
    }
  }

  for (const phrase of input.requiredAllOf ?? []) {
    if (!normalisedIncludes(combinedText, phrase)) {
      addFailure(failures, {
        category: "required_content",
        fixture_id: input.fixture_id,
        expected: phrase,
        actual: null,
        message: `Required phrase is missing: ${phrase}`,
      });
    } else {
      matched.push(`required:${phrase}`);
    }
  }

  for (const group of input.requiredAnyOf ?? []) {
    if (!group.some((phrase) => normalisedIncludes(combinedText, phrase))) {
      addFailure(failures, {
        category: "required_content",
        fixture_id: input.fixture_id,
        expected: [...group],
        actual: null,
        message: `None of the required semantic phrase alternatives appeared.`,
      });
    } else {
      matched.push(`requiredAnyOf:${group.join("|")}`);
    }
  }

  for (const group of input.densitySections ?? DENSITY_BY_PROFILE[input.profile]) {
    if (!group.some((phrase) => normalisedIncludes(combinedText, phrase))) {
      addFailure(failures, {
        category: "density",
        fixture_id: input.fixture_id,
        expected: [...group],
        actual: null,
        message: "Rendered route report is missing a required density section.",
      });
    } else {
      matched.push(`density:${group.join("|")}`);
    }
  }

  if (input.operator_comparison) {
    if (input.operator_comparison.comparison_status !== "matches_operator_expectation") {
      addFailure(failures, {
        category: "operator_comparison",
        fixture_id: input.fixture_id,
        expected: "matches_operator_expectation",
        actual: input.operator_comparison.comparison_status,
        message: "Operator checkpoint comparison does not match route acceptance expectation.",
      });
    } else {
      matched.push("operator_comparison");
    }
  }

  checkExpectedValue(input, failures, matched);
  checkSourceMap(input, failures, matched);
  checkInternalLeaks(input, combinedText, failures, matched);

  return { ok: failures.length === 0, failures, matched };
}
