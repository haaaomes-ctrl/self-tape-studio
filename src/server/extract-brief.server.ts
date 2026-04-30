// SERVER-ONLY. Extracts a structured ExtractedBrief from a free-text casting
// brief using Gemini Flash via the Lovable AI Gateway. Cheap + fast — runs
// once per audition before the main multimodal evaluation.
//
// Defensive: never throws on parse failure; returns a minimal fallback.

import type { ExtractedBrief, AuditionType, MaterialPolicy } from "@/lib/audition-rules";

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
        extraction_confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "Your confidence that the structured fields above accurately reflect the brief. Use 'low' if the brief is vague, very short, or you had to guess multiple fields. 'high' only when the brief is explicit and unambiguous.",
        },
      },
      required: ["audition_type", "extraction_confidence"],
    },
  },
};

const SYSTEM = `You are a UK casting assistant. Extract a structured casting brief from the text below.
Use British English in any free-text fields ("recall", not "callback"; "self-tape"; "analysing", "prioritised", "behaviour", "centre").
Only fill fields the brief actually states or strongly implies. Use null / "unspecified" / "unknown" / empty arrays when not stated. Do not invent constraints.
time_limit_seconds: ONLY populate when the brief explicitly states a numeric duration (e.g. "90 seconds", "max 90s", "up to 2 minutes", "under 2 mins", "no longer than 120 seconds", "must be 1 minute"). Otherwise return null. Do NOT infer a duration from "32-bar cut", "16-bar cut", song length, audition type, or any industry default. Bar-cut references without an explicit number → null.
Accent fields: set accent_required="yes" only when the brief explicitly names a required accent or dialect, "no" if it explicitly says any accent is fine, otherwise "unknown". Set accent_importance="central" only when the brief makes accent essential (e.g. "must be authentic ___", "native speaker"); "preferred" when softly preferred ("ideally ___", "RP welcome"); "unspecified" otherwise. Do not infer importance from a casual mention.
Set extraction_confidence honestly: 'high' only when the brief is explicit; 'low' when it is short, vague, or you had to guess multiple fields.`;

const BRIEF_EXTRACTION_TIMEOUT_MS = Number(
  process.env.BRIEF_EXTRACTION_TIMEOUT_MS ?? 30000,
);

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
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: briefText.slice(0, 8000) },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_brief" } },
        max_tokens: 2048,
      }),
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

    const briefOut: ExtractedBrief & {
      time_limit_source?: TimeLimitSource;
      material_policy?: MaterialPolicy;
    } = {
      ...(briefOnly as ExtractedBrief),
      time_limit_seconds: finalTimeLimit,
      time_limit_source: timeLimitSource,
      material_policy: materialPolicy,
    };

    // Non-PII debug log.
    console.info("[extract-brief]", {
      raw_brief_present: true,
      time_limit_seconds: briefOut.time_limit_seconds,
      time_limit_source: briefOut.time_limit_source,
      material_requested: briefOut.material_requested ? "[present]" : null,
      material_policy: briefOut.material_policy,
      duration_overridden: durationOverridden,
      extraction_confidence: conf,
    });

    return { brief: briefOut, extraction_confidence: conf };
  } catch (err) {
    timedOut =
      (err instanceof Error && err.name === "AbortError") ||
      controller.signal.aborted;
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
