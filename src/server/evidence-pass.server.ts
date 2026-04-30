// SERVER-ONLY. Step 1 of the two-step analysis pipeline.
//
// Multimodal "evidence" pass. Watches the tape and returns a compact, factual
// observation set + raw category scores + up to N validated MM:SS timestamps.
// Deterministic settings (temperature 0, top_p 1).
//
// IMPORTANT: This module never persists the returned object verbatim. The
// orchestrator in process-take.server.ts keeps it in memory for Step 2 and
// then derives a small, non-sensitive summary into `score_breakdown.two_step`.

const DEFAULT_MODEL =
  process.env.EVIDENCE_PASS_MODEL ?? "google/gemini-3-flash-preview";

const EVIDENCE_TOOL = {
  type: "function" as const,
  function: {
    name: "collect_audition_evidence",
    description:
      "Collect factual, observation-only evidence from the self-tape. Do NOT polish, recommend, or write feedback prose. Score categories on the same 0–100 scale used downstream.",
    parameters: {
      type: "object",
      properties: {
        audition_type: {
          type: "string",
          enum: [
            "acting_scene",
            "song",
            "musical_theatre",
            "dance",
            "commercial",
            "hybrid",
            "unknown",
          ],
        },
        detected_components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "acting_scene",
                  "song",
                  "monologue",
                  "dance",
                  "commercial",
                  "slate",
                  "other",
                ],
              },
              weight: { type: "number" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              note: { type: "string" },
            },
            required: ["type", "weight", "score", "note"],
          },
        },
        raw_scores: {
          type: "object",
          properties: {
            technical: { type: "integer", minimum: 0, maximum: 100 },
            audio: { type: "integer", minimum: 0, maximum: 100 },
            vocal: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            acting: { type: "integer", minimum: 0, maximum: 100 },
            brief_adherence: { type: "integer", minimum: 0, maximum: 100 },
            professional_presentation: {
              type: "integer",
              minimum: 0,
              maximum: 100,
            },
          },
          required: [
            "technical",
            "audio",
            "acting",
            "brief_adherence",
            "professional_presentation",
          ],
        },
        sufficiency: {
          type: "object",
          properties: {
            has_audio: { type: "boolean" },
            has_visible_face: { type: "boolean" },
            duration_ok: { type: "boolean" },
            script_signal: { type: "boolean" },
          },
          required: [
            "has_audio",
            "has_visible_face",
            "duration_ok",
            "script_signal",
          ],
        },
        observations: {
          type: "array",
          description:
            "Short, factual observations (no prose, no advice). Each must be directly visible/audible in the tape.",
          items: { type: "string", maxLength: 280 },
          maxItems: 24,
        },
        timestamps: {
          type: "array",
          description:
            "Up to 8 noteworthy moments. timestamp must be MM:SS within the tape duration.",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "MM:SS" },
              note: { type: "string", maxLength: 240 },
              kind: {
                type: "string",
                enum: [
                  "strength",
                  "issue",
                  "audio",
                  "technical",
                  "performance",
                  "compliance",
                  "other",
                ],
              },
            },
            required: ["timestamp", "note", "kind"],
          },
          maxItems: 8,
        },
        risk_signals: {
          type: "array",
          description:
            "Concrete, observation-grounded risk signals (e.g. 'no audible dialogue in first 30s', 'portrait orientation'). No interpretation.",
          items: { type: "string", maxLength: 200 },
          maxItems: 8,
        },
        role_fit_signals: {
          type: "array",
          description:
            "Observation-grounded role-fit signals (tone, energy, intention). Empty if no brief.",
          items: { type: "string", maxLength: 200 },
          maxItems: 6,
        },
        presentation_signals: {
          type: "array",
          description:
            "Camera-readability observations only (framing, contrast, focus). Never personal.",
          items: { type: "string", maxLength: 200 },
          maxItems: 6,
        },
      },
      required: [
        "audition_type",
        "detected_components",
        "raw_scores",
        "sufficiency",
        "observations",
        "timestamps",
        "risk_signals",
        "role_fit_signals",
        "presentation_signals",
      ],
    },
  },
};

const EVIDENCE_SYSTEM_PROMPT = `You are an evidence collector for a self-tape audition. Your ONLY job is to return factual observations and per-category scores. Do NOT write prose feedback, recommendations, or coaching. Do NOT polish.

Rules:
- Observations must be directly visible or audible in the tape. No interpretation, no advice.
- Use British English in any free text.
- Timestamps must be MM:SS, within the tape's actual duration. Maximum 8.
- Score categories on the same 0–100 scale as the final report.
- For BASELINE (no brief), still score brief_adherence as a professional-standards equivalent.
- Never comment on appearance, body, age, race, class, disability, mobility aids, medical devices, or socioeconomic status.
- Use null for vocal when there is no singing.
- Keep observations short and concrete.

Return ONLY via the collect_audition_evidence tool.`;

export type EvidencePass = {
  audition_type: string;
  detected_components: Array<{
    type: string;
    weight: number;
    score: number;
    note: string;
  }>;
  raw_scores: {
    technical: number;
    audio: number;
    vocal: number | null;
    acting: number;
    brief_adherence: number;
    professional_presentation: number;
  };
  sufficiency: {
    has_audio: boolean;
    has_visible_face: boolean;
    duration_ok: boolean;
    script_signal: boolean;
  };
  observations: string[];
  timestamps: Array<{ timestamp: string; note: string; kind: string }>;
  risk_signals: string[];
  role_fit_signals: string[];
  presentation_signals: string[];
};

const TS_RE = /^([0-5]?\d):([0-5]\d)$/;

export function isValidTimestamp(ts: string, durationSeconds?: number | null): boolean {
  if (typeof ts !== "string") return false;
  const m = TS_RE.exec(ts);
  if (!m) return false;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if (total > Math.ceil(durationSeconds) + 1) return false;
  }
  return true;
}

export type RunEvidencePassArgs = {
  videoUrl: string;
  apiKey: string;
  model?: string;
  signal: AbortSignal;
  contextText: string;
  durationSeconds?: number | null;
};

export type RunEvidencePassResult =
  | { ok: true; evidence: EvidencePass; durationMs: number; model: string; httpStatus: number }
  | { ok: false; httpStatus: number | null; error: string; durationMs: number; model: string };

export async function runEvidencePass(
  args: RunEvidencePassArgs,
): Promise<RunEvidencePassResult> {
  const model = args.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  let resp: Response | null = null;
  try {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        top_p: 1,
        max_tokens: 4096,
        messages: [
          { role: "system", content: EVIDENCE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: args.contextText },
              { type: "file_url", file_url: { url: args.videoUrl } },
            ],
          },
        ],
        tools: [EVIDENCE_TOOL],
        tool_choice: {
          type: "function",
          function: { name: "collect_audition_evidence" },
        },
      }),
      signal: args.signal,
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      error: err instanceof Error ? err.message : "network_error",
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  if (!resp.ok) {
    let body = "";
    try {
      body = await resp.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      httpStatus: resp.status,
      error: `evidence_pass_http_${resp.status}: ${body.slice(0, 200)}`,
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  let parsed: EvidencePass | null = null;
  try {
    const json = await resp.json();
    const choice = json.choices?.[0];
    const tc = choice?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      return {
        ok: false,
        httpStatus: resp.status,
        error: "evidence_pass_no_tool_call",
        durationMs: Date.now() - startedAt,
        model,
      };
    }
    parsed = JSON.parse(tc.function.arguments) as EvidencePass;
  } catch (err) {
    return {
      ok: false,
      httpStatus: resp.status,
      error: err instanceof Error ? err.message : "evidence_pass_parse_error",
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  // Defensive normalisation.
  const ev = parsed as EvidencePass;
  if (!Array.isArray(ev.timestamps)) ev.timestamps = [];
  ev.timestamps = ev.timestamps
    .filter((t) => t && typeof t.timestamp === "string" && typeof t.note === "string")
    .filter((t) => isValidTimestamp(t.timestamp, args.durationSeconds))
    .slice(0, 8);
  if (!Array.isArray(ev.observations)) ev.observations = [];
  if (!Array.isArray(ev.risk_signals)) ev.risk_signals = [];
  if (!Array.isArray(ev.role_fit_signals)) ev.role_fit_signals = [];
  if (!Array.isArray(ev.presentation_signals)) ev.presentation_signals = [];

  return {
    ok: true,
    evidence: ev,
    durationMs: Date.now() - startedAt,
    model,
    httpStatus: resp.status,
  };
}

/**
 * Compact, non-sensitive summary derived from an EvidencePass.
 * Safe to persist into score_breakdown.two_step. Does NOT include raw
 * observation text or model output.
 */
export function summariseEvidence(ev: EvidencePass) {
  return {
    timestamped_evidence_count: ev.timestamps.length,
    evidence_sufficiency: {
      has_audio: !!ev.sufficiency?.has_audio,
      has_visible_face: !!ev.sufficiency?.has_visible_face,
      duration_ok: !!ev.sufficiency?.duration_ok,
      script_signal: !!ev.sufficiency?.script_signal,
    },
  };
}
