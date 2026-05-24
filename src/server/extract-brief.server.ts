// SERVER-ONLY. Extracts a structured ExtractedBrief from a free-text casting
// brief using Gemini Flash via the Lovable AI Gateway. Cheap + fast — runs
// once per audition before the main multimodal evaluation.
//
// Defensive: never throws on parse failure; returns a minimal fallback.

import type {
  AuditionType,
  BriefContext,
  BriefRequirement,
  BriefRequirementCategory,
  BriefRequirementImportance,
  ExtractedBrief,
  MaterialPolicy,
} from "@/lib/audition-rules";
import { S10_BRIEF_INTELLIGENCE_PROMPT_VERSION } from "./s10-report-prompt-map.server";

export type ExtractionConfidence = "low" | "medium" | "high";
export type TimeLimitSource = "explicit" | "none";

export type BriefExtractionSource = "ai" | "fallback";

export type ExtractedBriefWithMeta = {
  brief: ExtractedBrief & {
    time_limit_source?: TimeLimitSource;
    material_policy?: MaterialPolicy;
    _source?: BriefExtractionSource;
  };
  extraction_confidence: ExtractionConfidence;
  source: BriefExtractionSource;
};

const BRIEF_REQUIREMENT_CATEGORIES: BriefRequirementCategory[] = [
  "material",
  "performance",
  "technical",
  "admin_process",
  "deadline",
  "logistics",
  "role_context",
];

const BRIEF_REQUIREMENT_IMPORTANCES: BriefRequirementImportance[] = [
  "mandatory",
  "preferred",
  "optional",
  "ambiguous",
];

export type S10BriefRuntimeFacts = {
  material_presence: "supplied" | "absent" | "unknown";
  material_presence_source: "loaded_runtime_field" | "not_loaded" | "unavailable";
  component_or_task_declaration: string[] | null;
  component_or_task_declaration_status: "unknown" | "known_empty" | "supplied";
  component_or_task_declaration_source: "not_loaded" | "loaded_runtime_field";
};

// Detects ONLY explicit numeric durations in the raw brief text.
// Allowed phrasings (examples — not exhaustive but covers the documented set):
//   "90 seconds", "90s", "90 secs", "max 90 seconds", "up to 2 minutes",
//   "under 2 mins", "no longer than 120 seconds", "must be 1 minute".
// Crucially this does NOT match: "32-bar cut", "16-bar cut", song length,
// audition type, app upload limits, or any non-numeric implied duration.
function parseExplicitDuration(raw: string): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase();

  // Bar-cut phrases must NOT yield a duration. If the brief ONLY contains a
  // bar-cut reference and no numeric duration phrase, return null.
  // We still allow "32-bar cut, max 90 seconds" — handled because the seconds
  // regex below independently matches "90 seconds".

  // Try seconds first: "<num> seconds|secs|s" (with optional qualifier)
  const secMatch = text.match(
    /\b(?:max(?:imum)?|up\s*to|under|no\s+longer\s+than|must\s+be|at\s+most|within|<=?|≤)?\s*(\d{1,3})\s*(?:seconds?|secs?|s)\b/,
  );
  if (secMatch) {
    const n = parseInt(secMatch[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 1800) return n;
  }

  // Then minutes: "<num> minutes|mins|min" (with optional qualifier)
  const minMatch = text.match(
    /\b(?:max(?:imum)?|up\s*to|under|no\s+longer\s+than|must\s+be|at\s+most|within|<=?|≤)?\s*(\d{1,2})\s*(?:minutes?|mins?|min)\b/,
  );
  if (minMatch) {
    const n = parseInt(minMatch[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 30) return n * 60;
  }

  return null;
}

// Deterministic material-policy classifier. Operates on the raw brief text
// and the model-extracted material_requested. Used by the alternative-material
// scrub downstream — only "fixed" triggers the strict scrub.
const CHOICE_MATERIAL_PATTERNS: RegExp[] = [
  /\b(of|your)\s+choice\b/i,
  /\b(any|choose\s+any)\s+(song|monologue|scene|piece|dance|routine|material)\b/i,
  /\b(song|monologue|scene|piece|dance|routine|material)\s+of\s+your\s+choice\b/i,
  /\bfree\s+choice\b/i,
  /\bperformer'?s\s+choice\b/i,
];

export function detectMaterialPolicy(
  rawBrief: string,
  materialRequested?: string | null,
): MaterialPolicy {
  const raw = rawBrief || "";
  const material = (materialRequested || "").trim();

  if (CHOICE_MATERIAL_PATTERNS.some((pattern) => pattern.test(raw))) {
    return "choice";
  }

  if (!material) {
    return "none";
  }

  const materialLower = material.toLowerCase();
  if (
    materialLower.includes("choice") ||
    materialLower.includes("any song") ||
    materialLower.includes("any monologue") ||
    materialLower.includes("any scene") ||
    materialLower.includes("any piece")
  ) {
    return "choice";
  }

  return "fixed";
}

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_brief",
    description: "Extract a structured casting brief from free text.",
    parameters: {
      type: "object",
      properties: {
        audition_type: {
          type: "string",
          enum: [
            "acting_scene",
            "monologue",
            "song",
            "musical_theatre",
            "dance",
            "commercial",
            "hybrid",
            "unknown",
          ],
        },
        role_name: { type: ["string", "null"] },
        show_or_project: { type: ["string", "null"] },
        character_descriptors: { type: "array", items: { type: "string" } },
        tone_or_world: { type: ["string", "null"] },
        performance_style: { type: ["string", "null"] },
        accent_or_dialect_required: { type: ["string", "null"] },
        accent_required: {
          type: "string",
          enum: ["yes", "no", "unknown"],
          description:
            "Whether the brief explicitly requires a specific accent or dialect. 'unknown' if the brief doesn't say.",
        },
        accent_importance: {
          type: "string",
          enum: ["central", "preferred", "unspecified"],
          description:
            "How important the accent requirement is. 'central' = essential to the role (e.g. 'must be authentic Glaswegian'); 'preferred' = nice to have ('ideally RP'); 'unspecified' = brief is silent.",
        },
        vocal_style_required: { type: ["string", "null"] },
        movement_or_dance_required: { type: ["string", "null"] },
        reader_required: { type: "string", enum: ["yes", "no", "unspecified"] },
        slate_required: { type: "string", enum: ["yes", "no", "unspecified"] },
        orientation_required: {
          type: ["string", "null"],
          enum: ["portrait", "landscape", "either", null],
        },
        framing_required: { type: ["string", "null"] },
        time_limit_seconds: { type: ["integer", "null"] },
        explicit_instructions: { type: "array", items: { type: "string" } },
        material_requested: { type: ["string", "null"] },
        recall_dates: { type: ["string", "null"] },
        confidentiality_notes: { type: ["string", "null"] },
        brief_context: {
          type: "object",
          properties: {
            project_name: { type: ["string", "null"] },
            role_name: { type: ["string", "null"] },
            discipline: { type: ["string", "null"] },
            audition_type: { type: ["string", "null"] },
            material_package_summary: { type: ["string", "null"] },
            role_description_summary: { type: ["string", "null"] },
            deadline_summary: { type: ["string", "null"] },
            upload_summary: { type: ["string", "null"] },
            file_naming_summary: { type: ["string", "null"] },
          },
        },
        brief_requirements: {
          type: "array",
          description:
            "Explicit, testable requirements extracted from the supplied brief. Preserve useful brief wording; do not collapse Side 1, song, package, file, framing, naming, upload or deadline instructions into one generic item.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              brief_text: { type: "string" },
              summary: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "material",
                  "performance",
                  "technical",
                  "admin_process",
                  "deadline",
                  "logistics",
                  "role_context",
                ],
              },
              importance: {
                type: "string",
                enum: ["mandatory", "preferred", "optional", "ambiguous"],
              },
              expected_evidence_in_tape: { type: "string" },
              achievement_test: { type: "string" },
              submission_impact_if_missing: { type: "string" },
              report_destination: { type: "string" },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: [
              "id",
              "brief_text",
              "summary",
              "category",
              "importance",
              "expected_evidence_in_tape",
              "achievement_test",
              "submission_impact_if_missing",
              "report_destination",
              "confidence",
            ],
          },
        },
        brief_intelligence_prompt_version: {
          type: "string",
          enum: [S10_BRIEF_INTELLIGENCE_PROMPT_VERSION],
        },
        extraction_confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "Your confidence that the structured fields above accurately reflect the brief. Use 'low' if the brief is vague, very short, or you had to guess multiple fields. 'high' only when the brief is explicit and unambiguous.",
        },
      },
      required: ["audition_type", "extraction_confidence", "brief_context", "brief_requirements"],
    },
  },
};

export const BRIEF_INTELLIGENCE_SYSTEM_PROMPT = `${S10_BRIEF_INTELLIGENCE_PROMPT_VERSION}

You are TapeCoach's UK casting brief intelligence pass. Extract the supplied brief into explicit, testable requirements before any tape observation, scoring, recommendation or professional judgement can happen.

Use British English in any free-text fields ("recall", not "callback"; "self-tape"; "analysing", "prioritised", "behaviour", "centre").

Preserve useful supplied brief detail. Do not suppress or over-summarise Side/page/line references, song style, package instructions, framing/orientation, one-file/continuous-video, naming, upload or deadline details. Only fill fields the brief actually states or strongly implies. Use null / "unspecified" / "unknown" / empty arrays when not stated. Do not invent constraints.

Return:
1. Legacy compatibility fields such as audition_type, role_name, show_or_project, material_requested, orientation_required, framing_required and explicit_instructions.
2. brief_context with project_name, role_name, discipline, audition_type, material_package_summary, role_description_summary, deadline_summary, upload_summary and file_naming_summary.
3. brief_requirements as one item per distinct requirement. Do not merge required Side 1, song, continuous-video package, one-file upload, landscape, close-up/head-and-shoulders, file naming or deadline instructions into one generic item.

For each BriefRequirement:
- brief_text must quote or closely preserve the relevant supplied wording.
- category must be one of: material, performance, technical, admin_process, deadline, logistics, role_context.
- importance must be mandatory, preferred, optional or ambiguous.
- expected_evidence_in_tape must say what observation would prove the requirement is met.
- achievement_test must be checkable by the S10 tape observation pass.
- submission_impact_if_missing must describe the readiness impact if missing.
- report_destination must name where the authenticated report can show this item, e.g. brief_achievement, component_breakdown, submission_risk, presentation_notes or role_context.

Classification rules:
- Required acting scenes, sides, monologues, songs, dance sections or commercial copy are material requirements.
- Role descriptions are role_context unless the brief explicitly makes them a performed task.
- One continuous video and one file only are admin_process/package requirements, not performance material.
- Landscape, close-up/head-and-shoulders and framing/orientation instructions are technical requirements.
- File naming is admin_process.
- Deadline/upload instructions are deadline/admin_process/logistics as appropriate.

Canary A guardrail: if a brief asks for Side 1 plus a contemporary legit MT song plus one continuous video, extract Side 1 and song as separate mandatory material requirements, continuous video as a mandatory admin_process/package requirement, and require later observation to verify whether each is present, absent, partial, cut off, uncertain or not assessable before scoring or recommending.

time_limit_seconds: ONLY populate when the brief explicitly states a numeric duration (e.g. "90 seconds", "max 90s", "up to 2 minutes", "under 2 mins", "no longer than 120 seconds", "must be 1 minute"). Otherwise return null. Do NOT infer a duration from "32-bar cut", "16-bar cut", song length, audition type, or any industry default. Bar-cut references without an explicit number -> null.

Accent fields: set accent_required="yes" only when the brief explicitly names a required accent or dialect, "no" if it explicitly says any accent is fine, otherwise "unknown". Set accent_importance="central" only when the brief makes accent essential (e.g. "must be authentic ___", "native speaker"); "preferred" when softly preferred ("ideally ___", "RP welcome"); "unspecified" otherwise. Do not infer importance from a casual mention.

Set extraction_confidence honestly: high only when the brief is explicit; low when it is short, vague, or you had to guess multiple fields.`;

const BRIEF_EXTRACTION_TIMEOUT_MS = Number(process.env.BRIEF_EXTRACTION_TIMEOUT_MS ?? 30000);

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const arrayOfStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

const isRequirementCategory = (value: unknown): value is BriefRequirementCategory =>
  typeof value === "string" &&
  BRIEF_REQUIREMENT_CATEGORIES.includes(value as BriefRequirementCategory);

const isRequirementImportance = (value: unknown): value is BriefRequirementImportance =>
  typeof value === "string" &&
  BRIEF_REQUIREMENT_IMPORTANCES.includes(value as BriefRequirementImportance);

const normaliseBriefContext = (
  value: unknown,
  parsed: { show_or_project?: unknown; role_name?: unknown; audition_type?: unknown },
): BriefContext => {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    project_name: optionalString(record.project_name) ?? optionalString(parsed.show_or_project),
    role_name: optionalString(record.role_name) ?? optionalString(parsed.role_name),
    discipline: optionalString(record.discipline),
    audition_type: optionalString(record.audition_type) ?? optionalString(parsed.audition_type),
    material_package_summary: optionalString(record.material_package_summary),
    role_description_summary: optionalString(record.role_description_summary),
    deadline_summary: optionalString(record.deadline_summary),
    upload_summary: optionalString(record.upload_summary),
    file_naming_summary: optionalString(record.file_naming_summary),
  };
};

const normaliseBriefRequirement = (
  value: unknown,
  index: number,
  defaultConfidence: ExtractionConfidence,
): BriefRequirement | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const briefText = optionalString(record.brief_text);
  const summary = optionalString(record.summary);
  const expectedEvidence = optionalString(record.expected_evidence_in_tape);
  const achievementTest = optionalString(record.achievement_test);
  const submissionImpact = optionalString(record.submission_impact_if_missing);
  if (!briefText || !summary || !expectedEvidence || !achievementTest || !submissionImpact) {
    return null;
  }

  return {
    id: optionalString(record.id) ?? `brief_requirement_${index + 1}`,
    brief_text: briefText,
    summary,
    category: isRequirementCategory(record.category) ? record.category : "role_context",
    importance: isRequirementImportance(record.importance) ? record.importance : "ambiguous",
    expected_evidence_in_tape: expectedEvidence,
    achievement_test: achievementTest,
    submission_impact_if_missing: submissionImpact,
    report_destination: optionalString(record.report_destination) ?? "brief_achievement",
    confidence:
      record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
        ? record.confidence
        : defaultConfidence,
  };
};

export function normaliseS10BriefIntelligence(parsed: {
  extraction_confidence?: unknown;
  show_or_project?: unknown;
  role_name?: unknown;
  audition_type?: unknown;
  brief_context?: unknown;
  brief_requirements?: unknown;
}): Pick<
  ExtractedBrief,
  "brief_context" | "brief_requirements" | "brief_intelligence_prompt_version"
> {
  const defaultConfidence: ExtractionConfidence =
    parsed.extraction_confidence === "high" || parsed.extraction_confidence === "medium"
      ? parsed.extraction_confidence
      : "low";
  const requirements = Array.isArray(parsed.brief_requirements)
    ? parsed.brief_requirements
        .map((item, index) => normaliseBriefRequirement(item, index, defaultConfidence))
        .filter((item): item is BriefRequirement => item != null)
    : [];

  return {
    brief_context: normaliseBriefContext(parsed.brief_context, parsed),
    brief_requirements: requirements,
    brief_intelligence_prompt_version: S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
  };
}

export function deriveS10BriefRuntimeFacts(
  extractedBrief: Pick<ExtractedBrief, "brief_requirements"> | null | undefined,
): S10BriefRuntimeFacts {
  const requirements = Array.isArray(extractedBrief?.brief_requirements)
    ? extractedBrief.brief_requirements
    : [];
  if (requirements.length === 0) {
    return {
      material_presence: "unknown",
      material_presence_source: "not_loaded",
      component_or_task_declaration: null,
      component_or_task_declaration_status: "unknown",
      component_or_task_declaration_source: "not_loaded",
    };
  }

  const materialRequirements = requirements.filter(
    (requirement) => requirement.category === "material" || requirement.category === "performance",
  );
  const componentDeclaration = materialRequirements.map(
    (requirement) => `${requirement.id}: ${requirement.summary}`,
  );

  return {
    material_presence: materialRequirements.length > 0 ? "supplied" : "absent",
    material_presence_source: "loaded_runtime_field",
    component_or_task_declaration: componentDeclaration,
    component_or_task_declaration_status:
      componentDeclaration.length > 0 ? "supplied" : "known_empty",
    component_or_task_declaration_source: "loaded_runtime_field",
  };
}

export function buildBriefExtractionRequestBody(briefText: string) {
  return {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: BRIEF_INTELLIGENCE_SYSTEM_PROMPT },
      { role: "user", content: briefText.slice(0, 8000) },
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "function", function: { name: "extract_brief" } },
    max_tokens: 4096,
  };
}

// Build a safe low-confidence fallback when the AI extraction times out or
// fails. Uses the deterministic helpers (explicit-duration parser +
// material-policy classifier) so we still get useful structured signal
// without blocking the main analysis.
function buildSafeFallbackBrief(briefText: string): ExtractedBriefWithMeta {
  const explicitDuration = parseExplicitDuration(briefText);
  const timeLimitSource: TimeLimitSource = explicitDuration != null ? "explicit" : "none";
  const materialPolicy = detectMaterialPolicy(briefText, null);

  const brief: ExtractedBrief & {
    time_limit_source?: TimeLimitSource;
    material_policy?: MaterialPolicy;
    _source?: BriefExtractionSource;
  } = {
    audition_type: "unknown",
    role_name: null,
    show_or_project: null,
    brief_context: normaliseBriefContext(null, { audition_type: "unknown" }),
    brief_requirements: [],
    brief_intelligence_prompt_version: S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
    character_descriptors: [],
    tone_or_world: null,
    performance_style: null,
    accent_or_dialect_required: null,
    accent_required: "unknown",
    accent_importance: "unspecified",
    vocal_style_required: null,
    movement_or_dance_required: null,
    reader_required: "unspecified",
    slate_required: "unspecified",
    orientation_required: null,
    framing_required: null,
    time_limit_seconds: explicitDuration,
    explicit_instructions: [],
    material_requested: null,
    recall_dates: null,
    confidentiality_notes: null,
    time_limit_source: timeLimitSource,
    material_policy: materialPolicy,
    _source: "fallback",
  } as ExtractedBrief & {
    time_limit_source?: TimeLimitSource;
    material_policy?: MaterialPolicy;
    _source?: BriefExtractionSource;
  };

  return { brief, extraction_confidence: "low", source: "fallback" };
}

export async function extractBriefFromText(
  briefText: string,
): Promise<ExtractedBriefWithMeta | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("extractBriefFromText: LOVABLE_API_KEY missing");
    return null;
  }
  if (!briefText || briefText.trim().length < 5) return null;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), BRIEF_EXTRACTION_TIMEOUT_MS);
  let timedOut = false;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBriefExtractionRequestBody(briefText)),
      signal: controller.signal,
    });

    if (!resp.ok) {
      console.warn("[take-pipeline] brief_extraction_failed", {
        status: resp.status,
        timeout_ms: BRIEF_EXTRACTION_TIMEOUT_MS,
      });
      return buildSafeFallbackBrief(briefText);
    }
    const json = await resp.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return buildSafeFallbackBrief(briefText);
    const parsed = JSON.parse(args) as ExtractedBrief & {
      extraction_confidence?: ExtractionConfidence;
    };
    const validTypes: AuditionType[] = [
      "acting_scene",
      "monologue",
      "song",
      "musical_theatre",
      "dance",
      "commercial",
      "hybrid",
      "unknown",
    ];
    if (!validTypes.includes(parsed.audition_type)) {
      parsed.audition_type = "unknown";
    }
    const conf: ExtractionConfidence =
      parsed.extraction_confidence === "high" || parsed.extraction_confidence === "medium"
        ? parsed.extraction_confidence
        : "low";
    // Strip meta from the brief object itself
    const { extraction_confidence: _drop, ...briefOnly } = parsed;
    void _drop;

    // ---- Duration guard: only allow time_limit_seconds when an explicit
    // numeric duration phrase appears in the raw brief text. Strips out
    // industry-default inferences from "32-bar cut", song length, etc.
    const explicitDuration = parseExplicitDuration(briefText);
    let timeLimitSource: TimeLimitSource = "none";
    let finalTimeLimit: number | null = null;
    if (explicitDuration != null) {
      finalTimeLimit = explicitDuration;
      timeLimitSource = "explicit";
    } else if (
      typeof briefOnly.time_limit_seconds === "number" &&
      briefOnly.time_limit_seconds > 0
    ) {
      console.warn(
        "extractBriefFromText: model returned time_limit_seconds without explicit phrase — overriding to null",
        {
          model_value: briefOnly.time_limit_seconds,
          material_requested: briefOnly.material_requested ?? null,
        },
      );
    }
    const durationOverridden =
      explicitDuration == null &&
      typeof briefOnly.time_limit_seconds === "number" &&
      briefOnly.time_limit_seconds > 0;

    const materialPolicy = detectMaterialPolicy(briefText, briefOnly.material_requested);
    const s10BriefIntelligence = normaliseS10BriefIntelligence(parsed);

    const briefOut: ExtractedBrief & {
      time_limit_source?: TimeLimitSource;
      material_policy?: MaterialPolicy;
      _source?: BriefExtractionSource;
    } = {
      ...(briefOnly as ExtractedBrief),
      ...s10BriefIntelligence,
      time_limit_seconds: finalTimeLimit,
      time_limit_source: timeLimitSource,
      material_policy: materialPolicy,
      _source: "ai",
    };

    // Non-PII debug log.
    console.info("[extract-brief]", {
      raw_brief_present: true,
      time_limit_seconds: briefOut.time_limit_seconds,
      time_limit_source: briefOut.time_limit_source,
      material_requested: briefOut.material_requested ? "[present]" : null,
      material_policy: briefOut.material_policy,
      brief_requirement_count: briefOut.brief_requirements?.length ?? 0,
      prompt_version: briefOut.brief_intelligence_prompt_version,
      duration_overridden: durationOverridden,
      extraction_confidence: conf,
      source: "ai",
    });

    return { brief: briefOut, extraction_confidence: conf, source: "ai" };
  } catch (err) {
    timedOut = (err instanceof Error && err.name === "AbortError") || controller.signal.aborted;
    if (timedOut) {
      console.warn("[take-pipeline] brief_extraction_timeout", {
        timeout_ms: BRIEF_EXTRACTION_TIMEOUT_MS,
      });
    } else {
      console.warn("[take-pipeline] brief_extraction_failed", {
        reason: "network_or_parse_error",
        error_name: err instanceof Error ? err.name : "unknown",
        timeout_ms: BRIEF_EXTRACTION_TIMEOUT_MS,
      });
    }
    return buildSafeFallbackBrief(briefText);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
