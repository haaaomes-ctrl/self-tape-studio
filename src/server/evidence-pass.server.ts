// SERVER-ONLY. Step 1 of the two-step analysis pipeline.
//
// Multimodal "evidence" pass. Watches the tape and returns a structured,
// observation-only evidence object: per-category raw scores, core
// strengths/improvements anchored in evidence, brief-adherence sub-evidence,
// risk evidence, presentation evidence, role-fit evidence, sufficiency, and
// duration-scaled validated MM:SS timestamped moments (technical max 36).
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
          maxItems: 12,
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
          maxItems: 15,
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
          maxItems: 8,
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
          maxItems: 10,
        },
        timestamped_evidence: {
          type: "array",
          description:
            "Noteworthy moments in CHRONOLOGICAL order, MM:SS within the tape duration. Duration-scaled targets when the tape is assessable: <60s -> 3-5; 1-3 min -> 6-10; 3-5 min -> 8-14; 5-10 min -> 12-24; 10+ min -> 18-36. Absolute technical maximum 36. For multi-component tapes (e.g. acting scene + song) you MUST cover EACH main component plus the transition where one exists, plus at least 1 improvement/fix moment. For Dance: cover rhythm/timing, control/coordination, transitions/pathway, dynamics, performance presence, and at least 1 improvement moment. For MT: cover acting scene, song, scene-to-song transition, acting-through-song, vocal technique in service of story/style, and at least 1 improvement/fix moment. Returning only 2-3 items for a 4-minute multi-component tape is under-production. observation = what happened. why_it_matters = why this is useful for the performer. linked_category = one of: technical, audio, vocal, acting, brief_adherence, professional_presentation. Never invent timestamps. Never pad weak observations.",
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
          maxItems: 36,
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
- Timestamps must be MM:SS, within the tape's actual duration. Absolute technical maximum 36.
- Order timestamped_evidence in CHRONOLOGICAL order. Spread evidence across the full tape, not only the opening minute. For hybrid tapes, cover each main component where possible.
- ACTIVELY SCAN THE FULL TAPE: do not stop after the opening minute. For tapes 3 minutes or longer, you MUST sample evidence from the beginning, the middle, and the end of the tape. For multi-component tapes (e.g. acting scene + song), you MUST include moments from EACH main component, plus at least one observation from the transition between components when one exists. Mix strengths and improvements — do not return only weaknesses or only praise.
- Timestamp count target by tape duration (do not invent or pad — if fewer genuine moments exist, return fewer):
  * under 60 seconds: 3–5 useful moments
  * 1–3 minutes: 6–10 useful moments
  * 3–5 minutes: 8–14 useful moments. You MUST cover beginning, middle and end, AND each major component (e.g. acting scene, song, transition, slate, notable audio/technical moments). Returning only 2–3 timestamps for a 4-minute multi-component tape is UNDER-PRODUCTION and not acceptable unless evidence_sufficiency.audio_assessable, video_assessable, or acting_assessable is false.
  * 5–10 minutes: 12–24 useful moments
  * 10+ minutes: 18–36 useful moments
  * absolute technical maximum: 36
- For DANCE: cover rhythm/timing, control/coordination, transitions/pathway, dynamics/attack/release, performance presence, and at least 1 improvement moment. Do not invent style/subtype confidence; if style is not supplied, note that and assess from observable movement only.
- For MUSICAL THEATRE: cover acting scene, song, scene-to-song transition, acting-through-song, vocal technique in service of story/style, and at least 1 improvement/fix moment.
- Before returning, self-check: if the tape is 3+ minutes, multi-component, and assessable, and you have under-produced for the duration band, re-scan the tape and add the missing moments before returning.
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
  /**
   * Phase 1 (internal). When true, Step 1 additionally requests
   * observation-only discipline dimensions and validates them. This data is
   * NEVER returned in `evidence` and NEVER written to public report JSON;
   * it surfaces only via the `futureDimensions` sibling on the result for
   * internal logging. Default: false.
   */
  withFutureDimensions?: boolean;
};

export type RunEvidencePassResult =
  | {
      ok: true;
      evidence: EvidencePass;
      timestamps_dropped: number;
      durationMs: number;
      model: string;
      httpStatus: number;
      futureDimensions?: import("./dimensions").FutureDimensionsResult;
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
  const withDims = !!args.withFutureDimensions;

  // Phase 1 — flag-gated additive prompt + schema. Lazy-imported to keep the
  // legacy code path byte-identical when the flag is off.
  let systemPrompt = EVIDENCE_SYSTEM_PROMPT;
  let toolForCall: typeof EVIDENCE_TOOL = EVIDENCE_TOOL;
  if (withDims) {
    const dims = await import("./dimensions");
    systemPrompt = `${EVIDENCE_SYSTEM_PROMPT}\n\n${dims.buildDimensionsPromptFragment()}`;
    // Clone the tool and add an OPTIONAL future_components array. Existing
    // required fields are not touched.
    const cloned = JSON.parse(JSON.stringify(EVIDENCE_TOOL)) as typeof EVIDENCE_TOOL;
    (cloned.function.parameters.properties as Record<string, unknown>)[
      "future_components"
    ] = dims.FUTURE_COMPONENTS_SCHEMA;
    toolForCall = cloned;
  }

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
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: args.contextText },
              { type: "file_url", file_url: { url: args.videoUrl } },
            ],
          },
        ],
        tools: [toolForCall],
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
    .slice(0, 36);
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

  // Phase 1 — extract & validate optional internal future_components, then
  // delete from `ev` so they NEVER enter the locked Step-1 evidence object
  // consumed by Step 2 / report rendering.
  let futureDimensions: import("./dimensions").FutureDimensionsResult | undefined;
  if (withDims) {
    const rawFuture = (ev as unknown as Record<string, unknown>).future_components;
    delete (ev as unknown as Record<string, unknown>).future_components;
    try {
      const dims = await import("./dimensions");
      futureDimensions = dims.validateFutureComponents(
        rawFuture,
        args.durationSeconds,
      );
    } catch (err) {
      console.warn("[evidence] future_dimensions_dropped", {
        reason: err instanceof Error ? err.message : "validate_error",
      });
      futureDimensions = { components: [], dropped: 0, malformed: true };
    }
  } else {
    // Belt-and-braces: if the model emits the field unsolicited, strip it.
    delete (ev as unknown as Record<string, unknown>).future_components;
  }

  return {
    ok: true,
    evidence: ev,
    timestamps_dropped,
    durationMs: Date.now() - startedAt,
    model,
    httpStatus: resp.status,
    ...(futureDimensions ? { futureDimensions } : {}),
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

type Step1EvidenceFamily = "video" | "audio" | "material" | "performance" | "candidate_technique";

export type FilteredStep1EvidenceItem = {
  evidence_item_id: string;
  evidence_family: Step1EvidenceFamily;
  evidence_modality: "video" | "audio" | "material" | "submission_context" | "resolver_truth" | "media_readiness" | "unknown";
  evidence_kind: string;
  safe_evidence_summary: string;
  source_artefact_id: "run_evidence_pass";
  source_path: string;
  timestamp: string | null;
  timestamp_range: null;
  timestamp_source: string;
  component_id: string | null;
  linked_truth_state_ids: string[];
  assessability_limitations: string[];
  confidence_or_strength: string | null;
  public_display_status: "internal_only";
  blocker_codes: string[];
};

export type FilteredRunEvidencePassStep1 = {
  schema_version: "tapecoach_v3_filtered_run_evidence_pass_step1_v1";
  extractor_source: "runEvidencePass";
  extractor_model_ref: string | null;
  extraction_status: "partial" | "blocked";
  evidence_family_coverage: {
    video: boolean;
    audio: boolean;
    material: boolean;
    performance: boolean;
    candidate_technique: boolean;
  };
  evidence_family_status_by_id: Record<Step1EvidenceFamily, "partial" | "not_extracted" | "blocked">;
  video_observable_evidence_items: FilteredStep1EvidenceItem[];
  audio_observable_evidence_items: FilteredStep1EvidenceItem[];
  material_observable_evidence_items: FilteredStep1EvidenceItem[];
  performance_observable_evidence_items: FilteredStep1EvidenceItem[];
  candidate_technique_evidence: FilteredStep1EvidenceItem[];
  observable_evidence_items: FilteredStep1EvidenceItem[];
  unsupported_or_unavailable_evidence: Array<{
    evidence_kind: string;
    status: "not_extracted" | "blocked";
    reason: string;
    blocker_codes: string[];
  }>;
  rejected_or_filtered_fields: string[];
  prohibited_field_filter_summary: {
    rejected_field_count: number;
    rejected_field_keys: string[];
    raw_values_persisted: false;
  };
  assessability_limitations: string[];
  blocker_codes: string[];
};

const ALWAYS_FILTERED_STEP1_FIELDS = [
  "detected_components[].score",
  "raw_scores",
  "brief_adherence_evidence.score_material",
  "brief_adherence_evidence.score_technical",
  "brief_adherence_evidence.score_instruction",
  "brief_adherence_evidence.score_professional",
  "core_strengths_evidence",
  "core_improvements_evidence",
  "fix_first_evidence",
  "category_notes_evidence",
  "role_fit_evidence",
  "role_fit_modifier_suggested",
  "role_fit_confidence",
  "risk_evidence",
] as const;

const PROHIBITED_STEP1_TOP_LEVEL_FIELDS = [
  "overall_score",
  "score",
  "score_breakdown",
  "readiness_score",
  "readiness",
  "verdict",
  "submission_verdict",
  "submit_recommendation",
  "retake_recommendation",
  "role_fit",
  "role_fit_notes",
  "casting_fit",
  "casting_headline",
  "casting_insight",
  "market_fit",
  "marketability",
  "bookability",
  "castability",
  "comparison_winner",
  "comparison_recommendation",
  "fix_first",
  "priority_fixes",
  "next_take",
  "next_take_plan",
  "report_prose",
] as const;

const PROHIBITED_STEP1_TEXT_RE =
  /\b(overall score|readiness|ready to submit|not ready|retake|re-take|submit|bookability|marketability|castability|casting fit|role fit|perfect match|winner|recommend|fix first|priority fix|next take|technique authority|diagnosis)\b/i;

const UNSAFE_STEP1_TEXT_RE = /\bhttps?:\/\/|token|secret|signed url|signature=|mux_token\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addRejected(target: Set<string>, key: string) {
  if (key.trim()) target.add(key.trim());
}

function safeStep1Text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (UNSAFE_STEP1_TEXT_RE.test(text)) return null;
  if (PROHIBITED_STEP1_TEXT_RE.test(text)) return null;
  return text.slice(0, 280);
}

function familyForLinkedCategory(category: unknown): Step1EvidenceFamily {
  switch (String(category ?? "").toLowerCase()) {
    case "technical":
    case "professional_presentation":
      return "video";
    case "audio":
      return "audio";
    case "brief_adherence":
      return "material";
    case "acting":
    case "vocal":
      return "performance";
    default:
      return "performance";
  }
}

function normaliseDeclaredStep1Modality(value: unknown): FilteredStep1EvidenceItem["evidence_modality"] | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return null;
  if (raw === "video" || raw === "visual" || raw === "movement") return "video";
  if (raw === "audio" || raw === "vocal" || raw === "voice") return "audio";
  if (raw === "material" || raw === "brief" || raw === "brief_adherence") return "material";
  if (raw === "submission_context" || raw === "resolver_truth" || raw === "media_readiness" || raw === "unknown") return raw;
  return null;
}

function modalityForFamily(
  family: Step1EvidenceFamily,
  declaredModality?: unknown,
  sourceContext?: unknown,
): FilteredStep1EvidenceItem["evidence_modality"] {
  const declared = normaliseDeclaredStep1Modality(declaredModality);
  if (declared) return declared;
  if (family === "video" || family === "audio" || family === "material") return family;
  if (family === "performance") {
    const context = typeof sourceContext === "string" ? sourceContext.toLowerCase() : "";
    if (/\b(audio|vocal|voice|song|singing)\b/.test(context)) return "audio";
    if (/\b(video|visual|movement|dance|physical)\b/.test(context)) return "video";
  }
  return "unknown";
}

export function filterRunEvidencePassForStep1(
  input: unknown,
  options: { model?: string | null; durationSeconds?: number | null } = {},
): FilteredRunEvidencePassStep1 {
  const rejected = new Set<string>();
  for (const field of ALWAYS_FILTERED_STEP1_FIELDS) addRejected(rejected, field);

  if (!isRecord(input)) {
    addRejected(rejected, "runEvidencePass.malformed_output");
    return buildFilteredStep1Result({
      model: options.model ?? null,
      rejected,
      video: [],
      audio: [],
      material: [],
      performance: [],
      technique: [],
      malformed: true,
    });
  }

  for (const field of PROHIBITED_STEP1_TOP_LEVEL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) addRejected(rejected, field);
  }

  const video: FilteredStep1EvidenceItem[] = [];
  const audio: FilteredStep1EvidenceItem[] = [];
  const material: FilteredStep1EvidenceItem[] = [];
  const performance: FilteredStep1EvidenceItem[] = [];
  const technique: FilteredStep1EvidenceItem[] = [];

  const addItem = (
    family: Step1EvidenceFamily,
    sourcePath: string,
    evidenceKind: string,
    summary: string,
    timestamp: string | null = null,
    limitations: string[] = [],
    declaredModality?: unknown,
    sourceContext?: unknown,
  ) => {
    const target =
      family === "video"
        ? video
        : family === "audio"
          ? audio
          : family === "material"
            ? material
            : family === "candidate_technique"
              ? technique
              : performance;
    const evidenceModality = modalityForFamily(family, declaredModality, sourceContext);
    const item: FilteredStep1EvidenceItem = {
      evidence_item_id: `step1-${family}-${String(target.length + 1).padStart(4, "0")}`,
      evidence_family: family,
      evidence_modality: evidenceModality,
      evidence_kind: evidenceKind,
      safe_evidence_summary: summary,
      source_artefact_id: "run_evidence_pass",
      source_path: sourcePath,
      timestamp,
      timestamp_range: null,
      timestamp_source: timestamp ? "runEvidencePass_validated_timestamp" : "not_timestamped_observation",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: [
        ...limitations,
        ...(family === "performance" && evidenceModality === "unknown" ? ["performance_modality_unavailable"] : []),
      ],
      confidence_or_strength: "runEvidencePass_observation",
      public_display_status: "internal_only",
      blocker_codes: [],
    };
    target.push(item);
  };

  const timestamped = Array.isArray(input.timestamped_evidence) ? input.timestamped_evidence : [];
  timestamped.forEach((entry, index) => {
    if (!isRecord(entry)) {
      addRejected(rejected, `timestamped_evidence[${index}]`);
      return;
    }
    const observation = safeStep1Text(entry.observation);
    const timestamp = typeof entry.timestamp === "string" && isValidTimestamp(entry.timestamp, options.durationSeconds)
      ? entry.timestamp
      : null;
    if (!observation) {
      addRejected(rejected, `timestamped_evidence[${index}].observation`);
      return;
    }
    if (!timestamp && typeof entry.timestamp === "string") addRejected(rejected, `timestamped_evidence[${index}].timestamp`);
    const family = familyForLinkedCategory(entry.linked_category);
    addItem(
      family,
      `timestamped_evidence[${index}].observation`,
      `${family}_observable_event`,
      observation,
      timestamp,
      timestamp ? [] : ["timestamp_unavailable_or_invalid"],
      entry.evidence_modality ?? entry.modality,
      entry.linked_category,
    );
  });

  const presentation = Array.isArray(input.presentation_evidence) ? input.presentation_evidence : [];
  presentation.forEach((entry, index) => {
    const text = safeStep1Text(entry);
    if (!text) {
      addRejected(rejected, `presentation_evidence[${index}]`);
      return;
    }
    addItem("video", `presentation_evidence[${index}]`, "video_presentation_observation", text);
  });

  const sufficiency = isRecord(input.evidence_sufficiency) ? input.evidence_sufficiency : null;
  if (sufficiency) {
    const notes = safeStep1Text(sufficiency.notes);
    if (sufficiency.video_assessable === false) {
      addItem("video", "evidence_sufficiency.video_assessable", "video_assessability_limitation", notes ?? "Video assessability limitation recorded", null, ["video_not_fully_assessable"]);
    }
    if (sufficiency.audio_assessable === false) {
      addItem("audio", "evidence_sufficiency.audio_assessable", "audio_assessability_limitation", notes ?? "Audio assessability limitation recorded", null, ["audio_not_fully_assessable"]);
    }
    if (sufficiency.movement_assessable === false) {
      addItem("video", "evidence_sufficiency.movement_assessable", "movement_visibility_limitation", notes ?? "Movement assessability limitation recorded", null, ["movement_not_fully_assessable"]);
    }
  }

  const candidateTechnique = Array.isArray(input.candidate_technique_evidence)
    ? input.candidate_technique_evidence
    : [];
  candidateTechnique.forEach((entry, index) => {
    const rawText = isRecord(entry)
      ? (entry.safe_evidence_summary ?? entry.evidence ?? entry.label)
      : entry;
    const text = safeStep1Text(rawText);
    const hasUnsafeAuthority = isRecord(entry) && (
      typeof entry.score === "number"
      || entry.authoritative === true
      || PROHIBITED_STEP1_TEXT_RE.test(String(entry.diagnosis ?? ""))
    );
    if (!text || hasUnsafeAuthority) {
      addRejected(rejected, `candidate_technique_evidence[${index}]`);
      return;
    }
    addItem(
      "candidate_technique",
      `candidate_technique_evidence[${index}]`,
      "candidate_technique_observation",
      text,
      null,
      [],
      isRecord(entry) ? (entry.evidence_modality ?? entry.modality) : null,
    );
  });

  return buildFilteredStep1Result({
    model: options.model ?? null,
    rejected,
    video,
    audio,
    material,
    performance,
    technique,
    malformed: false,
  });
}

function buildFilteredStep1Result(args: {
  model: string | null;
  rejected: Set<string>;
  video: FilteredStep1EvidenceItem[];
  audio: FilteredStep1EvidenceItem[];
  material: FilteredStep1EvidenceItem[];
  performance: FilteredStep1EvidenceItem[];
  technique: FilteredStep1EvidenceItem[];
  malformed: boolean;
}): FilteredRunEvidencePassStep1 {
  const evidence_family_coverage = {
    video: args.video.length > 0,
    audio: args.audio.length > 0,
    material: args.material.length > 0,
    performance: args.performance.length > 0,
    candidate_technique: args.technique.length > 0,
  };
  const familyStatus = (present: boolean): "partial" | "not_extracted" | "blocked" =>
    args.malformed ? "blocked" : (present ? "partial" : "not_extracted");
  const evidence_family_status_by_id: Record<Step1EvidenceFamily, "partial" | "not_extracted" | "blocked"> = {
    video: familyStatus(evidence_family_coverage.video),
    audio: familyStatus(evidence_family_coverage.audio),
    material: familyStatus(evidence_family_coverage.material),
    performance: familyStatus(evidence_family_coverage.performance),
    candidate_technique: familyStatus(evidence_family_coverage.candidate_technique),
  };
  const unsupported_or_unavailable_evidence = (Object.entries(evidence_family_status_by_id) as Array<[Step1EvidenceFamily, "partial" | "not_extracted" | "blocked"]>)
    .filter(([, status]) => status !== "partial")
    .map(([family, status]) => ({
      evidence_kind: `${family}_observable_evidence_${status}`,
      status: status as "not_extracted" | "blocked",
      reason: status === "blocked"
        ? "runEvidencePass output was malformed or unsafe for this evidence family"
        : `${family} observable evidence was not extracted from runEvidencePass`,
      blocker_codes: [`${family}_observable_evidence_${status}`],
    }));
  const rejectedKeys = [...args.rejected].sort();
  const blocker_codes = [
    ...(args.malformed ? ["runEvidencePass_malformed_output"] : []),
    ...unsupported_or_unavailable_evidence.flatMap((item) => item.blocker_codes),
    ...(rejectedKeys.length > 0 ? ["runEvidencePass_prohibited_fields_filtered"] : []),
  ];
  return {
    schema_version: "tapecoach_v3_filtered_run_evidence_pass_step1_v1",
    extractor_source: "runEvidencePass",
    extractor_model_ref: args.model,
    extraction_status: args.malformed ? "blocked" : "partial",
    evidence_family_coverage,
    evidence_family_status_by_id,
    video_observable_evidence_items: args.video,
    audio_observable_evidence_items: args.audio,
    material_observable_evidence_items: args.material,
    performance_observable_evidence_items: args.performance,
    candidate_technique_evidence: args.technique,
    observable_evidence_items: [...args.video, ...args.audio, ...args.material, ...args.performance],
    unsupported_or_unavailable_evidence,
    rejected_or_filtered_fields: rejectedKeys,
    prohibited_field_filter_summary: {
      rejected_field_count: rejectedKeys.length,
      rejected_field_keys: rejectedKeys,
      raw_values_persisted: false,
    },
    assessability_limitations: unsupported_or_unavailable_evidence.map((item) => item.evidence_kind),
    blocker_codes,
  };
}
