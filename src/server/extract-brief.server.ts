// SERVER-ONLY. Extracts a structured ExtractedBrief from a free-text casting
// brief using Gemini Flash via the Lovable AI Gateway. Cheap + fast — runs
// once per audition before the main multimodal evaluation.
//
// Defensive: never throws on parse failure; returns a minimal fallback.

import type { ExtractedBrief, AuditionType } from "@/lib/audition-rules";

export type ExtractionConfidence = "low" | "medium" | "high";
export type TimeLimitSource = "explicit" | "none";

export type ExtractedBriefWithMeta = {
  brief: ExtractedBrief & { time_limit_source?: TimeLimitSource };
  extraction_confidence: ExtractionConfidence;
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

export async function extractBriefFromText(
  briefText: string,
): Promise<ExtractedBriefWithMeta | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("extractBriefFromText: LOVABLE_API_KEY missing");
    return null;
  }
  if (!briefText || briefText.trim().length < 5) return null;

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
    });

    if (!resp.ok) {
      console.warn("extractBriefFromText: gateway error", resp.status);
      return null;
    }
    const json = await resp.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
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
    return { brief: briefOnly as ExtractedBrief, extraction_confidence: conf };
  } catch (err) {
    console.warn("extractBriefFromText: failed", err);
    return null;
  }
}
