// SERVER-ONLY. Extracts a structured ExtractedBrief from a free-text casting
// brief using Gemini Flash via the Lovable AI Gateway. Cheap + fast — runs
// once per audition before the main multimodal evaluation.
//
// Defensive: never throws on parse failure; returns a minimal fallback.

import type { ExtractedBrief, AuditionType } from "@/lib/audition-rules";

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
      },
      required: ["audition_type"],
    },
  },
};

const SYSTEM = `You are a UK casting assistant. Extract a structured casting brief from the text below.
Use British English in any free-text fields ("recall", not "callback"; "self-tape"; "analysing", "prioritised", "behaviour", "centre").
Only fill fields the brief actually states or strongly implies. Use null / "unspecified" / empty arrays when not stated. Do not invent constraints.
For time_limit_seconds, convert anything stated (e.g. "under 2 minutes" → 120, "32-bar cut" → 90 as a sensible default).`;

export async function extractBriefFromText(
  briefText: string,
): Promise<ExtractedBrief | null> {
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
    const parsed = JSON.parse(args) as ExtractedBrief;
    // Belt-and-braces: ensure audition_type is valid.
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
    return parsed;
  } catch (err) {
    console.warn("extractBriefFromText: failed", err);
    return null;
  }
}
