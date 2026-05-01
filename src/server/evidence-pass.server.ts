// SERVER-ONLY. Step 1 of the two-step analysis pipeline.
//
// Multimodal "evidence" pass. Watches the tape and returns a structured,
// observation-only evidence object: per-category raw scores, core
// strengths/improvements anchored in evidence, brief-adherence sub-evidence,
// risk evidence, presentation evidence, role-fit evidence, sufficiency, and
// up to 8 validated MM:SS timestamped moments.
//
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
      "Collect factual, observation-only evidence from the self-tape. Do NOT polish, recommend, or write feedback prose. Score categories on the same 0–100 scale used downstream. Order arrays by importance as instructed.",
    parameters: {
      type: "object",
      properties: {
        evidence_version: { type: "string", enum: ["1"] },
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
        core_strengths_evidence: {
          type: "array",
          description:
            "Strongest, most submission-relevant strengths first. Each must reference an observable fact in the tape.",
          items: {
            type: "object",
            properties: {
              area: { type: "string", maxLength: 80 },
              evidence: { type: "string", maxLength: 240 },
            },
            required: ["area", "evidence"],
          },
          maxItems: 5,
        },
        core_improvements_evidence: {
          type: "array",
          description:
            "Highest-impact fix first. Each must reference an observable fact in the tape.",
          items: {
            type: "object",
            properties: {
              area: { type: "string", maxLength: 80 },
              evidence: { type: "string", maxLength: 240 },
            },
            required: ["area", "evidence"],
          },
          maxItems: 5,
        },
        fix_first_evidence: { type: "string", maxLength: 240 },
        brief_adherence_evidence: {
          type: "object",
          properties: {
            material_compliance: { type: "string", maxLength: 240 },
            technical_compliance: { type: "string", maxLength: 240 },
            instruction_precision: { type: "string", maxLength: 240 },
            professionalism_signals: { type: "string", maxLength: 240 },
            score_material: { type: "integer", minimum: 0, maximum: 100 },
            score_technical: { type: "integer", minimum: 0, maximum: 100 },
            score_instruction: { type: "integer", minimum: 0, maximum: 100 },
            score_professional: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: [
            "material_compliance",
            "technical_compliance",
            "instruction_precision",
            "professionalism_signals",
            "score_material",
            "score_technical",
            "score_instruction",
            "score_professional",
          ],
        },
        category_notes_evidence: {
          type: "object",
          properties: {
            technical: { type: "string", maxLength: 240 },
            audio: { type: "string", maxLength: 240 },
            vocal: { type: "string", maxLength: 240 },
            acting: { type: "string", maxLength: 240 },
            brief_adherence: { type: "string", maxLength: 240 },
            professional_presentation: { type: "string", maxLength: 240 },
          },
          required: [
            "technical",
            "audio",
            "acting",
            "brief_adherence",
            "professional_presentation",
          ],
        },
        role_fit_evidence: { type: "string", maxLength: 240 },
        role_fit_modifier_suggested: {
          type: "integer",
          minimum: -10,
          maximum: 5,
        },
        role_fit_confidence: { type: "string", enum: ["low", "medium", "high"] },
        presentation_evidence: {
          type: "array",
          description:
            "Camera-readability observations only (framing, contrast, focus). Most technically useful first. NEVER personal.",
          items: { type: "string", maxLength: 200 },
          maxItems: 6,
        },
        risk_evidence: {
          type: "array",
          description:
            "Concrete, observation-grounded risks. Highest severity first.",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              flag: { type: "string", maxLength: 160 },
              why: { type: "string", maxLength: 200 },
              recall_impact: {
                type: "string",
                enum: [
                  "unlikely_to_affect",
                  "may_reduce",
                  "likely_to_block",
                ],
              },
            },
            required: ["severity", "flag", "why", "recall_impact"],
          },
          maxItems: 8,
        },
        timestamped_evidence: {
          type: "array",
          description:
            "Noteworthy moments in CHRONOLOGICAL order, MM:SS within the tape duration. Target counts by duration when the tape is assessable: <60s -> 3-4; 1-3 min -> 5-7; 3-5 min -> 7-8 (minimum 5); never exceed 8. For 3-5 minute multi-component tapes (e.g. acting scene + song) you MUST cover BOTH components: aim for 2-3 from the acting scene, 2-3 from the song, 1 from the transition where one exists, and at least 1 improvement/fix-first moment. Returning only 2-3 items for a 4-minute multi-component tape is under-production and not acceptable unless evidence_sufficiency explicitly explains why. observation = what happened. why_it_matters = why this is useful for the performer. linked_category = one of: technical, audio, vocal, acting, brief_adherence, professional_presentation. Never invent timestamps. Never pad weak observations.",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "MM:SS" },
              observation: { type: "string", maxLength: 220 },
              why_it_matters: { type: "string", maxLength: 220 },
              linked_category: {
                type: "string",
                enum: [
                  "technical",
                  "audio",
                  "vocal",
                  "acting",
                  "brief_adherence",
                  "professional_presentation",
                ],
              },
            },
            required: [
              "timestamp",
              "observation",
              "why_it_matters",
              "linked_category",
            ],
          },
          maxItems: 8,
        },
        evidence_sufficiency: {
          type: "object",
          properties: {
            audio_assessable: { type: "boolean" },
            video_assessable: { type: "boolean" },
            acting_assessable: { type: "boolean" },
            vocal_assessable: { type: "boolean" },
            movement_assessable: { type: "boolean" },
            brief_assessable: { type: "boolean" },
            role_fit_assessable: { type: "boolean" },
            notes: { type: "string", maxLength: 240 },
          },
          required: [
            "audio_assessable",
            "video_assessable",
            "acting_assessable",
            "vocal_assessable",
            "movement_assessable",
            "brief_assessable",
            "role_fit_assessable",
            "notes",
          ],
        },
      },
      required: [
        "evidence_version",
        "audition_type",
        "detected_components",
        "raw_scores",
        "core_strengths_evidence",
        "core_improvements_evidence",
        "fix_first_evidence",
        "brief_adherence_evidence",
        "category_notes_evidence",
        "role_fit_evidence",
        "role_fit_modifier_suggested",
        "role_fit_confidence",
        "presentation_evidence",
        "risk_evidence",
        "timestamped_evidence",
        "evidence_sufficiency",
      ],
    },
  },
};

const EVIDENCE_SYSTEM_PROMPT = `You are an evidence collector for a self-tape audition. Your ONLY job is to return factual observations and per-category scores. Do NOT write prose feedback, recommendations, or coaching. Do NOT polish.

Rules:
- Observations must be directly visible or audible in the tape. No interpretation, no advice.
- Use British English in any free text.
- Timestamps must be MM:SS, within the tape's actual duration. Maximum 8.
- Order timestamped_evidence in CHRONOLOGICAL order. Spread evidence across the full tape, not only the opening minute. For hybrid tapes, cover each main component where possible.
- ACTIVELY SCAN THE FULL TAPE: do not stop after the opening minute. For tapes 3 minutes or longer, you MUST sample evidence from the beginning, the middle, and the end of the tape. For multi-component tapes (e.g. acting scene + song), you MUST include moments from EACH main component, plus at least one observation from the transition between components when one exists. Mix strengths and improvements — do not return only weaknesses or only praise.
- Timestamp count target by tape duration (do not invent or pad — if fewer genuine moments exist, return fewer):
  * under 60 seconds: 3–4 useful moments
  * 1–3 minutes: 5–7 useful moments
  * 3–5 minutes: target 7–8 useful moments. Minimum 5 when the tape is assessable. You MUST cover beginning, middle and end, AND each major component (e.g. acting scene, song, transition, slate, notable audio/technical moments). Do not stop at 2–3 timestamps for a 4-minute multi-component tape — that is under-production.
  * absolute maximum: 8
- NEVER reference page numbers, line numbers, "page X", "line X", "script page", "book page", "the side", "the sides", "in the script", or "in the book". The system has no page/line/sides metadata. Use timestamps or neutral moment descriptions only ("during the longer speech", "around 02:14", "before the reader's line", "in the scene section").
- Visual presentation evidence (presentation_evidence) may name a clothing colour ONLY when the colour is clearly visible and the colour itself is the observation that matters (e.g. low contrast against the background). When colour is not essential, use colour-neutral wording such as "the performer separates clearly from the background" or "the framing is clean and easy to read". Never guess at colour.
- Order core_strengths_evidence with the strongest / most submission-relevant first.
- Order core_improvements_evidence with the highest-impact fix first.
- Order risk_evidence with highest severity first.
- Order presentation_evidence with the most technically useful first.
- Score categories on the same 0–100 scale as the final report.
- For BASELINE (no brief), still score brief_adherence as a professional-standards equivalent.
- Use null for vocal when there is no singing.
- Keep observation/why_it_matters short, concrete, and DIFFERENT from each other. If they would say the same thing, merge into one useful note.
- Never invent timestamps. Never pad. If fewer genuine moments exist, return fewer.
- Never comment on appearance, body, age, race, class, disability, mobility aids, medical devices, or socioeconomic status. If something affects assessability, comment only on the technical outcome (e.g. "the frame cuts off part of the movement").
- evidence_sufficiency must reflect what is actually assessable from the tape:
  * audio_assessable=false if audio is too poor to judge vocal/diction reliably
  * video_assessable=false if framing/lighting/focus prevents reliable visual judgement
  * vocal_assessable=false if there is no singing OR audio is not assessable
  * movement_assessable=false if framing crops the movement
  * brief_assessable=false if no brief was provided OR brief is too vague
  * role_fit_assessable=false if brief lacks role function/tone OR no brief
- evidence_version MUST be "1".

Return ONLY via the collect_audition_evidence tool.`;

export type EvidencePass = {
  evidence_version: "1";
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
  core_strengths_evidence: Array<{ area: string; evidence: string }>;
  core_improvements_evidence: Array<{ area: string; evidence: string }>;
  fix_first_evidence: string;
  brief_adherence_evidence: {
    material_compliance: string;
    technical_compliance: string;
    instruction_precision: string;
    professionalism_signals: string;
    score_material: number;
    score_technical: number;
    score_instruction: number;
    score_professional: number;
  };
  category_notes_evidence: {
    technical: string;
    audio: string;
    vocal: string;
    acting: string;
    brief_adherence: string;
    professional_presentation: string;
  };
  role_fit_evidence: string;
  role_fit_modifier_suggested: number;
  role_fit_confidence: "low" | "medium" | "high";
  presentation_evidence: string[];
  risk_evidence: Array<{
    severity: "low" | "medium" | "high";
    flag: string;
    why: string;
    recall_impact: "unlikely_to_affect" | "may_reduce" | "likely_to_block";
  }>;
  timestamped_evidence: Array<{
    timestamp: string;
    observation: string;
    why_it_matters: string;
    linked_category: string;
  }>;
  evidence_sufficiency: {
    audio_assessable: boolean;
    video_assessable: boolean;
    acting_assessable: boolean;
    vocal_assessable: boolean;
    movement_assessable: boolean;
    brief_assessable: boolean;
    role_fit_assessable: boolean;
    notes: string;
  };
};

const TS_RE = /^([0-5]?\d):([0-5]\d)$/;

export function isValidTimestamp(
  ts: string,
  durationSeconds?: number | null,
): boolean {
  if (typeof ts !== "string") return false;
  const m = TS_RE.exec(ts);
  if (!m) return false;
  if (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  ) {
    const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if (total > Math.ceil(durationSeconds) + 1) return false;
  }
  return true;
}

function tsToSeconds(ts: string): number {
  const m = TS_RE.exec(ts);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Severity ordering for stable risk_evidence sorting. */
const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type RunEvidencePassArgs = {
  videoUrl: string;
  apiKey: string;
  model?: string;
  signal: AbortSignal;
  contextText: string;
  durationSeconds?: number | null;
};

export type RunEvidencePassResult =
  | {
      ok: true;
      evidence: EvidencePass;
      timestamps_dropped: number;
      durationMs: number;
      model: string;
      httpStatus: number;
    }
  | {
      ok: false;
      httpStatus: number | null;
      error: string;
      durationMs: number;
      model: string;
    };

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
        max_tokens: 6144,
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

  // Defensive normalisation. Validate, drop bad timestamps, enforce ordering.
  const ev = parsed as EvidencePass;
  ev.evidence_version = "1";

  if (!Array.isArray(ev.timestamped_evidence)) ev.timestamped_evidence = [];
  const beforeTsCount = ev.timestamped_evidence.length;
  ev.timestamped_evidence = ev.timestamped_evidence
    .filter(
      (t) =>
        t &&
        typeof t.timestamp === "string" &&
        typeof t.observation === "string" &&
        typeof t.why_it_matters === "string" &&
        t.observation.trim().length > 0 &&
        t.why_it_matters.trim().length > 0,
    )
    .filter((t) => isValidTimestamp(t.timestamp, args.durationSeconds))
    .sort((a, b) => tsToSeconds(a.timestamp) - tsToSeconds(b.timestamp))
    .slice(0, 8);
  const timestamps_dropped = Math.max(
    0,
    beforeTsCount - ev.timestamped_evidence.length,
  );

  if (!Array.isArray(ev.core_strengths_evidence))
    ev.core_strengths_evidence = [];
  if (!Array.isArray(ev.core_improvements_evidence))
    ev.core_improvements_evidence = [];
  if (!Array.isArray(ev.presentation_evidence)) ev.presentation_evidence = [];
  if (!Array.isArray(ev.risk_evidence)) ev.risk_evidence = [];
  // Severity ordering.
  ev.risk_evidence.sort(
    (a, b) =>
      (SEVERITY_ORDER[a?.severity ?? "low"] ?? 2) -
      (SEVERITY_ORDER[b?.severity ?? "low"] ?? 2),
  );
  if (!Array.isArray(ev.detected_components)) ev.detected_components = [];

  // Sufficiency must exist.
  if (!ev.evidence_sufficiency || typeof ev.evidence_sufficiency !== "object") {
    ev.evidence_sufficiency = {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: true,
      movement_assessable: true,
      brief_assessable: true,
      role_fit_assessable: true,
      notes: "",
    };
  }

  // Brief adherence evidence must exist.
  if (
    !ev.brief_adherence_evidence ||
    typeof ev.brief_adherence_evidence !== "object"
  ) {
    const ba = ev.raw_scores?.brief_adherence ?? 0;
    ev.brief_adherence_evidence = {
      material_compliance: "",
      technical_compliance: "",
      instruction_precision: "",
      professionalism_signals: "",
      score_material: ba,
      score_technical: ba,
      score_instruction: ba,
      score_professional: ba,
    };
  }

  if (
    !ev.category_notes_evidence ||
    typeof ev.category_notes_evidence !== "object"
  ) {
    ev.category_notes_evidence = {
      technical: "",
      audio: "",
      vocal: "",
      acting: "",
      brief_adherence: "",
      professional_presentation: "",
    };
  }

  return {
    ok: true,
    evidence: ev,
    timestamps_dropped,
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
    timestamped_evidence_count: ev.timestamped_evidence.length,
    evidence_sufficiency: {
      audio_assessable: !!ev.evidence_sufficiency?.audio_assessable,
      video_assessable: !!ev.evidence_sufficiency?.video_assessable,
      acting_assessable: !!ev.evidence_sufficiency?.acting_assessable,
      vocal_assessable: !!ev.evidence_sufficiency?.vocal_assessable,
      movement_assessable: !!ev.evidence_sufficiency?.movement_assessable,
      brief_assessable: !!ev.evidence_sufficiency?.brief_assessable,
      role_fit_assessable: !!ev.evidence_sufficiency?.role_fit_assessable,
    },
  };
}
