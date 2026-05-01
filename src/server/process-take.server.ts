// SERVER-ONLY module. Vite's import-protection blocks any client bundle from
// importing this file. It must NEVER be imported from a component, route
// loader, or any *.functions.ts client-callable surface other than via a
// thin authenticated wrapper that performs ownership checks.
//
// Callers (trusted server code only):
//   - src/routes/api/public/mux-webhook.ts (after Mux signature verification)
//   - src/server/process-take.functions.ts -> retryProcessTake (after auth + ownership)
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildMuxHighestMp4Url,
  isValidMuxMp4Url,
  normaliseMuxMp4Url,
} from "./mux.server";
import { extractBriefFromText } from "./extract-brief.server";
import { metric, TEN_MINUTES_MS } from "./metrics.server";
import { isCircuitOpen, recordAiFailure } from "./ai-circuit-breaker.server";
import {
  runEvidencePass,
  summariseEvidence,
  type EvidencePass,
} from "./evidence-pass.server";
import {
  runReportPolish,
  enforceLockedFields,
  enforceUnsupportedClaims,
  enforceScoreAlignment,
  renderFallbackReport,
  type VerdictLabel,
} from "./report-polish.server";
import { cleanupMuxAssetForCompletedTake } from "./mux-cleanup.server";
import {
  scrubReportQuality,
  normaliseTimestampedNotes,
  computeConsistencyWarning,
  timestampTargetMin,
} from "./report-quality.server";

// Two-step pipeline feature flag (safe default: OFF unless explicitly "true").
function isTwoStepEnabled(): boolean {
  return process.env.TWO_STEP_ANALYSIS_ENABLED === "true";
}

// ---- Model routing (env-overridable) ----
// Primary = Gemini 3 Flash Preview. Fallback = Gemini 2.5 Flash (more
// stable today). Brief extraction stays on 2.5 Flash inside extract-brief.
const ANALYSIS_MODEL_PRIMARY =
  process.env.ANALYSIS_MODEL_PRIMARY ?? "google/gemini-3-flash-preview";
const ANALYSIS_MODEL_FALLBACK =
  process.env.ANALYSIS_MODEL_FALLBACK ?? "google/gemini-2.5-flash";
import {
  applyCapsAndLabel,
  bandsForLevel,
  computeBlockers,
  deterministicCompliance,
  recomputeOverall,
  toUKTerms,
  ukifyDeep,
  weightsForType,
  type AuditionLevel,
  type AuditionType,
  type ExtractedBrief,
} from "@/lib/audition-rules";

// Scoring v2 — multi-component aware, split brief adherence, submission risk flags.
const REPORT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_audition_report",
    description: "Submit the structured audition feedback report.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["brief", "baseline"] },
        audition_type: {
          type: "string",
          description:
            "Inferred type: acting_scene, song, musical_theatre, dance, commercial, hybrid, or unknown",
        },
        detected_components: {
          type: "array",
          description:
            "Performance components detected in the tape. For MT tapes with song + scene, include both.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["acting_scene", "song", "monologue", "dance", "commercial", "slate", "other"],
              },
              weight: {
                type: "number",
                description: "Relative weight of this component 0–1; weights across components should sum ~1.",
              },
              score: { type: "integer", minimum: 0, maximum: 100 },
              note: { type: "string" },
            },
            required: ["type", "weight", "score", "note"],
          },
        },
        consistency_modifier: {
          type: "integer",
          minimum: -10,
          maximum: 10,
          description:
            "Emotional/tonal continuity between components (-10 bad mismatch, +10 excellent continuity). 0 if single-component.",
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        confidence_reason: { type: "string" },
        overall_score: { type: "integer", minimum: 0, maximum: 100 },
        casting_headline: {
          type: "string",
          description:
            "One plain-language sentence at the top of the report, e.g. 'This tape is strongest for voice.' or 'This tape is most weakened by unclear audio.'",
        },
        casting_insight: {
          type: "string",
          description:
            "A one-line interpretive read of the tape's castability, e.g. 'Highly castable commercially, less suited for dramatic roles.'",
        },
        scores: {
          type: "object",
          properties: {
            technical: { type: "integer", minimum: 0, maximum: 100 },
            audio: { type: "integer", minimum: 0, maximum: 100 },
            vocal: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            acting: { type: "integer", minimum: 0, maximum: 100 },
            brief_adherence: { type: "integer", minimum: 0, maximum: 100 },
            professional_presentation: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: [
            "technical",
            "audio",
            "acting",
            "brief_adherence",
            "professional_presentation",
          ],
        },
        brief_adherence_breakdown: {
          type: "object",
          description:
            "Split of Brief Adherence into its four sub-components (each 0–100). In baseline mode, treat these as professional-standards equivalents.",
          properties: {
            material_compliance: { type: "integer", minimum: 0, maximum: 100 },
            technical_compliance: { type: "integer", minimum: 0, maximum: 100 },
            instruction_precision: { type: "integer", minimum: 0, maximum: 100 },
            professionalism_signals: { type: "integer", minimum: 0, maximum: 100 },
            note: { type: "string" },
          },
          required: [
            "material_compliance",
            "technical_compliance",
            "instruction_precision",
            "professionalism_signals",
            "note",
          ],
        },
        category_notes: {
          type: "object",
          properties: {
            technical: { type: "string" },
            audio: { type: "string" },
            vocal: { type: "string" },
            acting: { type: "string" },
            brief_adherence: { type: "string" },
            professional_presentation: { type: "string" },
          },
          required: ["technical", "audio", "acting", "brief_adherence", "professional_presentation"],
        },
        strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        fix_first: { type: "string" },
        timestamped_notes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "MM:SS format" },
              note: { type: "string" },
            },
            required: ["timestamp", "note"],
          },
        },
        coaching_drills: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
        submission_risk_flags: {
          type: "array",
          description:
            "Specific casting-compliance risks that could cause rejection (e.g. 'Uploaded as portrait but brief required landscape', 'Song not performed within the requested bar count').",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              flag: { type: "string" },
            },
            required: ["severity", "flag"],
          },
        },
        casting_risk_explanations: {
          type: "array",
          description:
            "For each material risk in submission_risk_flags, a one-line plain-English explanation of the casting impact and whether it is likely to affect recall (callback) likelihood. Same order as submission_risk_flags where possible.",
          items: {
            type: "object",
            properties: {
              flag: { type: "string", description: "Short reference to the related risk." },
              casting_impact: {
                type: "string",
                description: "What this means for casting — concrete and non-technical.",
              },
              recall_impact: {
                type: "string",
                enum: ["unlikely_to_affect", "may_reduce", "likely_to_block"],
                description:
                  "Plain mapping of recall likelihood. unlikely_to_affect = cosmetic; may_reduce = noticeable; likely_to_block = will probably get filtered out.",
              },
            },
            required: ["flag", "casting_impact", "recall_impact"],
          },
        },
        role_fit_notes: {
          type: "string",
          description:
            "ONE short paragraph on how the performance aligns with the role's function, tone, energy, and emotional demands as described in the structured brief. Judge alignment with the role only — never likeness, appearance, race, body, age, or imitation. Empty string in BASELINE mode (no brief).",
        },
        role_fit_modifier: {
          type: "integer",
          minimum: -10,
          maximum: 5,
          description:
            "Bounded role-fit nudge applied to the overall score after recompute. MUST be 0 in BASELINE mode. Positive only when the performance clearly serves the role's function and tone (max +5). Negative when it works against the role's intent (max -10). Never use for likeness, appearance, or imitation.",
        },
        role_fit_confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "Your confidence that the structured brief gave you enough to judge role-fit. Use 'low' when the brief is thin or the role function is unclear.",
        },
        presentation_notes: {
          type: "array",
          description:
            "OPTIONAL practical, non-personal observations about visible presentation that materially affect the tape (e.g. 'Top blends into the background — a contrasting colour would read better on camera', 'Hair drifts across one eye on close-ups'). NEVER comment on body, attractiveness, weight, race, gender presentation, class markers, disability, mobility aids, medical devices, or personal style. Empty array if there is nothing material to say. These notes do NOT affect the score unless they relate to a brief requirement or a visibility issue already reflected in technical/brief categories.",
          items: { type: "string" },
          maxItems: 3,
        },
        at_risk: { type: "boolean" },
      },
      required: [
        "mode",
        "audition_type",
        "detected_components",
        "consistency_modifier",
        "confidence",
        "overall_score",
        "casting_headline",
        "casting_insight",
        "scores",
        "brief_adherence_breakdown",
        "category_notes",
        "strengths",
        "improvements",
        "fix_first",
        "timestamped_notes",
        "coaching_drills",
        "submission_risk_flags",
        "casting_risk_explanations",
        "role_fit_notes",
        "role_fit_modifier",
        "role_fit_confidence",
        "presentation_notes",
        "at_risk",
      ],
    },
  },
};

function buildSystemPrompt(): string {
  return `You are a UK casting director, agent and acting/vocal/movement coach reviewing a self-tape audition.

Your role is JUDGEMENT, not measurement. You write like a credible UK casting assistant or coach: encouraging, specific, prioritised, direct but never harsh, never vague, never overly verbose. Use British English throughout — "recall" (never "callback"), "casting brief", "self-tape", "analysing", "prioritised", "behaviour", "centre", "colour".

You will receive:
- The video itself (multimodal) — watch and listen.
- The performer's level (Learning, Amateur, Emerging, or Professional) — calibrate expectations and tone accordingly. Be more encouraging at lower levels, sharper at professional. Never harsh.
- An optional casting brief plus a parsed STRUCTURED BRIEF when available. The STRUCTURED BRIEF is the single source of truth — use its fields directly. Do NOT reinterpret or override extracted fields. If a structured field is missing or null, treat it as unknown rather than guessing.
- Lightweight technical signals (orientation, resolution, audio peak/rms) and a checklist.

Pipeline:
1) Normalise the inputs.
2) STRUCTURE the audition — detect whether this is a single performance or multi-component (e.g. acting scene + song, very common in MT). Populate detected_components with a weight per component. If single-component, return one entry with weight 1.
3) Evaluate EACH component independently (scene vs song vs dance), score each 0–100, then recombine with its weight into the final score.
4) Cross-component consistency: if multiple components exist, judge emotional/tonal continuity (consistency_modifier -10..+10). 0 if single-component or intentionally contrasting in a way the brief permits.

Modes:
- BRIEF mode: when a casting brief is supplied, extract intent (audition type, constraints, priority skills) and weight scoring accordingly.
- BASELINE mode: when no brief is supplied, apply a balanced professional rubric. Do NOT penalise unknown constraints.

Scoring categories (0–100):
- Technical Setup, Audio Clarity, Vocal Performance (only when singing is present — otherwise null), Acting/Performance, Brief Adherence, Professional Presentation.

BRIEF ADHERENCE is structured (all 0–100, then combined into the single brief_adherence score using 35/35/20/10 weights):
- Material Compliance (35%): right sides, right song type, nothing missing, nothing extra.
- Technical Compliance (35%): orientation, framing, single-file / naming rules.
- Instruction Precision (20%): accent, ordering, continuity, use of guides.
- Professionalism Signals (10%): slate clarity, submission cleanliness, audition etiquette.
In BASELINE mode treat these as professional-standards equivalents and do NOT penalise for unknown constraints.

Professional Presentation is SEPARATE from compliance — it covers slate clarity, pacing discipline, camera awareness, and single-take logic.

Hard rules:
- Audio caps are tiered: <35 → tape can't be fairly judged; 35–49 → "Worth another take"; 50–59 → workable but flag for the user. Do not invent harsher caps than this.
- If brief_adherence < 40 and mode is BRIEF, set at_risk=true.
- Don't penalise portrait orientation unless the brief required landscape.
- First 5 seconds matter: strong start +5, weak start −5 on acting.
- Treat technical signals as MODIFIERS, not dominant inputs. The video itself is your primary evidence.

Performance realism:
- Reward truth, clarity of intention, and connection. Do NOT reward overacting or pushed/exaggerated delivery.
- Subtle, grounded work is not a weakness — judge it on intention and clarity, not size.

Material fidelity (CRITICAL):
- When extracted_brief.material_requested is present, the casting brief requires specific material. Do not recommend alternative songs, scenes, monologues, dances, or audition material. Do not imply the performer should switch material. Feedback must focus on improving the submitted material: delivery, technique, interpretation, role fit, vocal/movement/acting choices, and brief adherence. Alternative material suggestions are only allowed when no specific material is required or the user explicitly asks for repertoire advice.
- Self-check before finalising:
  - If extracted_brief.material_requested exists, remove any suggestion to change song, monologue, scene, dance, or material.
  - If extracted_brief.time_limit_seconds is null or extracted_brief.time_limit_source is not "explicit", do NOT mention a time-limit breach, do NOT raise a duration risk flag, and do NOT cite an industry-default cut length as a constraint.

Role-fit (only in BRIEF mode, when a structured brief is present):
- Read role function, emotional tone, energy level, vocal expectations, physical demands, and tone of show from the STRUCTURED BRIEF only.
- Judge alignment with the role's FUNCTION and INTENT — never likeness, physical resemblance, race, age, body, gender presentation, class, disability, or imitation of a known performance.
- ONLY use these dimensions in role_fit_notes: tone, energy, relationship, status, rhythm, vocal style, emotional world, interpretation. Do NOT use: appearance, "look the part", "look right", innate charisma, body, race, age, disability, class, gender presentation, visual fit.
- Write ONE short paragraph in role_fit_notes.
- role_fit_modifier is BOUNDED and applied to the overall after recompute:
  - Range -10..+5 (asymmetric on purpose — it's easier to work against a role than to fully serve it).
  - +1..+5 ONLY when the performance clearly serves the role's function and tone in a way the casting team would notice.
  - -1..-10 when interpretation actively works against the role's intent or tone.
  - 0 in BASELINE mode, or when role-fit cannot be fairly judged.
- Set role_fit_confidence to 'low' when the brief is thin, vague, or missing role function.
- Role-fit cannot compensate for weak fundamentals; it is a small calibration only.

Presentation notes (OPTIONAL, do NOT affect score):
- Only include presentation_notes when there is a PRACTICAL, non-personal observation that materially helps the next take (e.g. "Top blends into the background — a contrasting colour reads better on camera", "Hair drifts across one eye in close-ups", "Background door is open and pulls focus").
- Safe-clothing guidance is fine: contrast against background, neutral solid colours read cleanly, avoid loud patterns that strobe on camera. Frame as guidance for the camera, never as a comment on the person.
- NEVER imply class, cost, taste, polish, attractiveness, body, disability, medical devices, mobility aids, or home quality. Modest home environments must never be criticised. A neutral background is a recommendation, not a standard.
- If an issue is genuinely technical, phrase only the technical result ("the frame is slightly busy", "the lighting makes part of the face harder to read", "some words are difficult to hear") — do NOT attribute the cause.
- Empty array if there is nothing material. Never pad. Never personal.

Accessibility-safe physicality (CRITICAL):
- When evaluating movement, dance, physical comedy, or physicality, score observable PERFORMANCE CHOICES only — timing, intention, rhythm, clarity, commitment, adaptation.
- Do NOT penalise reduced range of motion, seated performance, mobility aids, prosthetics, medical devices, assistive equipment, or any visible health-related cue.
- If the brief requires physical movement, assess adaptation and intention within the movement available — never the range itself.
- Banned phrasings (and any synonym): "limited movement", "restricted", "constrained", "insufficient kinetic range", "physicality underdelivered", "movement limitation", "restricted physicality", "modern intrusion", "world-breaker", "visual distraction" (when referring to a person or device), "period-breaking item", "device visible".
- Replace with performance-focused notes such as: "Clarify the comic rhythm through timing and facial/upper-body reactions", "Use sharper changes of intention to sell the physical beat", "Make the rhythm of the gag clearer within the movement available".

Accent proportionality:
- If the structured brief's accent_required is "unknown" or accent_importance is "unspecified", DO NOT assess accent correctness. Natural regional accents are not faults.
- If accent_importance is "preferred", treat any accent imperfection as an improvement note, never a blocker, and never class-coded language.
- If accent_importance is "central" and the accent is not attempted, surface a "likely_to_block" risk flag.
- If accent_importance is "central" and the accent is inconsistent, surface "may_reduce" or "likely_to_block" depending on severity.
- Never use class-coded descriptors ("posh", "common", "rough", "uneducated"). Describe the technical issue ("vowels drift towards [X] on stressed words").

Socioeconomic fairness:
- Technical/presentation issues only meaningfully affect score when they MATERIALLY prevent assessment.
- Modest backgrounds, simple clothing, and home environments must NEVER be criticised or score-reduced. A clear, audible performance in a basic setup is not a fault.
- Reserve technical penalties for cases where the evaluator genuinely cannot see/hear the performance well enough to judge it.

Submission Risk Flags + casting_risk_explanations:
- Surface concrete casting-compliance risks that would cause rejection. Examples: "Portrait orientation but brief required landscape", "Song exceeds the 32-bar cut", "Missing slate/ident", "Uploaded as multiple clips — brief specified single file".
- For each flag, add a casting_risk_explanations entry: a plain-English casting_impact line and a recall_impact value. Use the recall_impact bands strictly:
  - unlikely_to_affect = cosmetic, must NOT affect score or verdict.
  - may_reduce = noticeable, may dent recall but must NOT hard-block on its own.
  - likely_to_block = will probably get filtered out — set the flag severity to "high" so the verdict layer caps appropriately.
- Empty if there are no material risks.

Safety and fairness — REINFORCED. NEVER, under any circumstances, comment on:
- attractiveness, weight, body shape, body type, age, race, ethnicity, class markers, gender presentation, sexuality, religion.
- disabilities, mobility aids, prosthetics, medical devices, neurodivergence, or any visible health condition. If something affects technical clarity, comment ONLY on the technical clarity, never the cause.
- home/room quality, equipment cost, or anything that signals socioeconomic status.
- personal style, hair, makeup, or fashion as personal traits. Camera-readability is fine; personal taste is not.
If you are tempted to comment on any of the above, drop the note entirely.

Tone calibration by performer LEVEL — calibrate the writing voice across ALL text fields:
- learning (Learning / School): simple, warm, confidence-building. Short sentences. Celebrate effort and one clear next step. Phrase any blocker as a fixable next step. Never use industry jargon. Never use "would not progress" or final/exclusionary language.
- amateur (Amateur / Community): warm and practical. Speak like a supportive director at a community show. Concrete suggestions. Never harsh, never final.
- emerging (Emerging / Training): craft-focused. Use working vocabulary (intention, beat change, pickup, eyeline). Push specificity, but stay encouraging.
- professional: concise, industry-realistic. Talk to them as a peer. Be direct about what would or wouldn't get a recall. Avoid subjective identity-coded language. Never harsh.

Confidence (0–100) — internal signal only, never shown to the user verbatim. Used to derive a plain-language trust indicator downstream:
- 90+ when full brief and clean signals.
- 75–89 with partial brief or minor signal issues.
- 60–74 baseline with no brief.
- <60 if data is poor.

WRITING RULES (apply to every text field — strengths, improvements, fix_first, coaching_drills, casting_headline, casting_insight, category_notes, brief_adherence_breakdown.note):
- Plain English. No technical jargon, no rubric terminology, no acronyms unless universally known. Never use "AI", "model", "confidence score", "rubric", "signal", "metric".
- Specific, not generic. Never say "good job", "nice work", "be more confident", "work on your acting". Always reference what you actually saw or heard ("Your second chorus opened up — chest voice felt grounded from 'I won't go back'", "Around 0:42 the eyeline drifted off-camera as you turned").
- Actionable. Every improvement and drill must tell the user what to DO differently next time, in one short sentence.
- Tone: encouraging, professional, direct. Like a trusted coach in the room. Never harsh, never patronising, never padded.
- Concise. Aim for one or two short sentences per item. Cut anything that doesn't help the next take.
- strengths: EXACTLY 3 items. The three biggest things working in this tape.
- improvements: AT MOST 3 items, ordered most-impactful first. If only one or two genuinely matter, return one or two.
- fix_first: ONE sentence. The single highest-impact change for the next take.
- coaching_drills: 2–4 short, practical exercises the user can do before their next take. Each starts with a verb.
- timestamped_notes: only when there is something specific to point to. Skip if you'd be padding.

Output via the submit_audition_report tool. The casting_headline is ONE plain sentence pinpointing the single most important thing the user should know. casting_insight is a one-line castability read.`;
}

type Tier = "standard" | "high" | "original";

function ensureValidMuxMp4Url(params: {
  url: string | null;
  playbackId: string | null;
  kind: "primary" | "selected" | "gemini";
}): string {
  const normalisedUrl = params.url ? normaliseMuxMp4Url(params.url) : null;
  if (normalisedUrl && isValidMuxMp4Url(normalisedUrl)) {
    return normalisedUrl;
  }

  if (params.playbackId) {
    const rebuilt = buildMuxHighestMp4Url(params.playbackId);
    if (isValidMuxMp4Url(rebuilt)) {
      return rebuilt;
    }
  }

  throw new Error("[failure_code:mux_invalid_mp4_url] Invalid Mux MP4 URL generated. Please try again.");
}

const MUX_NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

async function pickAnalysisSource(
  take: {
    id: string;
    attempt_count: number | null;
    mux_mp4_standard_url: string | null;
    mux_mp4_high_url: string | null;
    mux_playback_id: string | null;
    mux_status: string | null;
  },
  allowOriginal: boolean,
): Promise<{ url: string; tier: Tier }> {
  if (take.mux_status !== "ready") {
    throw new Error("Video is still being optimised — please try again in a moment.");
  }
  if (!take.mux_playback_id) {
    throw new Error("Missing Mux playback id — cannot build analysis URL.");
  }

  // Single canonical source: highest.mp4 built from playback_id. No legacy
  // high.mp4 fallback. The `allowOriginal` flag is preserved as a tier label
  // for downstream metrics, but the URL itself is identical.
  return {
    url: ensureValidMuxMp4Url({
      url: buildMuxHighestMp4Url(take.mux_playback_id),
      playbackId: take.mux_playback_id,
      kind: "primary",
    }),
    tier: allowOriginal ? "original" : "standard",
  };
}

export type RunProcessTakeResult =
  | { ok: true; tier?: Tier; alreadyDone?: boolean; alreadyRunning?: boolean }
  | { ok: false; error: string };

export type SubmissionVerdict = {
  // Plain-language label shown directly to the user. Canonical set — keep in
  // sync with VerdictLabel in src/lib/audition-rules.ts.
  label:
    | "Strong for this level"
    | "Ready to submit"
    | "Worth another take"
    | "Not ready yet";
  // One short sentence explaining the verdict. Never empty.
  reason: string;
  // True when a hard blocker forced the verdict below what the score alone would suggest.
  blocked: boolean;
};

/**
 * Deterministic submission verdict — LEVEL-AWARE.
 *
 * Bands come from bandsForLevel(level). Hard blockers cap at "Worth another
 * take" (or worse). Strong-for-this-level additionally requires no category
 * < 70 and brief_adherence ≥ 60 in BRIEF mode.
 */
export function computeSubmissionVerdict(input: {
  overall: number;
  audioScore: number | null;
  technicalScore: number | null;
  briefAdherence: number | null;
  mode: "brief" | "baseline";
  atRisk: boolean;
  riskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }>;
  level?: AuditionLevel;
  scores?: Record<string, number | null | undefined>;
}): SubmissionVerdict {
  const level: AuditionLevel = input.level ?? "emerging";
  const scoresForGating = {
    audio: input.audioScore ?? undefined,
    technical: input.technicalScore ?? undefined,
    ...(input.scores ?? {}),
  };
  const blockers = computeBlockers({
    scores: scoresForGating,
    briefAdherence: input.briefAdherence,
    mode: input.mode,
    riskFlags: input.atRisk
      ? [...input.riskFlags, { severity: "high" as const, flag: "Model flagged at_risk" }]
      : input.riskFlags,
  });

  const { label, capped, reason } = applyCapsAndLabel({
    overall: input.overall,
    scores: scoresForGating,
    briefAdherence: input.briefAdherence,
    mode: input.mode,
    level,
    blockers,
  });

  // Use canonical labels everywhere — no legacy "Strong submit".
  const finalLabel: SubmissionVerdict["label"] = label;
  const isBlocked = blockers.length > 0;

  let verdictReason: string;
  if (isBlocked) {
    // Blocked → reason MUST reference the main block_reason.
    verdictReason = `Blocked: ${blockers[0].message}.`;
  } else if (capped && reason) {
    verdictReason = `Score sits high, but ${reason} — fix that before sending it out.`;
  } else if (finalLabel === "Strong for this level") {
    verdictReason = "Lands strongly at your level — send with confidence.";
  } else if (finalLabel === "Ready to submit") {
    verdictReason = "Solid, castable tape — safe to send as-is.";
  } else if (finalLabel === "Worth another take") {
    verdictReason =
      "Close, but a focused retake will lift this above the submission bar.";
  } else {
    verdictReason =
      "Not ready to send — work the priority fix and shoot a fresh take.";
  }

  // Defensive: never allow an empty reason to escape.
  if (!verdictReason || !verdictReason.trim()) {
    verdictReason =
      finalLabel === "Strong for this level" || finalLabel === "Ready to submit"
        ? `${finalLabel}.`
        : "Needs another take before submitting.";
  }

  return {
    label: finalLabel,
    reason: toUKTerms(verdictReason),
    blocked: isBlocked,
  };
}

/**
 * Internal Gemini analysis pipeline. NOT auth-gated — the caller is
 * responsible for authorisation (webhook signature verification, or
 * authenticated server function with ownership check).
 */
export async function runProcessTake(
  takeId: string,
  allowOriginal = false,
): Promise<RunProcessTakeResult> {
  const runStartedAt = Date.now();
  const { data: take, error: takeErr } = await supabaseAdmin
    .from("takes")
    .select(
      "id, user_id, audition_id, signals, checklist, status, processing_phase, attempt_count, mux_status, mux_asset_id, mux_playback_id, mux_mp4_standard_url, mux_mp4_high_url, mux_duration_seconds, created_at, updated_at, error_message",
    )
    .eq("id", takeId)
    .single();

  if (takeErr || !take) {
    return { ok: false, error: "Take not found" };
  }
  if (take.status === "complete") {
    return { ok: true, alreadyDone: true };
  }
  // Cancellation guard: if the user cancelled while the webhook was in flight,
  // do not proceed. resetTake marks the row as errored with a "Cancelled by
  // user" message — treat that as a terminal stop so a delayed webhook /
  // reconciler can't restart analysis on a cancelled take.
  if (
    take.status === "error" &&
    typeof take.error_message === "string" &&
    take.error_message.toLowerCase().includes("cancelled")
  ) {
    console.log("runProcessTake: take cancelled by user, skipping", { takeId });
    metric("cancel", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      reason: "already_cancelled_at_entry",
    });
    return { ok: true, alreadyDone: true };
  }
  // Idempotency: if a pipeline is already running for this take (either
  // actively polling for the static rendition in `analysis_pending`, or
  // currently in the Gemini call in `analysing`), bail out early. Prevents
  // duplicate Gemini requests and duplicate poll loops when retry is clicked
  // mid-flight or when the webhook + reconciler race each other.
  if (
    take.status === "processing" &&
    (take.processing_phase === "analysing" ||
      take.processing_phase === "analysis_pending" ||
      take.processing_phase === "finalising")
  ) {
    console.log("already_running_skip", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      attempt_count: take.attempt_count ?? 0,
    });
    metric("already_running_skip", {
      take_id: takeId,
      processing_phase: take.processing_phase,
      attempt: take.attempt_count ?? 0,
    });
    return { ok: true, alreadyRunning: true };
  }

  const elapsedSinceCreatedMs = () => Date.now() - new Date(take.created_at).getTime();
  const baseLog = {
    take_id: takeId,
    audition_id: take.audition_id,
    mux_asset_id: take.mux_asset_id ?? null,
    mux_playback_id: take.mux_playback_id ?? null,
    attempt_count: take.attempt_count ?? 0,
  };
  console.log("[take-pipeline] runProcessTake started", {
    ...baseLog,
    processing_phase: take.processing_phase,
    elapsed_ms_since_upload: elapsedSinceCreatedMs(),
  });
  metric("analysis_started", {
    take_id: takeId,
    processing_phase: take.processing_phase,
    attempt: take.attempt_count ?? 0,
  });

  const { data: audition, error: audErr } = await supabaseAdmin
    .from("auditions")
    .select("id, brief, brief_source, mode, title, audition_level, extracted_brief")
    .eq("id", take.audition_id)
    .single();

  if (audErr || !audition) {
    return { ok: false, error: "Audition not found" };
  }

  const auditionLevel = ((audition as { audition_level?: string }).audition_level ??
    "emerging") as AuditionLevel;

  // Structured brief extraction (cached on the audition row). Skip in baseline
  // mode (no brief) or when we've already extracted previously.
  //
  // Cache reuse rules:
  //   - Reuse only when _source !== "fallback" (i.e. real AI-sourced brief).
  //   - Treat as cache miss if _source === "fallback", OR if the cached brief
  //     looks like a degraded fallback (low confidence + audition_type unknown).
  //   - On re-extract: AI success overwrites the cached fallback. AI failure
  //     uses fallback for THIS run only and does NOT overwrite an existing
  //     AI-sourced cache. If there is no cache at all, fallback is persisted
  //     with _source="fallback" so it is never treated as permanent.
  type CachedBrief = ExtractedBrief & {
    _extraction_confidence?: "low" | "medium" | "high";
    _source?: "ai" | "fallback";
  };
  const rawCached = ((audition as { extracted_brief?: CachedBrief | null }).extracted_brief ??
    null) as CachedBrief | null;
  const cachedSource = rawCached?._source;
  const cachedConfidence = rawCached?._extraction_confidence;
  const looksLikeDegradedFallback =
    rawCached != null &&
    cachedConfidence === "low" &&
    rawCached.audition_type === "unknown";
  const cacheReusable =
    rawCached != null && cachedSource !== "fallback" && !looksLikeDegradedFallback;

  let extractedBrief: ExtractedBrief | null = cacheReusable ? rawCached : null;
  let extractionConfidence: "low" | "medium" | "high" | "unknown" = cacheReusable
    ? (cachedConfidence ?? "unknown")
    : "unknown";

  if (cacheReusable) {
    console.info("[take-pipeline] brief_extraction_cache_hit_ai", {
      audition_id: audition.id,
      extraction_confidence: cachedConfidence ?? "unknown",
    });
  } else if (rawCached != null) {
    console.info("[take-pipeline] brief_extraction_cache_miss_fallback", {
      audition_id: audition.id,
      cached_source: cachedSource ?? "legacy",
      cached_confidence: cachedConfidence ?? "unknown",
    });
  }

  if (!extractedBrief && audition.brief && audition.brief.trim().length > 5) {
    const result = await extractBriefFromText(audition.brief);
    if (result) {
      extractedBrief = result.brief;
      extractionConfidence = result.extraction_confidence;

      const hasExistingAiCache = rawCached != null && cachedSource === "ai";
      const shouldPersist =
        result.source === "ai"
          ? true // AI success: always persist (overwrites any fallback cache)
          : !hasExistingAiCache; // fallback: persist only if no AI cache exists

      if (shouldPersist) {
        await supabaseAdmin
          .from("auditions")
          .update({
            extracted_brief: {
              ...result.brief,
              _extraction_confidence: result.extraction_confidence,
              _source: result.source,
            } as never,
          })
          .eq("id", audition.id);
        if (result.source === "ai") {
          console.info("[take-pipeline] brief_extraction_ai_cached", {
            audition_id: audition.id,
            extraction_confidence: result.extraction_confidence,
          });
        }
      }

      if (result.source === "fallback") {
        console.info("[take-pipeline] brief_extraction_fallback_used", {
          audition_id: audition.id,
          persisted: shouldPersist,
          had_existing_ai_cache: hasExistingAiCache,
        });
      }
    }
  }


  // Stay in analysis_pending while we poll for the static MP4 rendition.
  // We DON'T flip to "analysing" yet — that would mislead the UI into
  // showing "Watching your tape" while we're actually still waiting on Mux
  // to finish generating the static rendition (highest.mp4). The phase
  // flips to "analysing" only after the HEAD probe succeeds, immediately
  // before the Gemini call.
  await supabaseAdmin
    .from("takes")
    .update({
      status: "pending",
      processing_phase: "analysis_pending",
      error_message: null,
    })
    .eq("id", takeId);

  // ---- Hard timeout / retry-cap finaliser scaffolding ----
  // Defaults are intentionally aggressive to prevent the 10-minute wall-clock
  // bug where a stuck Gemini call burns the entire E2E budget. Override via
  // env if a workspace needs different bounds.
  const ANALYSIS_GEMINI_TIMEOUT_MS = Number(
    process.env.ANALYSIS_GEMINI_TIMEOUT_MS ?? 90_000,
  );
  const ANALYSIS_TOTAL_TIMEOUT_MS = Number(
    process.env.ANALYSIS_TOTAL_TIMEOUT_MS ?? 540_000,
  );
  const ANALYSIS_MAX_RETRIES = Number(process.env.ANALYSIS_MAX_RETRIES ?? 1);

  type FailureCode =
    | "gemini_timeout"
    | "gemini_429"
    | "gemini_5xx"
    | "ai_network_error"
    | "ai_credits_exhausted"
    | "ai_non_retryable_4xx"
    | "analysis_total_timeout"
    | "analysis_parse_failed"
    | "analysis_persist_failed"
    | "analysis_no_terminal_state"
    | "mux_invalid_mp4_url"
    | "mux_static_rendition_timeout"
    | "mux_static_rendition_errored"
    | "mux_static_rendition_skipped"
    | "stale_timeout";

  // Terminal-state tracking: any path that writes status=error/complete must
  // flip this to true so the finally-block fallback doesn't double-write.
  let terminalWritten = false;
  // Intentional non-terminal exit (e.g. MP4 not yet ready, leaving the row
  // in analysis_pending for the cron reconciler to retry). When true, the
  // finally-block safety net MUST NOT mark the take as failed.
  let deferredPending = false;
  // Hoisted so the outer catch can attribute failures to the finalising
  // substage. 0 = AI hasn't returned yet; >0 = post-AI work in progress.
  let finaliseStartedAt = 0;

  const markTerminalFailure = async (
    code: FailureCode,
    message: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> => {
    if (terminalWritten) return;
    terminalWritten = true;
    const errorMessage = `[failure_code:${code}] ${message}`;
    try {
      await supabaseAdmin
        .from("takes")
        .update({
          status: "error",
          processing_phase: "error",
          error_message: errorMessage,
        })
        .eq("id", takeId);
    } catch (writeErr) {
      console.error("[take-pipeline] markTerminalFailure write error", writeErr);
    }
    metric("analysis_terminal", {
      take_id: takeId,
      reason: code,
      failure_code: code,
      duration_ms: Date.now() - runStartedAt,
      ...extra,
    });
    console.warn("[take-pipeline] analysis_terminal", {
      take_id: takeId,
      failure_code: code,
      message,
      ...extra,
    });
  };

  // Carries a failure_code on errors thrown from the Gemini retry loop so the
  // outer catch can route them through markTerminalFailure with the right tag.
  class AnalysisFailure extends Error {
    failureCode: FailureCode;
    constructor(code: FailureCode, message: string) {
      super(message);
      this.failureCode = code;
    }
  }

  try {
    const { tier } = await pickAnalysisSource(take, allowOriginal);

    // ---- Deterministic Mux readiness gate ----
    //
    // Trust `video.asset.static_rendition.ready` (the webhook that brought us
    // here, or the reconciler's Mux API check) as the authoritative readiness
    // signal. We do NOT re-run a multi-method probe loop here — that path was
    // unreliable against Mux's Varnish layer and caused indefinite
    // "Preparing analysis" loops on transient 404s.
    //
    // Rules:
    //   - mux_status MUST be "ready" and mux_playback_id MUST be present.
    //   - The MP4 URL is built canonically from mux_playback_id.
    //     Stored URL fields are ignored on the active path.
    //   - One short HEAD courtesy check (3s timeout) is performed for
    //     observability only — its result does NOT gate analysis. If Mux
    //     said the rendition is ready, we proceed.
    //   - No legacy high.mp4. No range/browser GET fallbacks. No deferral
    //     loop. The reconciler's wall-clock cap remains the only safety net.
    const probeStartedWallclock = Date.now();

    if (take.mux_status !== "ready" || !take.mux_playback_id) {
      // Mux not ready yet. Leave the row in analysis_pending; the cron
      // reconciler will retry within ~60s (and will recover via the Mux API
      // if the webhook never arrived). Do NOT fail terminally here unless
      // we've blown the wall-clock cap.
      const PREPARE_HARD_TIMEOUT_MS = 10 * 60_000;
      const ageMs = elapsedSinceCreatedMs() ?? 0;
      if (ageMs >= PREPARE_HARD_TIMEOUT_MS) {
        await markTerminalFailure(
          "mux_static_rendition_timeout",
          "We couldn't prepare your video in time. Please try again.",
          { age_ms: ageMs },
        );
        return {
          ok: false,
          error: "We couldn't prepare your video in time. Please try again.",
        };
      }
      console.log("mux_not_ready_yet_deferring", {
        ...baseLog,
        mux_status: take.mux_status,
        has_playback_id: Boolean(take.mux_playback_id),
        age_ms: ageMs,
        deferred_reason: "mux_not_ready",
      });
      metric("preparation_deferred", {
        take_id: takeId,
        processing_phase: "analysis_pending",
        age_ms: ageMs,
        reason: "mux_not_ready",
      });
      deferredPending = true;
      return { ok: true, alreadyDone: false };
    }

    let resolvedProbeUrl: string;
    try {
      resolvedProbeUrl = ensureValidMuxMp4Url({
        url: buildMuxHighestMp4Url(take.mux_playback_id),
        playbackId: take.mux_playback_id,
        kind: "primary",
      });
    } catch {
      await markTerminalFailure(
        "mux_invalid_mp4_url",
        "Invalid Mux MP4 URL generated. Please try again.",
      );
      return {
        ok: false,
        error: "Invalid Mux MP4 URL generated. Please try again.",
      };
    }

    // Courtesy HEAD probe — observability only. Never blocks analysis.
    let courtesyHeadStatus: number | null = null;
    let courtesyHeadError: string | null = null;
    {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3_000);
      let r: Response | null = null;
      try {
        r = await fetch(resolvedProbeUrl, {
          method: "HEAD",
          headers: MUX_NO_CACHE_HEADERS,
          cache: "no-store",
          signal: ctrl.signal,
        });
        courtesyHeadStatus = r.status;
      } catch (err) {
        courtesyHeadError = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(t);
        try {
          await r?.body?.cancel();
        } catch {
          /* ignore */
        }
      }
    }
    console.log("mux_prepare_ready", {
      ...baseLog,
      canonical_url: resolvedProbeUrl,
      courtesy_head_status: courtesyHeadStatus,
      courtesy_head_error: courtesyHeadError,
      selected_url: resolvedProbeUrl,
      selected_probe_method: "static_rendition_ready",
    });
    metric("static_mp4_ready", {
      take_id: takeId,
      duration_ms: Date.now() - probeStartedWallclock,
      attempt: 1,
      tier,
    });

    // Re-check cancellation immediately before the analysing flip.
    const { data: postPoll } = await supabaseAdmin
      .from("takes")
      .select("status, error_message")
      .eq("id", takeId)
      .single();
    if (
      postPoll?.status === "error" &&
      typeof postPoll.error_message === "string" &&
      postPoll.error_message.toLowerCase().includes("cancelled")
    ) {
      console.log("[take-pipeline] cancelled before analysing flip, aborting", baseLog);
      metric("cancel", {
        take_id: takeId,
        processing_phase: "analysis_pending",
        duration_ms: Date.now() - probeStartedWallclock,
        reason: "after_preparation",
      });
      metric("analysis_abandoned", { take_id: takeId, processing_phase: "analysis_pending" });
      return { ok: true, alreadyDone: true };
    }

    const preparationDurationMs = Date.now() - probeStartedWallclock;
    console.log("[take-pipeline] mux ready, transitioning to analysing", {
      ...baseLog,
      analysis_tier: tier,
      elapsed_ms_since_upload: elapsedSinceCreatedMs(),
      selected_url: resolvedProbeUrl,
    });
    metric("preparation_completed", {
      take_id: takeId,
      duration_ms: preparationDurationMs,
      tier,
    });
    metric("analysis_pending_to_analysing", {
      take_id: takeId,
      duration_ms: preparationDurationMs,
    });

    // NOW flip into the active analysing phase — Gemini call is next.
    await supabaseAdmin
      .from("takes")
      .update({
        status: "processing",
        processing_phase: "analysing",
        error_message: null,
        attempt_count: (take.attempt_count ?? 0) + 1,
        analysis_tier: tier,
      })
      .eq("id", takeId);

    const briefBlock = audition.brief
      ? `CASTING BRIEF (${audition.brief_source}):\n${audition.brief}`
      : `NO CASTING BRIEF PROVIDED — apply BASELINE rubric (treat as professional standards). Do not invent constraints.`;

    const extractedBlock = extractedBrief
      ? `STRUCTURED BRIEF (parsed):\n${JSON.stringify(extractedBrief, null, 2)}`
      : "STRUCTURED BRIEF: none.";

    const signalsBlock = `TECHNICAL SIGNALS (modifiers, not primary):\n${JSON.stringify(
      { signals: take.signals, checklist: take.checklist },
      null,
      2,
    )}`;

    const levelBlock = `PERFORMER LEVEL: ${auditionLevel}. Calibrate expectations and tone for this level — encouraging at lower levels, sharper at professional. Never harsh.`;

    const userText = [
      `Audition title: ${audition.title}`,
      levelBlock,
      briefBlock,
      extractedBlock,
      signalsBlock,
      `Analysis tier: ${tier} rendition (the user's original performance is intact — only technical encoding was standardised).`,
      "Watch and listen to the attached self-tape, structure it (detect components), and submit a structured report via the submit_audition_report tool. Use British English throughout (recall not callback, casting brief, self-tape, analysing, prioritised, behaviour, centre). Be specific, prioritised, and constructive.",
    ].join("\n\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // POST_AI_FINALISE_TIMEOUT_MS bounds parse + scrubs + score recompute +
    // persist combined as a wall-clock deadline from the start of finalising.
    // Default is 90s — long enough for normal post-processing + persistence,
    // short enough that we never leave a take stuck on "Finalising results".
    const POST_AI_FINALISE_TIMEOUT_MS = Number(
      process.env.POST_AI_FINALISE_TIMEOUT_MS ?? 90_000,
    );
    finaliseStartedAt = Date.now();
    const finaliseExceeded = () =>
      Date.now() - finaliseStartedAt > POST_AI_FINALISE_TIMEOUT_MS;
    const finaliseElapsedMs = () => Date.now() - finaliseStartedAt;
    // Emit a finalising_timeout marker + throw a tagged failure so the
    // outer catch parks the take in `error` with a recoverable message.
    const throwFinaliseTimeout = (substage: string): never => {
      const elapsed = finaliseElapsedMs();
      console.warn("[take-pipeline] finalising_timeout", {
        take_id: takeId,
        substage,
        finalising_duration_ms: elapsed,
        two_step_enabled: isTwoStepEnabled(),
      });
      metric("analysis_persist_failed", {
        take_id: takeId,
        reason: `finalising_timeout:${substage}`,
        duration_ms: elapsed,
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "We couldn’t finish your report this time. Please try again.",
      );
    };

    // ---- Two-step pipeline (feature-flagged) ----
    // When TWO_STEP_ANALYSIS_ENABLED === "true", run Step 1 (multimodal
    // evidence pass) then Step 2 (text-only polish using REPORT_TOOL). Step 1
    // evidence stays in memory; only a compact non-sensitive summary is
    // persisted into score_breakdown.two_step. If either step fails entirely,
    // fall back to a deterministic renderer derived from Step 1 evidence.
    // When the flag is unset/false, the existing single-pass code path runs
    // unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let twoStepReport: any = null;
    let twoStepEvidence: EvidencePass | null = null;
    let twoStepEnforcement = {
      locked_field_overwrites: 0,
      unsupported_claims_removed: 0,
      unsupported_claims_rewritten: 0,
    };
    let twoStepTimestampsDropped = 0;
    let evidencePassDurationMs = 0;
    let reportPolishDurationMs = 0;
    let twoStepFallbackUsed = false;
    let twoStepFallbackReason: string | null = null;

    if (isTwoStepEnabled()) {
      const twoStepStartedAt = Date.now();
      const evidenceContext = [
        `Audition title: ${audition.title}`,
        levelBlock,
        briefBlock,
        extractedBlock,
        signalsBlock,
        `Analysis tier: ${tier} rendition.`,
      ].join("\n\n");

      console.log("[take-pipeline] evidence_pass_started", {
        ...baseLog,
        analysis_tier: tier,
      });
      metric("evidence_pass_started", { take_id: takeId, tier });

      const evidenceUrl = ensureValidMuxMp4Url({
        url: resolvedProbeUrl,
        playbackId: take.mux_playback_id,
        kind: "gemini",
      });
      const evAc = new AbortController();
      const evTimer = setTimeout(() => evAc.abort(), ANALYSIS_GEMINI_TIMEOUT_MS);
      const evResult = await runEvidencePass({
        videoUrl: evidenceUrl,
        apiKey,
        signal: evAc.signal,
        contextText: evidenceContext,
        durationSeconds: take.mux_duration_seconds ?? null,
      }).finally(() => clearTimeout(evTimer));

      if (!evResult.ok) {
        // Step 1 failure → fall back to single-pass for this run. Don't
        // throw: we still want a usable report.
        console.warn("[take-pipeline] evidence_pass_failed; falling back to single-pass", {
          ...baseLog,
          http_status: evResult.httpStatus,
          error: evResult.error.slice(0, 200),
          duration_ms: evResult.durationMs,
        });
        metric("evidence_pass_failed", {
          take_id: takeId,
          http_status: evResult.httpStatus,
          duration_ms: evResult.durationMs,
        });
      } else {
        evidencePassDurationMs = evResult.durationMs;
        twoStepEvidence = evResult.evidence;
        twoStepTimestampsDropped = evResult.timestamps_dropped;
        const evSummary = summariseEvidence(twoStepEvidence);
        console.log("[take-pipeline] evidence_pass_completed", {
          ...baseLog,
          duration_ms: evResult.durationMs,
          timestamps_count: evSummary.timestamped_evidence_count,
          sufficiency: evSummary.evidence_sufficiency,
        });
        metric("evidence_pass_completed", {
          take_id: takeId,
          duration_ms: evResult.durationMs,
          timestamps_count: evSummary.timestamped_evidence_count,
        });
        if (twoStepTimestampsDropped > 0) {
          console.log("[take-pipeline] timestamp_evidence_dropped", {
            take_id: takeId,
            count: twoStepTimestampsDropped,
          });
        }

        // ---- Step 2: text-only polish ----
        console.log("[take-pipeline] report_polish_started", baseLog);
        metric("report_polish_started", { take_id: takeId });
        const polishAc = new AbortController();
        const polishTimer = setTimeout(
          () => polishAc.abort(),
          ANALYSIS_GEMINI_TIMEOUT_MS,
        );
        const polishResult = await runReportPolish({
          apiKey,
          signal: polishAc.signal,
          evidence: twoStepEvidence,
          briefBlock,
          extractedBlock,
          signalsBlock,
          levelBlock,
          auditionTitle: audition.title,
          reportTool: REPORT_TOOL,
        }).finally(() => clearTimeout(polishTimer));

        if (!polishResult.ok) {
          // Step 2 failure → deterministic fallback renderer.
          console.warn("[take-pipeline] report_polish_failed; using fallback renderer", {
            ...baseLog,
            http_status: polishResult.httpStatus,
            error: polishResult.error.slice(0, 200),
            duration_ms: polishResult.durationMs,
          });
          metric("report_polish_failed", {
            take_id: takeId,
            http_status: polishResult.httpStatus,
            duration_ms: polishResult.durationMs,
          });
          twoStepFallbackUsed = true;
          twoStepFallbackReason = polishResult.error.slice(0, 120);
          reportPolishDurationMs = polishResult.durationMs;
          const mode: "brief" | "baseline" = audition.brief ? "brief" : "baseline";
          twoStepReport = renderFallbackReport(twoStepEvidence, mode);
          metric("two_step_fallback_used", {
            take_id: takeId,
            reason: twoStepFallbackReason,
          });
        } else {
          reportPolishDurationMs = polishResult.durationMs;
          twoStepReport = polishResult.report;
          // Force mode from server-known truth (not from the polish model).
          twoStepReport.mode = audition.brief ? "brief" : "baseline";
          // Locked-field enforcement (PRIMARY safeguard).
          const locked = enforceLockedFields(twoStepReport, twoStepEvidence);
          twoStepEnforcement.locked_field_overwrites = locked.overwrites;
          if (locked.overwrites > 0) {
            console.log("[take-pipeline] report_polish_locked_field_overwritten", {
              ...baseLog,
              count: locked.overwrites,
            });
          }
          // Conservative unsupported-claim handling.
          const claims = enforceUnsupportedClaims(twoStepReport, twoStepEvidence);
          twoStepEnforcement.unsupported_claims_removed = claims.removed;
          twoStepEnforcement.unsupported_claims_rewritten = claims.rewritten;
          for (const [field, count] of Object.entries(claims.per_field_removed)) {
            if (count > 0) {
              console.log("[take-pipeline] report_polish_unsupported_claim_removed", {
                take_id: takeId,
                field,
                count,
              });
            }
          }
          console.log("[take-pipeline] report_polish_completed", {
            ...baseLog,
            duration_ms: polishResult.durationMs,
            locked_overwrites: locked.overwrites,
            claims_removed: claims.removed,
            claims_rewritten: claims.rewritten,
          });
          metric("report_polish_completed", {
            take_id: takeId,
            duration_ms: polishResult.durationMs,
            locked_overwrites: locked.overwrites,
            claims_removed: claims.removed,
            claims_rewritten: claims.rewritten,
          });
        }
      }

      const totalAi = Date.now() - twoStepStartedAt;
      console.log("[take-pipeline] two_step_total_ai_duration_ms", {
        ...baseLog,
        duration_ms: totalAi,
        evidence_ms: evidencePassDurationMs,
        polish_ms: reportPolishDurationMs,
        fallback_used: twoStepFallbackUsed,
      });
      metric("two_step_total_ai_duration_ms", {
        take_id: takeId,
        duration_ms: totalAi,
      });
      if (totalAi > 90_000) {
        console.warn("[take-pipeline] two_step_latency_warning", {
          take_id: takeId,
          two_step_total_ai_duration_ms: totalAi,
          evidence_pass_duration_ms: evidencePassDurationMs,
          report_polish_duration_ms: reportPolishDurationMs,
        });
      }
    }

    const callAI = (videoUrl: string, signal: AbortSignal, model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          // Deterministic generation settings for the legacy single-pass path.
          // Rollback to single-pass must not regress to high-stochasticity output.
          temperature: 0.2,
          top_p: 1,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                // CRITICAL: video MP4s must be sent as `file_url`, NOT
                // `image_url`. Gemini via the Lovable AI Gateway rejects
                // `image_url` for video/mp4 with HTTP 400 ("Unsupported
                // image format … Supported: PNG, JPEG, WebP, GIF").
                { type: "file_url", file_url: { url: videoUrl } },
              ],
            },
          ],
          tools: [REPORT_TOOL],
          tool_choice: { type: "function", function: { name: "submit_audition_report" } },
          max_tokens: 8192,
        }),
        signal,
      });

    // ---- Strict Gemini retry policy ----
    // Attempt 1 = primary model. On retryable failure (timeout / 429 / 500 /
    // 503 / 504 / network), retry ONCE with the fallback model. Total
    // attempts = 1 + ANALYSIS_MAX_RETRIES (default 1 → 2 attempts max).
    // Never retry on: parse errors, 4xx other than 429, 402 (credits).
    // If the AI circuit breaker is OPEN, attempt 1 routes directly to the
    // fallback model (no primary attempt).
    const RETRYABLE_HTTP = new Set([429, 500, 503, 504]);
    const GEMINI_BACKOFF_MS = [10_000, 30_000];

    const circuitOpenAtStart = isCircuitOpen();
    const initialModel = circuitOpenAtStart
      ? ANALYSIS_MODEL_FALLBACK
      : ANALYSIS_MODEL_PRIMARY;
    if (circuitOpenAtStart) {
      console.warn("[take-pipeline] ai_circuit_fallback_selected", {
        take_id: takeId,
        model: ANALYSIS_MODEL_FALLBACK,
      });
      metric("ai_circuit_fallback_selected", {
        take_id: takeId,
        model: ANALYSIS_MODEL_FALLBACK,
      });
    }
    let currentModel = initialModel;

    const isCancelled = async (): Promise<boolean> => {
      const { data } = await supabaseAdmin
        .from("takes")
        .select("status, error_message")
        .eq("id", takeId)
        .single();
      return (
        data?.status === "error" &&
        typeof data.error_message === "string" &&
        data.error_message.toLowerCase().includes("cancelled")
      );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let report: any = null;
    let aiResp: Response | null = null;
    if (twoStepReport) {
      // Two-step pipeline produced (or fell back to) a report. Skip the
      // single-pass Gemini call and parse stages entirely.
      report = twoStepReport;
    } else {
    let geminiAttempt = 0;
    let geminiRetryCount = 0;
    const geminiStartedAt = Date.now();
    console.info("[take-pipeline] ai_model_selected", {
      take_id: takeId,
      model: currentModel,
      primary: ANALYSIS_MODEL_PRIMARY,
      fallback: ANALYSIS_MODEL_FALLBACK,
      circuit_open: circuitOpenAtStart,
    });
    console.log("[take-pipeline] gemini request started", {
      ...baseLog,
      analysis_tier: tier,
      processing_phase: "analysing",
      elapsed_ms_since_upload: elapsedSinceCreatedMs(),
      model: currentModel,
      gemini_timeout_ms: ANALYSIS_GEMINI_TIMEOUT_MS,
      total_timeout_ms: ANALYSIS_TOTAL_TIMEOUT_MS,
      max_retries: ANALYSIS_MAX_RETRIES,
    });
    metric("gemini_started", {
      take_id: takeId,
      processing_phase: "analysing",
      tier,
      model: currentModel,
      gemini_timeout_ms: ANALYSIS_GEMINI_TIMEOUT_MS,
      total_timeout_ms: ANALYSIS_TOTAL_TIMEOUT_MS,
      max_retries: ANALYSIS_MAX_RETRIES,
    });

    let urlForCall = ensureValidMuxMp4Url({
      url: resolvedProbeUrl,
      playbackId: take.mux_playback_id,
      kind: "gemini",
    });
    while (true) {
      // Total-budget guard BEFORE each attempt — prevents starting an attempt
      // we know we can't complete inside the wall-clock budget.
      const elapsedRunMs = Date.now() - runStartedAt;
      if (elapsedRunMs >= ANALYSIS_TOTAL_TIMEOUT_MS) {
        metric("gemini_failed", {
          take_id: takeId,
          retry_count: geminiRetryCount,
          duration_ms: Date.now() - geminiStartedAt,
          reason: "analysis_total_timeout",
          failure_code: "analysis_total_timeout",
        });
        throw new AnalysisFailure(
          "analysis_total_timeout",
          "The analysis exceeded its total time budget. Please try again.",
        );
      }

      geminiAttempt += 1;
      const attemptStart = Date.now();
      // Per-attempt deadline is the smaller of the per-attempt cap and the
      // remaining total budget — never start a long attempt we can't finish.
      const remainingBudgetMs = ANALYSIS_TOTAL_TIMEOUT_MS - elapsedRunMs;
      const attemptTimeoutMs = Math.max(
        1_000,
        Math.min(ANALYSIS_GEMINI_TIMEOUT_MS, remainingBudgetMs),
      );
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), attemptTimeoutMs);

      let thrown: unknown = null;
      let timedOut = false;
      try {
        aiResp = await callAI(urlForCall, ac.signal, currentModel);
      } catch (callErr) {
        thrown = callErr;
        aiResp = null;
        // AbortError shape varies between runtimes — detect by name.
        const name = (callErr as { name?: string } | undefined)?.name;
        if (ac.signal.aborted || name === "AbortError" || name === "TimeoutError") {
          timedOut = true;
        }
      } finally {
        clearTimeout(timer);
      }

      const status = aiResp?.status ?? null;
      console.log("[take-pipeline] gemini response received", {
        ...baseLog,
        analysis_tier: tier,
        http_status: status,
        gemini_attempt: geminiAttempt,
        gemini_duration_ms: Date.now() - attemptStart,
        elapsed_ms_since_upload: elapsedSinceCreatedMs(),
        timed_out: timedOut,
        model: currentModel,
      });

      // Success.
      if (aiResp && aiResp.ok) break;

      // One-shot stale-URL recovery for 400 — preserve existing fallback.
      // Does NOT count against the retry budget (URL/schema recovery).
      if (
        aiResp &&
        aiResp.status === 400 &&
        take.mux_playback_id &&
          urlForCall === resolvedProbeUrl
      ) {
        const errText = await aiResp.text();
        console.warn(
          "AI gateway rejected URL; retrying once with fresh Mux URL",
          errText.slice(0, 200),
        );
        urlForCall = ensureValidMuxMp4Url({
          url: buildMuxHighestMp4Url(take.mux_playback_id),
          playbackId: take.mux_playback_id,
          kind: "gemini",
        });
        // Roll back the attempt counter so this doesn't consume a retry slot.
        geminiAttempt -= 1;
        continue;
      }

      // Hard, non-retryable: 402 (credits).
      if (aiResp && aiResp.status === 402) {
        metric("gemini_failed", {
          take_id: takeId,
          retry_count: geminiRetryCount,
          http_status: 402,
          duration_ms: Date.now() - geminiStartedAt,
          reason: "credits_exhausted",
          model: currentModel,
          failure_code: "ai_credits_exhausted",
        });
        throw new AnalysisFailure(
          "ai_credits_exhausted",
          "AI credits exhausted on this workspace. Add funds to continue.",
        );
      }

      // Determine retryability per strict policy.
      const httpRetryable =
        aiResp !== null && status !== null && RETRYABLE_HTTP.has(status);
      const networkThrow = aiResp === null && !timedOut && thrown !== null;
      const transient = timedOut || httpRetryable || networkThrow;

      // Pick a failure_code for whatever we'd terminate with if no retry left.
      let failureCode: FailureCode;
      if (timedOut) failureCode = "gemini_timeout";
      else if (status === 429) failureCode = "gemini_429";
      else if (status !== null && status >= 500 && status < 600)
        failureCode = "gemini_5xx";
      else if (networkThrow) failureCode = "ai_network_error";
      else if (status !== null && status >= 400 && status < 500)
        failureCode = "ai_non_retryable_4xx";
      else failureCode = "ai_network_error";

      // Non-retryable (parse/validation/4xx other than 429): terminate now.
      if (!transient) {
        const t = aiResp ? await aiResp.text().catch(() => "") : "";
        console.error("AI gateway hard error", status, t.slice(0, 500));
        metric("gemini_failed", {
          take_id: takeId,
          retry_count: geminiRetryCount,
          http_status: status,
          duration_ms: Date.now() - geminiStartedAt,
          reason: "non_retryable",
          model: currentModel,
          failure_code: failureCode,
        });
        throw new AnalysisFailure(
          failureCode,
          `AI gateway error (${status ?? "network"}). Please try again.`,
        );
      }

      // Transient — retry if budget allows. We allow exactly ONE fallback
      // retry per spec: attempt 1 = primary, attempt 2 = fallback.
      if (geminiRetryCount >= ANALYSIS_MAX_RETRIES) {
        // Out of retries: emit gemini_failed and surface a typed terminal error.
        // Record this terminal transient failure into the circuit breaker.
        if (
          failureCode === "gemini_timeout" ||
          failureCode === "gemini_5xx" ||
          failureCode === "ai_network_error"
        ) {
          recordAiFailure(failureCode);
        }
        console.warn("gemini_retry_exhausted", {
          ...baseLog,
          retry_count: geminiRetryCount,
          http_status: status,
          timed_out: timedOut,
          elapsed_ms: Date.now() - geminiStartedAt,
          failure_code: failureCode,
          model: currentModel,
        });
        metric("gemini_failed", {
          take_id: takeId,
          retry_count: geminiRetryCount,
          http_status: status,
          duration_ms: Date.now() - geminiStartedAt,
          reason: "retry_exhausted",
          failure_code: failureCode,
          timed_out: timedOut,
          model: currentModel,
        });
        const msg =
          failureCode === "gemini_timeout"
            ? "The analysis took too long. Please try again."
            : failureCode === "gemini_429"
              ? "AI gateway is rate-limited. Please try again shortly."
              : failureCode === "ai_network_error"
                ? "AI gateway network error. Please try again."
                : "AI gateway is temporarily unavailable. Please try again.";
        throw new AnalysisFailure(failureCode, msg);
      }

      if (await isCancelled()) {
        console.log("[take-pipeline] cancelled before gemini retry", baseLog);
        metric("cancel", {
          take_id: takeId,
          processing_phase: "analysing",
          duration_ms: Date.now() - geminiStartedAt,
          reason: "before_gemini_retry",
        });
        metric("analysis_abandoned", { take_id: takeId, processing_phase: "analysing" });
        terminalWritten = true; // cancellation is its own terminal state
        return { ok: true, alreadyDone: true };
      }

      geminiRetryCount += 1;
      // Switch to fallback model for the retry (unless we already started on
      // the fallback because the circuit was open).
      const previousModel = currentModel;
      if (currentModel === ANALYSIS_MODEL_PRIMARY) {
        currentModel = ANALYSIS_MODEL_FALLBACK;
        console.warn("[take-pipeline] ai_fallback_selected", {
          take_id: takeId,
          from_model: previousModel,
          to_model: currentModel,
          reason: failureCode,
        });
        metric("ai_fallback_selected", {
          take_id: takeId,
          from_model: previousModel,
          model: currentModel,
          reason: failureCode,
          http_status: status,
          timed_out: timedOut,
        });
      }
      console.log("gemini_retry_started", {
        ...baseLog,
        retry_count: geminiRetryCount,
        http_status: status,
        attempt_count: geminiAttempt,
        elapsed_ms: Date.now() - geminiStartedAt,
        timed_out: timedOut,
        model: currentModel,
      });
      metric("gemini_retry", {
        take_id: takeId,
        retry_count: geminiRetryCount,
        http_status: status,
        attempt: geminiAttempt,
        timed_out: timedOut,
        failure_code: failureCode,
        model: currentModel,
      });
      const backoff = GEMINI_BACKOFF_MS[geminiRetryCount - 1] ?? 30_000;
      await new Promise((r) => setTimeout(r, backoff));
      // Loop continues — total-budget guard at the top will catch overruns.
    }

    if (!aiResp || !aiResp.ok) {
      throw new AnalysisFailure(
        "analysis_no_terminal_state",
        "We couldn't complete the analysis this time. Please try again.",
      );
    }
    metric("gemini_completed", {
      take_id: takeId,
      duration_ms: Date.now() - geminiStartedAt,
      retry_count: geminiRetryCount,
      tier,
    });
    if (geminiRetryCount > 0) {
      console.log("gemini_retry_succeeded", {
        ...baseLog,
        retry_count: geminiRetryCount,
        elapsed_ms: Date.now() - geminiStartedAt,
      });
    }
    metric("gemini_completed", {
      take_id: takeId,
      duration_ms: Date.now() - geminiStartedAt,
      retry_count: geminiRetryCount,
      tier,
    });
    if (geminiRetryCount > 0) {
      console.log("gemini_retry_succeeded", {
        ...baseLog,
        retry_count: geminiRetryCount,
        elapsed_ms: Date.now() - geminiStartedAt,
      });
    }

    // ---- Parse stage (timed, tagged) ----

    const parseStartedAt = Date.now();
    metric("analysis_parse_started", { take_id: takeId, model: currentModel });
    console.log("[take-pipeline] analysis_parse_started", {
      ...baseLog,
      model: currentModel,
    });

    // (report variable is hoisted above; assigned here for the single-pass path)
    try {
      const json = await aiResp.json();
      const choice = json.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new AnalysisFailure(
          "analysis_parse_failed",
          "AI did not return a structured report. Please try again.",
        );
      }
      try {
        report = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        if (choice?.finish_reason === "length") {
          throw new AnalysisFailure(
            "analysis_parse_failed",
            "The AI response was cut off before it finished writing the report. Please retry.",
          );
        }
        console.error(
          "AI JSON parse failed",
          parseErr,
          (toolCall.function.arguments as string | undefined)?.slice(-300),
        );
        throw new AnalysisFailure(
          "analysis_parse_failed",
          "The AI returned an incomplete report. Please retry.",
        );
      }
      if (finaliseExceeded()) {
        throw new AnalysisFailure(
          "analysis_parse_failed",
          "Parsing the AI response took too long. Please try again.",
        );
      }
    } catch (parseOuter) {
      metric("analysis_parse_failed", {
        take_id: takeId,
        duration_ms: Date.now() - parseStartedAt,
        reason:
          parseOuter instanceof Error ? parseOuter.message.slice(0, 120) : "parse_error",
      });
      console.warn("[take-pipeline] analysis_parse_failed", {
        ...baseLog,
        duration_ms: Date.now() - parseStartedAt,
      });
      throw parseOuter;
    }
    metric("analysis_parse_completed", {
      take_id: takeId,
      duration_ms: Date.now() - parseStartedAt,
    });
    console.log("[take-pipeline] analysis_parse_completed", {
      ...baseLog,
      duration_ms: Date.now() - parseStartedAt,
    });
    } // end of single-pass else branch

    // ====================================================================
    //  FINALISING STAGE — deterministic post-processing + persistence.
    //  Bounded by POST_AI_FINALISE_TIMEOUT_MS. Each substage is logged so
    //  hangs can be attributed in production logs.
    // ====================================================================
    const finalisingStartedAt = Date.now();
    console.log("[take-pipeline] finalising_started", {
      take_id: takeId,
      processing_phase: "analysing",
      two_step_enabled: isTwoStepEnabled(),
      fallback_used: twoStepFallbackUsed,
    });

    // Transition to the dedicated `finalising` phase before any deterministic
    // post-processing begins (validation, UK terminology pass, score
    // recomputation, scrubs, verdict/cap logic, final persistence). This lets
    // the reconciler distinguish a still-running AI call (`analysing`) from a
    // dead worker mid-finalisation (`finalising`) and apply the right timeout
    // policy. Conditional on the row still being status=processing AND
    // phase=analysing so we don't clobber a cancellation/reset that landed
    // while Gemini was running.
    {
      const { data: phaseRows, error: phaseErr } = await supabaseAdmin
        .from("takes")
        .update({ processing_phase: "finalising" })
        .eq("id", takeId)
        .eq("status", "processing")
        .eq("processing_phase", "analysing")
        .select("id");
      if (phaseErr) {
        console.warn("[take-pipeline] finalising_phase_set_failed", {
          take_id: takeId,
          error: String(phaseErr.message ?? phaseErr),
        });
        // Non-fatal: subsequent persistence guard will detect state drift.
      } else if (!phaseRows || phaseRows.length === 0) {
        console.log("[take-pipeline] finalising_phase_set_skipped", {
          take_id: takeId,
          reason: "state_changed_pre_finalising",
        });
        // Row no longer in (processing, analysing) — likely cancelled/reset.
        // Let the existing pre-write guard discard the result cleanly.
      } else {
        console.log("[take-pipeline] finalising_phase_set", {
          take_id: takeId,
          processing_phase: "finalising",
        });
      }
    }

    // ---- Validate two-step report shape before deterministic scrubs ----
    // A malformed Step-2 report (missing scores/category fields) can wedge
    // downstream regex walks. Detect early; fall back or fail cleanly.
    if (isTwoStepEnabled()) {
      const requiredFields = [
        "scores",
        "audition_type",
      ] as const;
      const missing: string[] = [];
      const malformed: string[] = [];
      for (const f of requiredFields) {
        const v = (report as Record<string, unknown>)[f];
        if (v === undefined || v === null) missing.push(f);
        else if (f === "scores" && (typeof v !== "object" || Array.isArray(v))) {
          malformed.push(f);
        }
      }
      if (missing.length > 0 || malformed.length > 0) {
        console.warn("[take-pipeline] report_validation_failed", {
          take_id: takeId,
          missing_field_count: missing.length,
          malformed_field_count: malformed.length,
          fallback_used: twoStepFallbackUsed,
        });
        // If we already used the fallback renderer and the result is still
        // malformed, fail cleanly rather than running scrubs on garbage.
        if (twoStepFallbackUsed) {
          throw new AnalysisFailure(
            "analysis_parse_failed",
            "We couldn’t finish your report this time. Please try again.",
          );
        }
        // Otherwise, leave it — single-pass branch already produced
        // structured output, and downstream code defensively coerces.
      }
    }

    if (finaliseExceeded()) throwFinaliseTimeout("after_validation");

    console.log("[take-pipeline] finalising_postprocess_started", {
      take_id: takeId,
    });

    // ---- UK terminology pass on all string output ----
    report = ukifyDeep(report);

    // Capture the model's raw overall before any server recomputation.
    const overallScoreModel =
      typeof report.overall_score === "number" ? report.overall_score : null;

    // ---- Deterministic compliance vs signals (orientation/duration/audio) ----
    const signalsForCompliance = (take.signals ?? null) as
      | { orientation?: string; duration?: number; audio_peak?: number }
      | null;
    const complianceFlags = deterministicCompliance({
      extracted: extractedBrief,
      signals: signalsForCompliance,
    });

    // Compliance severity normalisation:
    // - Deterministic flags take priority over model-generated ones.
    // - Any deterministic high-severity flag participates in gating via the
    //   risk-flag pipeline below, so applyCapsAndLabel will trigger.
    // De-dupe: drop any model risk flag whose text duplicates a deterministic
    // compliance message (case-insensitive substring match either direction).
    const modelRiskFlagsRaw: Array<{ severity: "low" | "medium" | "high"; flag: string }> =
      Array.isArray(report.submission_risk_flags) ? report.submission_risk_flags : [];
    const complianceMessages = complianceFlags.map((c) => c.message.toLowerCase());
    const filteredModelRiskFlags = modelRiskFlagsRaw.filter((mf) => {
      const text = (mf.flag ?? "").toLowerCase();
      if (!text) return false;
      return !complianceMessages.some(
        (cm) => cm.includes(text) || text.includes(cm.slice(0, Math.min(40, cm.length))),
      );
    });
    // Deterministic flags ALWAYS go in first (priority order).
    const mergedRiskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }> = [
      ...complianceFlags.map((c) => ({ severity: c.severity, flag: c.message })),
      ...filteredModelRiskFlags,
    ];
    report.submission_risk_flags = mergedRiskFlags;

    // ---- Server-side overall score recomputation ----
    // Trust the model's per-category scores; recompute the weighted overall
    // deterministically using audition-type weights, then apply caps.
    if (finaliseExceeded()) throwFinaliseTimeout("before_score_recompute");
    const scoreRecomputeStartedAt = Date.now();
    console.log("[take-pipeline] finalising_score_recompute_started", {
      take_id: takeId,
    });
    const auditionType = (report.audition_type ?? "unknown") as AuditionType;
    const weights = weightsForType(auditionType);
    const modelScores = (report.scores ?? {}) as Record<string, number | null>;
    const recomputed = recomputeOverall(modelScores, weights);
    let overall = recomputed.overall || (report.overall_score as number) || 0;
    console.log("[take-pipeline] finalising_score_recompute_completed", {
      take_id: takeId,
      duration_ms: Date.now() - scoreRecomputeStartedAt,
    });

    const audioScore = modelScores.audio ?? 100;
    // Tiered audio caps mirror applyCapsAndLabel:
    //   <35 → 60, <50 → 62, <60 → 75
    if (audioScore < 35 && overall > 60) overall = 60;
    else if (audioScore < 50 && overall > 62) overall = 62;
    else if (audioScore < 60 && overall > 75) overall = 75;

    // Track safety-validator rewrites for downstream debugging/audit.
    let safetyRewriteApplied = false;

    // ---- Forbidden-language guard (shared across role-fit + presentation) ----
    // Catches identity, mobility, medical, class, and physicality-proxy terms.
    const FORBIDDEN_PATTERNS: RegExp[] = [
      // Identity
      /\battractive(ness)?\b/i,
      /\bweight\b/i,
      /\bbody\s*(shape|type)?\b/i,
      /\bskinny\b/i,
      /\bfat\b/i,
      /\b(over|under)weight\b/i,
      /\brace\b/i,
      /\bethnic(ity)?\b/i,
      /\bclass\b/i,
      /\bgender\s+(presentation|identity)\b/i,
      /\bmasculine\b/i,
      /\bfeminine\b/i,
      /\bage(d|ing)?\b/i,
      /\b(too )?old\b/i,
      /\b(too )?young\b/i,
      // Disability / mobility / medical
      /\bdisab(led|ility|ilities)\b/i,
      /\bwheelchair\b/i,
      /\bcrutch(es)?\b/i,
      /\bprosthe(tic|sis|ses)\b/i,
      /\bmobility\s+aid\b/i,
      /\bmedical\s+device\b/i,
      /\bassistive\s+(device|equipment)\b/i,
      /\bneurodivergen(t|ce)\b/i,
      /\bautis(tic|m)\b/i,
      // Physicality proxies (accessibility-safe rule)
      /\blimited\s+movement\b/i,
      /\brestricted\b/i,
      /\bconstrained\b/i,
      /\binsufficient\s+kinetic\s+range\b/i,
      /\bphysicality\s+underdeliver(ed|s)?\b/i,
      /\bmovement\s+limitation\b/i,
      /\brestricted\s+physicality\b/i,
      /\brange\s+of\s+motion\b/i,
      // Presentation proxies for medical/period devices
      /\bmodern\s+intrusion\b/i,
      /\bworld[-\s]?breaker\b/i,
      /\bperiod[-\s]?breaking\s+item\b/i,
      /\bdevice\s+visible\b/i,
      // Class / socioeconomic / appearance
      /\blook\s+the\s+part\b/i,
      /\blook(s|ed)?\s+right\b/i,
      /\bvisual\s+fit\b/i,
      /\bposh\b/i,
      /\bcommon\s+(accent|sounding)\b/i,
      /\buneducated\b/i,
      /\bcheap[-\s]?looking\b/i,
    ];
    const containsForbidden = (s: string): boolean =>
      typeof s === "string" && FORBIDDEN_PATTERNS.some((re) => re.test(s));

    // ---- Bounded role-fit modifier ----
    // Clamp to [-10, +5]. Force 0 in BASELINE mode. Apply AFTER the audio cap
    // so a strong role-fit nudge can't lift a tape past the audio ceiling.
    const overallBeforeRoleFit = overall;
    let roleFitModifier = 0;
    if (typeof report.role_fit_modifier === "number" && Number.isFinite(report.role_fit_modifier)) {
      roleFitModifier = Math.max(-10, Math.min(5, Math.round(report.role_fit_modifier)));
    }
    if (report.mode !== "brief") {
      roleFitModifier = 0;
    }
    if (typeof report.role_fit_notes !== "string") report.role_fit_notes = "";
    // Safety: if role_fit_notes contains forbidden language, strip the note
    // entirely AND zero the modifier — we won't apply an opaque/appearance-
    // based nudge to the score.
    if (report.role_fit_notes && containsForbidden(report.role_fit_notes)) {
      report.role_fit_notes = "";
      roleFitModifier = 0;
      safetyRewriteApplied = true;
    }
    // Re-apply audio cap after role-fit so role-fit cannot bypass it.
    const postRoleFit = overall + roleFitModifier;
    overall = Math.max(0, Math.min(100, postRoleFit));
    if (audioScore < 35 && overall > 60) overall = 60;
    else if (audioScore < 50 && overall > 62) overall = 62;
    else if (audioScore < 60 && overall > 75) overall = 75;
    report.role_fit_modifier = roleFitModifier;
    if (report.role_fit_confidence !== "low" && report.role_fit_confidence !== "medium" && report.role_fit_confidence !== "high") {
      report.role_fit_confidence = report.mode === "brief" ? "low" : "low";
    }
    if (report.mode !== "brief") {
      // BASELINE: blank role-fit notes — we have nothing to fit against.
      report.role_fit_notes = "";
      report.role_fit_confidence = "low";
    }

    // ---- Presentation notes — safety filter ----
    let presentationNotes: string[] = Array.isArray(report.presentation_notes)
      ? report.presentation_notes.filter(
          (n: unknown): n is string =>
            typeof n === "string" && n.trim().length > 0 && !containsForbidden(n),
        ).slice(0, 3)
      : [];
    if (
      Array.isArray(report.presentation_notes) &&
      presentationNotes.length < (report.presentation_notes as unknown[]).length
    ) {
      safetyRewriteApplied = true;
    }
    report.presentation_notes = presentationNotes;
    // Standard disclaimer surfaced alongside notes in the UI layer.
    report.presentation_notes_disclaimer =
      "These do not affect your score unless they make the tape difficult to see or break a specific brief instruction.";

    if (finaliseExceeded()) throwFinaliseTimeout("before_scrubs");
    const scrubsStartedAt = Date.now();
    console.log("[take-pipeline] finalising_scrubs_started", {
      take_id: takeId,
    });

    // ---- Strengths / improvements / fix_first / drills — safety scrub ----
    const scrubArray = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      const cleaned = arr.filter(
        (s: unknown): s is string =>
          typeof s === "string" && s.trim().length > 0 && !containsForbidden(s),
      );
      if (cleaned.length < arr.length) safetyRewriteApplied = true;
      return cleaned;
    };
    if (Array.isArray(report.strengths)) report.strengths = scrubArray(report.strengths);
    if (Array.isArray(report.improvements)) report.improvements = scrubArray(report.improvements);
    if (Array.isArray(report.coaching_drills)) report.coaching_drills = scrubArray(report.coaching_drills);
    if (typeof report.fix_first === "string" && containsForbidden(report.fix_first)) {
      report.fix_first = "";
      safetyRewriteApplied = true;
    }

    // ---- Alternative-material scrub ----
    // Only activates when the brief's material_policy is "fixed" — i.e. the
    // brief requires specific named material. In "choice" / "none" mode,
    // repertoire suggestions are allowed and we leave the report untouched.
    // Falls back to material_requested presence when material_policy is
    // missing (legacy briefs extracted before the helper landed).
    const extractedAny = (extractedBrief ?? {}) as {
      material_requested?: string | null;
      material_policy?: "fixed" | "choice" | "none";
    };
    const materialRequested = (extractedAny.material_requested ?? "").trim();
    const materialPolicy: "fixed" | "choice" | "none" =
      extractedAny.material_policy ??
      (materialRequested.length > 0 ? "fixed" : "none");

    // Patterns covering both direct alternatives and SOFT replacement
    // suggestions ("not the best choice", "another piece could showcase you
    // better", "different choice", etc.). Each pattern matches a phrase plus
    // surrounding sentence boundary so the rewrite reads cleanly.
    const ALT_MATERIAL_PATTERNS: RegExp[] = [
      /\b(choose|pick|select|use|try|consider)\s+(an?\s+)?(different|another|alternative)\s+(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\b(change|switch)\s+(to\s+)?(the\s+|a\s+|an\s+)?(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\b(?:may|might|would|could)?\s*not\s+(?:be\s+)?the\s+best\s+choice\b[^.!?]*[.!?]?/gi,
      /\b(better|more)\s+suited\b[^.!?]*[.!?]?/gi,
      /\b(could|would|might)\s+showcase\s+you\s+better\b[^.!?]*[.!?]?/gi,
      /\banother\s+(song|monologue|scene|piece|dance|routine|number|material)\b[^.!?]*[.!?]?/gi,
      /\bdifferent\s+(song|monologue|scene|piece|dance|routine|number|material|choice)\b[^.!?]*[.!?]?/gi,
      /\bchoose\s+something\s+else\b[^.!?]*[.!?]?/gi,
      /\bswitch\s+material\b[^.!?]*[.!?]?/gi,
      /\bpick\s+another\b[^.!?]*[.!?]?/gi,
    ];

    const containsMaterialReplacementSuggestion = (s: unknown): boolean =>
      typeof s === "string" && ALT_MATERIAL_PATTERNS.some((re) => re.test(s));

    const rewriteMaterialSuggestion = (s: string): string => {
      let out = s;
      for (const re of ALT_MATERIAL_PATTERNS) {
        out = out.replace(re, "Focus on strengthening the submitted material.");
      }
      return out.replace(/\s{2,}/g, " ").trim();
    };

    let materialScrubTriggered = false;

    if (materialPolicy === "fixed") {
      const stripAlt = (s: string): string => {
        if (!containsMaterialReplacementSuggestion(s)) return s;
        materialScrubTriggered = true;
        return rewriteMaterialSuggestion(s);
      };
      const stripAltArray = (arr: unknown): string[] => {
        if (!Array.isArray(arr)) return [];
        return (arr as unknown[])
          .map((x) => (typeof x === "string" ? stripAlt(x) : ""))
          .filter((s) => s.trim().length > 0);
      };
      if (Array.isArray(report.strengths)) report.strengths = stripAltArray(report.strengths);
      if (Array.isArray(report.improvements)) report.improvements = stripAltArray(report.improvements);
      if (Array.isArray(report.coaching_drills)) report.coaching_drills = stripAltArray(report.coaching_drills);
      if (typeof report.fix_first === "string") report.fix_first = stripAlt(report.fix_first);
      if (typeof report.casting_headline === "string") report.casting_headline = stripAlt(report.casting_headline);
      if (typeof report.casting_insight === "string") report.casting_insight = stripAlt(report.casting_insight);
      if (report.category_notes && typeof report.category_notes === "object") {
        const notes = report.category_notes as Record<string, unknown>;
        for (const k of Object.keys(notes)) {
          if (typeof notes[k] === "string") notes[k] = stripAlt(notes[k] as string);
        }
      }

      // Final server-side invariant: walk the entire report once more and
      // catch anything that slipped past the targeted field-level scrub.
      const assertNoMaterialSuggestions = (
        value: unknown,
      ): { value: unknown; violation: boolean } => {
        if (typeof value === "string") {
          if (containsMaterialReplacementSuggestion(value)) {
            return { value: rewriteMaterialSuggestion(value), violation: true };
          }
          return { value, violation: false };
        }
        if (Array.isArray(value)) {
          let v = false;
          const out = value.map((child) => {
            const r = assertNoMaterialSuggestions(child);
            if (r.violation) v = true;
            return r.value;
          });
          return { value: out, violation: v };
        }
        if (value && typeof value === "object") {
          let v = false;
          const out: Record<string, unknown> = {};
          for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
            const r = assertNoMaterialSuggestions(child);
            if (r.violation) v = true;
            out[k] = r.value;
          }
          return { value: out, violation: v };
        }
        return { value, violation: false };
      };

      const invariant = assertNoMaterialSuggestions(report);
      if (invariant.violation) {
        report = invariant.value as typeof report;
        materialScrubTriggered = true;
        console.warn(
          "[material-fidelity] assertNoMaterialSuggestions caught residual phrasing on a fixed-material report",
          { takeId },
        );
      }

      if (materialScrubTriggered) safetyRewriteApplied = true;
    }

    // Lightweight non-PII safety/invariant summary for downstream debugging.
    const durationOverridden =
      extractedBrief?.time_limit_source === "none" &&
      typeof (extractedBrief as { time_limit_seconds?: number | null } | null)?.time_limit_seconds !==
        "number";
    console.info("[process-take] safety/invariant summary", {
      takeId,
      material_policy: materialPolicy,
      material_scrub_triggered: materialScrubTriggered,
      duration_overridden: Boolean(durationOverridden),
      safety_rewrite_applied: safetyRewriteApplied,
    });

    // ---- Casting risk explanations — keep aligned with risk flags ----
    if (!Array.isArray(report.casting_risk_explanations)) {
      report.casting_risk_explanations = [];
    }
    // If the model produced explanations but the merged risk flags now include
    // deterministic flags it didn't see, top-up with a neutral default.
    const haveExplanations = new Set(
      (report.casting_risk_explanations as Array<{ flag?: string }>)
        .map((e) => (e.flag ?? "").toLowerCase().trim())
        .filter(Boolean),
    );
    for (const cf of complianceFlags) {
      const key = cf.message.toLowerCase().trim();
      if (haveExplanations.has(key)) continue;
      report.casting_risk_explanations.push({
        flag: cf.message,
        casting_impact:
          cf.severity === "high"
            ? "Casting will likely filter this out before recall — fix before sending."
            : cf.severity === "medium"
              ? "Casting will notice this. It can dent recall chances if other tapes are clean."
              : "Cosmetic — unlikely to affect recall on its own.",
        recall_impact:
          cf.severity === "high"
            ? "likely_to_block"
            : cf.severity === "medium"
              ? "may_reduce"
              : "unlikely_to_affect",
      });
    }

    // ---- Reconcile recall_impact ↔ flag severity ----
    // Authoritative direction: recall_impact wins.
    //  - likely_to_block  → upgrade matching flag to "high" (gates verdict).
    //  - unlikely_to_affect → downgrade matching flag to "low" so it cannot block.
    //  - may_reduce → keep at "medium" unless already higher (don't downgrade
    //    a deterministic high-severity compliance flag).
    const explanations = report.casting_risk_explanations as Array<{
      flag?: string;
      recall_impact?: "unlikely_to_affect" | "may_reduce" | "likely_to_block";
    }>;
    for (const exp of explanations) {
      const expText = (exp.flag ?? "").toLowerCase().trim();
      if (!expText) continue;
      const target = mergedRiskFlags.find((f) => {
        const ft = (f.flag ?? "").toLowerCase();
        return ft === expText || ft.includes(expText) || expText.includes(ft.slice(0, 40));
      });
      if (!target) continue;
      // Don't ever downgrade a deterministic compliance flag.
      const isDeterministic = complianceFlags.some(
        (cf) => cf.message.toLowerCase() === (target.flag ?? "").toLowerCase(),
      );
      if (exp.recall_impact === "likely_to_block") {
        target.severity = "high";
      } else if (exp.recall_impact === "unlikely_to_affect" && !isDeterministic) {
        target.severity = "low";
      } else if (exp.recall_impact === "may_reduce" && target.severity === "low" && !isDeterministic) {
        target.severity = "medium";
      }
    }
    report.submission_risk_flags = mergedRiskFlags;

    // ---- Score sanity guard ----
    // If the model's overall and the recomputed overall diverge by more than
    // 15 points, the model's number is unreliable for display. We've already
    // switched to the recomputed value; record the discrepancy for debugging.
    let scoreDiscrepancy: { delta: number; ignoredModel: boolean } | null = null;
    if (overallScoreModel != null) {
      const delta = Math.abs(overallScoreModel - overall);
      if (delta > 15) {
        scoreDiscrepancy = { delta, ignoredModel: true };
        console.warn("runProcessTake: large model/recomputed score delta", {
          takeId,
          model: overallScoreModel,
          recomputed: overall,
          delta,
        });
      }
    }

    // Cap improvements at 3 (most-impactful first) defensively.
    if (Array.isArray(report.improvements) && report.improvements.length > 3) {
      report.improvements = report.improvements.slice(0, 3);
    }

    // Deterministic, level-aware submission verdict (the canonical verdict).
    const verdict = computeSubmissionVerdict({
      overall,
      audioScore: modelScores.audio ?? null,
      technicalScore: modelScores.technical ?? null,
      briefAdherence: modelScores.brief_adherence ?? null,
      mode: report.mode,
      atRisk: report.at_risk === true,
      riskFlags: mergedRiskFlags,
      level: auditionLevel,
      scores: modelScores,
    });
    report.submission_verdict = verdict;

    // ---- Block reasons (user-facing, plain language) ----
    // Always populate when the verdict was capped/blocked, or when any
    // deterministic high-severity compliance flag is present.
    const blockReasons: string[] = [];
    const seenReasons = new Set<string>();
    const pushReason = (msg: string) => {
      const m = toUKTerms(msg).trim();
      if (!m) return;
      const key = m.toLowerCase();
      if (seenReasons.has(key)) return;
      seenReasons.add(key);
      blockReasons.push(m);
    };
    // Deterministic compliance flags first (priority).
    for (const cf of complianceFlags) {
      if (cf.severity === "high" || cf.severity === "medium") pushReason(cf.message);
    }
    // Then verdict-derived reasons (covers audio cap, brief adherence, weak categories).
    if (verdict.blocked || verdict.label === "Worth another take" || verdict.label === "Not ready yet") {
      const reason = verdict.reason;
      if (reason) pushReason(reason);
    }
    // Hard fallback: if verdict is non-positive but no reason, add a generic line.
    if (
      blockReasons.length === 0 &&
      (verdict.label === "Worth another take" || verdict.label === "Not ready yet")
    ) {
      pushReason("This take needs another pass before it's ready to send.");
    }

    // ---- Score–feedback alignment (defensive) ----
    // For "Not ready yet" and any blocked verdict, ensure fix_first references
    // a real issue. If improvements is empty but we're not ready, seed it from
    // block reasons so the user always sees something to act on.
    if (
      (verdict.label === "Not ready yet" || verdict.blocked) &&
      (!Array.isArray(report.improvements) || report.improvements.length === 0) &&
      blockReasons.length > 0
    ) {
      report.improvements = blockReasons.slice(0, 3);
    }
    if (
      (verdict.label === "Not ready yet" || verdict.blocked) &&
      (!report.fix_first || typeof report.fix_first !== "string") &&
      blockReasons.length > 0
    ) {
      report.fix_first = blockReasons[0];
    }

    // ---- Deterministic post-Step-2 quality scrubs ----
    // Runs for BOTH two-step and single-pass paths (single sync point).
    // Does NOT alter scores, verdict, caps, weights, thresholds, or
    // material-policy logic. Only rewrites/removes user-facing text that:
    //   - introduces clothing colour not locked in Step 1 evidence
    //   - invents page/line/script/"side" references the system never had
    //   - recommends frame-breaking on-camera movement against a static brief
    // Also rewrites "the side" -> "the scene" for user clarity.
    const qualityScrubResult = scrubReportQuality({
      report,
      evidence: twoStepEvidence,
      briefText: audition.brief ?? null,
      extractedBrief: extractedBrief ?? null,
    });
    for (const [field, count] of Object.entries(
      qualityScrubResult.visual_removed_per_field,
    )) {
      if (count > 0) {
        console.log("[take-pipeline] unsupported_visual_detail_removed", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(
      qualityScrubResult.page_rewritten_per_field,
    )) {
      if ((count as number) > 0) {
        console.log("[take-pipeline] source_reference_rewritten_to_timestamp", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(
      qualityScrubResult.side_rewritten_per_field,
    )) {
      if ((count as number) > 0) {
        console.log("[take-pipeline] unclear_industry_language_rewritten", {
          take_id: takeId,
          field,
          count,
        });
      }
    }
    for (const [field, count] of Object.entries(
      qualityScrubResult.framing_rewritten_per_field,
    )) {
      if (count > 0) {
        console.log("[take-pipeline] brief_incompatible_coaching_rewritten", {
          take_id: takeId,
          field,
          count,
        });
      }
    }

    // ---- Timestamp normalisation: validate, dedupe, sort, cap ----
    const tsNorm = normaliseTimestampedNotes(
      report,
      typeof take.mux_duration_seconds === "number"
        ? take.mux_duration_seconds
        : null,
    );
    if (tsNorm.reordered) {
      console.log("[take-pipeline] timestamp_order_normalised", {
        take_id: takeId,
        timestamped_evidence_count: tsNorm.finalCount,
      });
    }
    // Below-target observability for 3–5 minute tapes.
    {
      const dur =
        typeof take.mux_duration_seconds === "number"
          ? take.mux_duration_seconds
          : null;
      if (dur != null && dur >= 180 && dur <= 300) {
        const targetMin = timestampTargetMin(dur);
        if (tsNorm.finalCount < targetMin) {
          const ev = twoStepEvidence;
          const evCount = ev?.timestamped_evidence?.length ?? 0;
          const suff = ev?.evidence_sufficiency;
          const notAssessable =
            !!suff &&
            (!suff.audio_assessable ||
              !suff.video_assessable ||
              !suff.acting_assessable);
          let stage_where_count_was_lost:
            | "step1_underproduced"
            | "step2_dropped"
            | "validation_removed"
            | "not_assessable"
            | "unknown" = "unknown";
          if (notAssessable) {
            stage_where_count_was_lost = "not_assessable";
          } else if (evCount < targetMin) {
            stage_where_count_was_lost = "step1_underproduced";
          } else if (tsNorm.finalCount < evCount) {
            stage_where_count_was_lost = "validation_removed";
          } else {
            // Step1 had enough but final has fewer and validation didn't drop
            // them — implies the polish/locked-field path lost them.
            stage_where_count_was_lost = "step2_dropped";
          }
          console.log("[take-pipeline] timestamp_evidence_below_target", {
            take_id: takeId,
            video_duration_seconds: dur,
            timestamped_evidence_count: tsNorm.finalCount,
            target_min: targetMin,
            stage_where_count_was_lost,
            evidence_sufficiency: ev
              ? {
                  audio_assessable: !!ev.evidence_sufficiency.audio_assessable,
                  video_assessable: !!ev.evidence_sufficiency.video_assessable,
                  acting_assessable: !!ev.evidence_sufficiency.acting_assessable,
                  vocal_assessable: !!ev.evidence_sufficiency.vocal_assessable,
                  movement_assessable: !!ev.evidence_sufficiency.movement_assessable,
                  brief_assessable: !!ev.evidence_sufficiency.brief_assessable,
                  role_fit_assessable: !!ev.evidence_sufficiency.role_fit_assessable,
                }
              : null,
          });
        }
      }
    }


    report.overall_score_model = overallScoreModel;
    report.overall_score_final = overall;
    report.verdict_final = verdict.label;
    report.block_reasons = blockReasons;
    report.extraction_confidence = extractionConfidence;
    report.safety_rewrite_applied = safetyRewriteApplied;
    // Persist the recomputed overall back onto the report so UI is consistent.
    report.overall_score = overall;

    // ---- Feedback reliability correction (user-facing) ----
    // The UI computes a friendly Feedback reliability label from confidence +
    // a few signals. Previously it could downgrade to "Medium" with the reason
    // "the performance is short or partial" even when the tape contained the
    // required components and the internal confidence was high (the UI was
    // using a missing client-side signals.duration). Compute a server-side
    // override so the UI never shows that mismatch.
    {
      const dur =
        typeof take.mux_duration_seconds === "number" &&
        Number.isFinite(take.mux_duration_seconds)
          ? take.mux_duration_seconds
          : null;
      const conf = typeof report.confidence === "number" ? report.confidence : 0;
      const audioScore =
        typeof report.scores?.audio === "number" ? report.scores.audio : null;
      const techScore =
        typeof report.scores?.technical === "number"
          ? report.scores.technical
          : null;
      const components = Array.isArray(report.detected_components)
        ? report.detected_components
        : [];
      const hasBrief = report.mode === "brief";
      const suff = twoStepEvidence?.evidence_sufficiency;
      const suffOk =
        !!suff &&
        suff.audio_assessable &&
        suff.video_assessable &&
        suff.acting_assessable;
      const hasFullPerformance = (dur ?? 0) >= 60 && components.length > 0;

      // Reasons that legitimately downgrade reliability:
      const groundedConcerns: string[] = [];
      if (!hasBrief) groundedConcerns.push("no_brief");
      if (audioScore != null && audioScore < 50) groundedConcerns.push("poor_audio");
      else if (audioScore != null && audioScore < 75)
        groundedConcerns.push("muddy_audio");
      if (techScore != null && techScore < 50)
        groundedConcerns.push("poor_video");
      if (!hasFullPerformance) groundedConcerns.push("short_or_partial");
      if (suff && !suff.audio_assessable) groundedConcerns.push("audio_not_assessable");
      if (suff && !suff.video_assessable) groundedConcerns.push("video_not_assessable");
      if (suff && hasBrief && !suff.brief_assessable)
        groundedConcerns.push("brief_extraction_failed");

      let target: "high" | "medium" | "low";
      if (conf >= 85 && groundedConcerns.length === 0) target = "high";
      else if (conf >= 65 && groundedConcerns.length <= 1) target = "medium";
      else target = "low";

      const initialTarget: "high" | "medium" | "low" = target;

      // Detect mismatch: high confidence + good sufficiency + valid duration
      // but the UI would currently show Medium/Low only because the spurious
      // "short or partial" concern fires for a long, complete tape.
      const wouldShowSpuriousShortPartial =
        conf >= 85 && (dur ?? 0) >= 60 && components.length > 0 && suffOk;

      if (wouldShowSpuriousShortPartial && target !== "high") {
        const previous: "low" | "medium" = target;
        target = "high";
        // Persist hint for the UI.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_override = "high";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_reason_code = "confidence_high_full_tape";
        console.log("[take-pipeline] feedback_reliability_corrected", {
          take_id: takeId,
          previous_label: `Feedback reliability: ${previous === "medium" ? "Medium" : "Low"}`,
          corrected_label: "Feedback reliability: High",
          reason_code: "confidence_high_full_tape",
        });
      } else {
        // Persist the grounded label hint so the UI can prefer it over the
        // legacy client-side computation.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_override = target;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).feedback_reliability_reason_code =
          groundedConcerns[0] ?? "ok";
      }
    }

    // ---- Same-video score-stability monitoring (observability only) ----
    // Compare against the most recent completed prior take of the same
    // audition that uses the same Mux asset (same video). Logs a warning
    // when the final score moves >3 or the verdict flips. Never auto-corrects.
    try {
      const { data: priorTakes } = await supabaseAdmin
        .from("takes")
        .select(
          "id, overall_score, scores, report, score_breakdown, mux_asset_id, mux_playback_id",
        )
        .eq("audition_id", take.audition_id)
        .eq("status", "complete")
        .neq("id", takeId)
        .order("created_at", { ascending: false })
        .limit(5);
      const prior = (priorTakes ?? []).find((p) => {
        if (!p) return false;
        if (
          take.mux_asset_id &&
          p.mux_asset_id &&
          p.mux_asset_id === take.mux_asset_id
        )
          return true;
        if (
          take.mux_playback_id &&
          p.mux_playback_id &&
          p.mux_playback_id === take.mux_playback_id
        )
          return true;
        return false;
      });
      if (prior) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pr = (prior.report ?? {}) as any;
        const prevVerdict =
          (pr.verdict_final as string | undefined) ??
          (pr.submission_verdict?.label as string | undefined) ??
          "";
        const warn = computeConsistencyWarning({
          currentTakeId: takeId,
          currentOverall: overall,
          currentVerdict: verdict.label,
          currentScores: modelScores,
          currentRoleFitModifier: roleFitModifier,
          currentTimestampCount: Array.isArray(report.timestamped_notes)
            ? report.timestamped_notes.length
            : 0,
          previous: {
            take_id: prior.id,
            overall: Number(prior.overall_score ?? 0),
            verdict: prevVerdict,
            scores: (prior.scores ?? {}) as Record<string, number | null>,
            role_fit_modifier:
              typeof pr.role_fit_modifier === "number"
                ? pr.role_fit_modifier
                : 0,
            timestamp_count: Array.isArray(pr.timestamped_notes)
              ? pr.timestamped_notes.length
              : 0,
          },
        });
        if (warn.emit || warn.role_fit_modifier_delta > 2) {
          console.warn("[take-pipeline] analysis_consistency_warning", {
            take_id: takeId,
            previous_take_id: prior.id,
            final_score_delta: warn.final_score_delta,
            verdict_changed: warn.verdict_changed,
            category_delta_summary: warn.category_delta_summary,
            timestamp_count_delta: warn.timestamp_count_delta,
            role_fit_modifier_delta: warn.role_fit_modifier_delta,
          });
        }
      }
    } catch (cmpErr) {
      // Never fail the pipeline on a comparison miss.
      console.info("[take-pipeline] consistency_compare_skipped", {
        take_id: takeId,
        reason:
          cmpErr instanceof Error ? cmpErr.message.slice(0, 120) : "unknown",
      });
    }


    // ---- Score / verdict alignment (text-only) ----
    // Only adjusts wording (headline/insight) when it conflicts with the
    // locked verdict. Never changes scores or the verdict itself.
    const alignment = enforceScoreAlignment(
      report,
      verdict.label as VerdictLabel,
    );
    if (alignment.adjusted) {
      console.log("[take-pipeline] report_score_alignment_adjusted", {
        take_id: takeId,
        verdict_final: verdict.label,
        final_score: overall,
      });
    }

    // ---- Defensive final array caps (never exceed UI/report expectations) ----
    if (Array.isArray(report.strengths) && report.strengths.length > 3) {
      report.strengths = report.strengths.slice(0, 3);
    }
    if (Array.isArray(report.improvements) && report.improvements.length > 3) {
      report.improvements = report.improvements.slice(0, 3);
    }
    if (
      Array.isArray(report.presentation_notes) &&
      report.presentation_notes.length > 3
    ) {
      report.presentation_notes = report.presentation_notes.slice(0, 3);
    }
    if (
      Array.isArray(report.timestamped_notes) &&
      report.timestamped_notes.length > 8
    ) {
      report.timestamped_notes = report.timestamped_notes.slice(0, 8);
    }

    const scoreBreakdown = {
      audition_type: auditionType,
      level: auditionLevel,
      weights: recomputed.usedWeights,
      thresholds: bandsForLevel(auditionLevel),
      overall_score_model: overallScoreModel,
      overall_before_role_fit: overallBeforeRoleFit,
      role_fit_modifier: roleFitModifier,
      role_fit_modifier_explanation:
        roleFitModifier === 0
          ? "No role-fit adjustment applied."
          : `Role fit adjusted the score by ${roleFitModifier > 0 ? "+" : ""}${roleFitModifier} based on alignment with the brief's tone, energy, and intent.`,
      role_fit_confidence: report.role_fit_confidence,
      overall_score_final: overall,
      verdict_final: verdict.label,
      block_reasons: blockReasons,
      extraction_confidence: extractionConfidence,
      score_discrepancy: scoreDiscrepancy,
      compliance_flags: complianceFlags,
      presentation_notes_count: presentationNotes.length,
      safety_rewrite_applied: safetyRewriteApplied,
      material_policy: materialPolicy,
      material_scrub_triggered: materialScrubTriggered,
      // Compact, non-sensitive two-step pipeline summary. No raw evidence
      // text or model output. Only present when the two-step pipeline ran.
      two_step: isTwoStepEnabled()
        ? {
            enabled: true,
            evidence_version: "1",
            evidence_pass_duration_ms: evidencePassDurationMs,
            report_polish_duration_ms: reportPolishDurationMs,
            two_step_total_ai_duration_ms:
              evidencePassDurationMs + reportPolishDurationMs,
            timestamped_evidence_count:
              twoStepEvidence?.timestamped_evidence.length ?? 0,
            timestamped_evidence_dropped_count: twoStepTimestampsDropped,
            fallback_used: twoStepFallbackUsed,
            polish_fallback_reason: twoStepFallbackReason,
            locked_field_overwrite_count:
              twoStepEnforcement.locked_field_overwrites,
            unsupported_claims_removed_count:
              twoStepEnforcement.unsupported_claims_removed,
            unsupported_claims_rewritten_count:
              twoStepEnforcement.unsupported_claims_rewritten,
            evidence_sufficiency: twoStepEvidence
              ? {
                  audio_assessable:
                    !!twoStepEvidence.evidence_sufficiency.audio_assessable,
                  video_assessable:
                    !!twoStepEvidence.evidence_sufficiency.video_assessable,
                  acting_assessable:
                    !!twoStepEvidence.evidence_sufficiency.acting_assessable,
                  vocal_assessable:
                    !!twoStepEvidence.evidence_sufficiency.vocal_assessable,
                  movement_assessable:
                    !!twoStepEvidence.evidence_sufficiency.movement_assessable,
                  brief_assessable:
                    !!twoStepEvidence.evidence_sufficiency.brief_assessable,
                  role_fit_assessable:
                    !!twoStepEvidence.evidence_sufficiency.role_fit_assessable,
                }
              : null,
          }
        : { enabled: false },
    };

    console.log("[take-pipeline] finalising_scrubs_completed", {
      take_id: takeId,
      duration_ms: Date.now() - scrubsStartedAt,
    });
    console.log("[take-pipeline] finalising_postprocess_completed", {
      take_id: takeId,
      duration_ms: Date.now() - finalisingStartedAt,
    });

    // ---- Persist stage (timed, tagged, conditional) ----
    if (finaliseExceeded()) throwFinaliseTimeout("before_persist");
    const persistStartedAt = Date.now();
    metric("analysis_persist_started", { take_id: takeId });
    console.log("[take-pipeline] analysis_persist_started", baseLog);
    console.log("[take-pipeline] finalising_persist_started", {
      take_id: takeId,
    });

    if (finaliseExceeded()) {
      metric("analysis_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        reason: "post_ai_finalise_timeout",
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "Saving the report took too long. Please try again.",
      );
    }

    // Final cancellation guard: if the user cancelled while Gemini was
    // running, do NOT overwrite the cancelled state with a completed report.
    const { data: preWrite } = await supabaseAdmin
      .from("takes")
      .select("status, processing_phase, attempt_count, error_message")
      .eq("id", takeId)
      .single();
    if (
      !preWrite ||
      preWrite.status !== "processing" ||
      (preWrite.processing_phase !== "finalising" &&
        preWrite.processing_phase !== "analysing")
    ) {
      console.log("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite?.processing_phase ?? null,
        attempt_count: preWrite?.attempt_count ?? 0,
      });
      metric("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite?.processing_phase ?? null,
        reason: "state_changed_pre_write",
      });
      terminalWritten = true; // another path owns the terminal state
      return { ok: true, alreadyDone: true };
    }

    // Conditional update: only persist if the row is still in the exact
    // pre-write state (status=processing AND processing_phase=analysing).
    // If state changed (cancel, retry, reset, error) between the read above
    // and this write, the update affects 0 rows and we discard silently.
    let updatedRows: { id: string }[] | null = null;
    try {
      const updateRes = await supabaseAdmin
        .from("takes")
        .update({
          status: "complete",
          processing_phase: "complete",
          report,
          scores: report.scores,
          overall_score: overall,
          confidence: report.confidence,
          error_message: null,
          compliance_flags: complianceFlags as never,
          score_breakdown: scoreBreakdown as never,
        })
        .eq("id", takeId)
        .eq("status", "processing")
        .in("processing_phase", ["finalising", "analysing"])
        .select("id");
      if (updateRes.error) throw updateRes.error;
      updatedRows = updateRes.data ?? null;
      if (finaliseExceeded()) {
        metric("analysis_persist_failed", {
          take_id: takeId,
          duration_ms: Date.now() - persistStartedAt,
          reason: "post_ai_finalise_timeout_after_write",
        });
        throw new AnalysisFailure(
          "analysis_persist_failed",
          "Saving the report took too long. Please try again.",
        );
      }
    } catch (writeErr) {
      if (writeErr instanceof AnalysisFailure) throw writeErr;
      metric("analysis_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        reason:
          writeErr instanceof Error ? writeErr.message.slice(0, 120) : "persist_error",
      });
      console.error("[take-pipeline] analysis_persist_failed", writeErr);
      console.error("[take-pipeline] finalising_persist_failed", {
        take_id: takeId,
        duration_ms: Date.now() - persistStartedAt,
        finalising_duration_ms: finaliseElapsedMs(),
        reason:
          writeErr instanceof Error ? writeErr.message.slice(0, 120) : "persist_error",
      });
      throw new AnalysisFailure(
        "analysis_persist_failed",
        "We couldn't save the report. Please try again.",
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.log("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite.processing_phase,
        attempt_count: preWrite.attempt_count ?? 0,
      });
      metric("result_discarded_state_changed", {
        take_id: takeId,
        processing_phase: preWrite.processing_phase,
        reason: "conditional_update_zero_rows",
      });
      terminalWritten = true; // another path owns the terminal state
      return { ok: true, alreadyDone: true };
    }
    metric("analysis_persist_completed", {
      take_id: takeId,
      duration_ms: Date.now() - persistStartedAt,
    });
    console.log("[take-pipeline] analysis_persist_completed", {
      ...baseLog,
      duration_ms: Date.now() - persistStartedAt,
    });
    console.log("[take-pipeline] finalising_persist_completed", {
      take_id: takeId,
      duration_ms: Date.now() - persistStartedAt,
      finalising_duration_ms: finaliseElapsedMs(),
    });
    // Successful complete write — terminal state owned here.
    terminalWritten = true;

    await supabaseAdmin
      .from("auditions")
      .update({ mode: report.mode })
      .eq("id", audition.id);

    const totalDurationMs = Date.now() - runStartedAt;
    console.log("[take-pipeline] report persisted", {
      ...baseLog,
      analysis_tier: tier,
      total_duration_ms: totalDurationMs,
      elapsed_ms_since_upload: elapsedSinceCreatedMs(),
    });
    const e2eDurationMs = elapsedSinceCreatedMs();
    metric("analysis_completed", {
      take_id: takeId,
      processing_phase: "complete",
      duration_ms: e2eDurationMs,
      run_duration_ms: totalDurationMs,
      tier,
      within_10min: e2eDurationMs <= TEN_MINUTES_MS,
    });
    // analysis_total_duration is emitted unconditionally in finally.

    metric("analysis_terminal", {
      take_id: takeId,
      reason: "complete",
      duration_ms: e2eDurationMs,
      tier,
    });

    // Best-effort post-report Mux asset cleanup. Never fails the report:
    // any error path here is swallowed and surfaced via metric/log only.
    // The reconciler picks up any take where this didn't succeed.
    if (take.mux_asset_id) {
      try {
        await cleanupMuxAssetForCompletedTake({
          takeId,
          muxAssetId: take.mux_asset_id,
          reason: "report_complete",
        });
      } catch (cleanupErr) {
        // Hard guard: cleanup must never bubble up past report success.
        console.warn("[take-pipeline] mux_asset_delete_failed", {
          take_id: takeId,
          mux_asset_id: take.mux_asset_id,
          cleanup_reason: "report_complete",
          error_type:
            cleanupErr instanceof Error ? cleanupErr.name : typeof cleanupErr,
          status: null,
        });
      }
    }

    return { ok: true, tier };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("runProcessTake failed", message);
    // If the failure happened after we entered the finalising stage,
    // emit a dedicated marker so log-side dashboards can attribute hangs
    // to the right substage. `finaliseStartedAt` is initialised before
    // the AI call; any failure with a non-zero finalising elapsed time
    // is meaningful.
    try {
      if (finaliseStartedAt > 0) {
        console.warn("[take-pipeline] finalising_failed", {
          take_id: takeId,
          finalising_duration_ms: Date.now() - finaliseStartedAt,
          reason: message.slice(0, 120),
          two_step_enabled: isTwoStepEnabled(),
        });
      }
    } catch {
      /* never let logging mask the original failure */
    }
    metric("analysis_failed", {
      take_id: takeId,
      reason: message.slice(0, 120),
      duration_ms: Date.now() - runStartedAt,
    });

    // Route through markTerminalFailure when we have a tagged failure_code.
    // Otherwise write the legacy untagged error_message and tag the metric
    // stream as analysis_no_terminal_state-equivalent generic failure.
    if (err instanceof AnalysisFailure) {
      await markTerminalFailure(err.failureCode, message);
    } else if (!terminalWritten) {
      terminalWritten = true;
      try {
        await supabaseAdmin
          .from("takes")
          .update({ status: "error", processing_phase: "error", error_message: message })
          .eq("id", takeId);
      } catch (writeErr) {
        console.error("[take-pipeline] terminal write failed", writeErr);
      }
      metric("analysis_terminal", {
        take_id: takeId,
        reason: "uncoded_failure",
        duration_ms: Date.now() - runStartedAt,
      });
      console.warn("[take-pipeline] analysis_terminal", {
        take_id: takeId,
        failure_code: "uncoded_failure",
        message,
      });
    }
    return { ok: false, error: message };
  } finally {
    // Final safety net: if no terminal state was written by any path above
    // (success persist, discard, markTerminalFailure, or catch fallback),
    // force a terminal failure so the take never lingers indefinitely.
    if (!terminalWritten && !deferredPending) {
      try {
        await markTerminalFailure(
          "analysis_no_terminal_state",
          "Analysis ended without writing a terminal state. Please try again.",
        );
      } catch (finallyErr) {
        console.error("[take-pipeline] finally finaliser failed", finallyErr);
      }
    } else if (deferredPending) {
      console.log("[take-pipeline] runProcessTake deferred (cron will retry)", {
        take_id: takeId,
      });
    }
    // Always emit the run-level total duration so KPIs can include failures.
    metric("analysis_total_duration", {
      take_id: takeId,
      duration_ms: Date.now() - runStartedAt,
    });
  }
}
