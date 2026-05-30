// SERVER-ONLY. Step 2 of the two-step analysis pipeline.
//
// Text-only "polish" pass. Receives the locked Step 1 evidence (no video) and
// uses the existing REPORT_TOOL schema to produce a final structured report.
// Then runs locked-field enforcement (primary safeguard), conservative
// unsupported-claim handling, and a legacy emergency renderer for explicit
// AI-judgement-unavailable cases.

import type { EvidencePass } from "./evidence-pass.server";
import { isValidTimestamp } from "./evidence-pass.server";
import {
  buildPlainJsonReportInstruction,
  buildProviderToolForModel,
  classifyAiGatewayProviderError,
  parseProviderJsonObjectContent,
  selectReportProviderContract,
  type ProviderSafeErrorCategory,
  type ReportProviderContract,
} from "./provider-tool-schema.server";
import { extractAiTokenUsage, recordTakeAiUsage, type TakeAiUsageContext } from "./ai-usage.server";
import {
  S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION,
  S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION,
  S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
  S10_PROFESSIONAL_JUDGEMENT_SYSTEM_PROMPT,
  S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION,
  S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
  S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION,
  S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION,
} from "./s10-report-prompt-map.server";

const DEFAULT_MODEL = process.env.REPORT_POLISH_MODEL ?? "google/gemini-3-flash-preview";
const POLISH_AI_TIMEOUT_MS = 90_000;

export const POLISH_SYSTEM_PROMPT = `${S10_PROFESSIONAL_JUDGEMENT_SYSTEM_PROMPT}

You will NOT be given the video. You will be given a LOCKED EVIDENCE block from a prior pass that did watch the tape.

Rules:
- Active prompt version is "${S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION}".
- Active embedded brief-achievement prompt version is "${S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION}".
- Active embedded readiness/score prompt version is "${S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION}".
- Active embedded fix hierarchy / next-action prompt version is "${S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION}".
- Active embedded strengths / preserve / professional critique prompt version is "${S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION}".
- Active embedded technique-library commentary prompt version is "${S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION}".
- Active embedded timestamped/time-banded commentary prompt version is "${S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION}".
- Use ONLY the supplied evidence as factual ground truth. Do NOT invent observations the evidence does not support.
- Before writing score, verdict, readiness, detected_components, strengths, improvements, priority_fixes or category_rationale, produce brief_achievement_matrix by comparing required brief components against the locked observed component evidence.
- Matrix-before-scoring is mandatory: BriefRequirement[] plus observed_tape_sequence, component_verifications and media_observation_summary determine requirement achievement before any score/chip/verdict/readiness wording.
- Produce readiness_score_judgement after brief_achievement_matrix. S10.4 is authoritative for brief completion. Separate performance quality, brief completion and overall submission readiness; legacy score fields are diagnostic only.
- Produce s10_fix_hierarchy and s10_next_action_plan after readiness_score_judgement. Matrix-before-fixes and readiness-before-action-plan are mandatory. Mandatory material/package blockers outrank polish, diction, character detail, file naming and admin-only final checks. Legacy fixes/actions are diagnostic only and generic fallback action copy is forbidden.
- Produce s10_professional_critique after s10_fix_hierarchy and s10_next_action_plan. Component verification before strengths is mandatory: do not praise absent or unverified components, use limitations instead, and make partial/cut-off song strengths observed-portion-only.
- Legacy strengths/category notes/coaching drills/technique traces/prior prose are diagnostic only and cannot create S10 strengths unless re-authored through S10 observed evidence.
- Produce s10_technique_commentary after s10_professional_critique. Verified component evidence before technique commentary is mandatory: attempt technique commentary where verified evidence exists; required-but-missing components are not_assessable or limited, not not_applicable; present-but-incomplete components are partially_assessable and observed-portion-only. public_technique_authority_status and public_technique_authority_blocked must not suppress ordinary authenticated technique commentary. Legacy technique traces/category prose/coaching drills are diagnostic only.
- Produce s10_timestamped_commentary after s10_technique_commentary. Verified component evidence before timestamped commentary is mandatory. Timestamped commentary cannot prove component presence; it may only annotate components already verified, partial, uncertain, missing or not assessable in S10.3/S10.4. Exact timestamps require trusted timing support from observed_tape_sequence, media-observed timestamped_evidence, evidence anchors or provider output tied to verified component evidence. If exact timestamps are unavailable, use time-banded/order-only/not-observed notes. raw_report.timestamped_notes and prior prose are diagnostic only.
- raw_report, detected_components, legacy brief_adherence_breakdown/material_compliance, score traces and previous report prose are diagnostic only; they cannot mark a requirement achieved or override brief_achievement_matrix.
- Keep continuous-video technical evidence separate from complete required-material package evidence: a continuous clip is not a complete package if mandatory material is missing, partial or cut off.
- If required material is absent, partial, cut off, uncertain or not assessable, make that the readiness driver. Do not call the take "strong for this level" as a complete submission.
- Do NOT rely on generic fallback copy. If a module cannot be supported by evidence, mark the limitation specifically and state the exact next recording/check action.
- Preserve the existing Step 1 timestamped_notes lock: do NOT directly add new legacy timestamped_notes that are not in evidence.timestamped_evidence and do NOT change their timestamps. Put new first-class time-based work in s10_timestamped_commentary; S10.9 validation will project only safe notes after this model call.
- Do NOT add new submission_risk_flags that the evidence does not support.
- Do NOT add new presentation_notes that the evidence does not support. Visual claims about clothing, "top", "shirt", "your top provides contrast", "solid colour of your top", background colour, or any wardrobe/contrast claim must NOT appear unless that exact claim is locked in evidence.presentation_evidence. When in doubt, omit. Acceptable safe wording when there is no locked visual evidence: "the frame is clean and easy to read", "the background does not distract from the performance", "the performer remains visually clear throughout".
- Do NOT add new role_fit claims beyond the supplied role_fit_evidence.
- Do NOT introduce ANY new visual detail not present in evidence — including clothing colour. If a colour is not stated in the locked evidence, do not name a colour. Prefer colour-neutral wording: "the performer separates clearly from the background", "the framing is clean and easy to read", "the background keeps focus on the performance".
- Prefer TIMESTAMPS and neutral moment descriptions over page/line/"side" references in user-facing text. Even if the brief explicitly contains page references (e.g. "Side 1, pages 85–87"), the final report should prefer wording like "during the longer speech in the acting scene", "around 02:14", or "in the scene before the song" over "on page 86" or "in the side". Page references may be retained ONLY when they materially help the performer and ONLY when they are within the page range explicitly given in the brief. NEVER invent page or line numbers the brief does not provide.
- Replace unclear standalone "side" jargon with clearer wording for non-industry users: "the requested side" → "the requested Side 1 acting scene" (when the brief explicitly says Side 1) or "the requested acting scene"; "the side and the song" → "the acting scene and the song"; "in the side" → "in the acting section"; bare "the side" → "the acting scene". "Side 1" is acceptable when the brief explicitly uses it.
- If the brief requires head-and-shoulders, close-up, medium close-up, fixed/static framing, or any "self-tape framing" / "camera-led" instruction, do NOT recommend on-camera movement or staging that breaks the frame in the RECORDED take. Specifically forbidden as recorded-take advice: standing up to record/perform/sing, walking, moving around the room, packing a bag, crossing the room, holding an instrument or microphone or any prop on camera, using props, physical tasks, recording while moving, recording while standing, adding staging, adding blocking, adding business, or moving out of frame. These are allowed ONLY when explicitly framed as "rehearsal-only" or "off-camera rehearsal" exercises, and you MUST then also give a recorded-take alternative that preserves the required head-and-shoulders frame (use breath, stillness, eyeline changes, thought-shifts, intention shifts).
- Use British English throughout (recall not callback, casting brief, self-tape, analysing, prioritised, behaviour, centre, colour).
- Be specific, prioritised, supportive — preserve the useful richness of the old report surface without preserving false-positive logic.
- Apply the supplied performer level as the assessment standard, not as tone; populate selected_level_calibration with what meets the level, what falls short and how the score/recommendation should be interpreted at that level.
- NEVER comment on appearance, body, age, race, class, disability, mobility aids, medical devices, or socioeconomic status.
- Respect evidence_sufficiency. If audio_assessable=false, do not praise vocal detail. If video_assessable=false, do not praise micro-expression. If brief_assessable=false or role_fit_assessable=false, leave role_fit_notes empty.
- presentation_notes are OPTIONAL. Leave the array empty when there is nothing materially useful to say. Do not pad with generic praise such as "looks professional".
- "Fix this first" must be the SINGLE highest-impact actionable note from s10_fix_hierarchy. If mandatory material is missing, that must outrank optional performance polish, file naming, diction, character detail and admin-only checks.
- Volume targets (do NOT pad, do NOT artificially shorten when the evidence supports more): strengths 3–8 (max 12), improvements 3–10 (max 15), priority_fixes 2–5 (max 8), next_take_plan items 4–10 (max 15), presentation_notes max 6, s10_timestamped_commentary notes duration-scaled (<60s 3–5; 1–3m 6–10; 3–5m 8–14; 5–10m 12–24; 10m+ 18–36; absolute max 36). Legacy timestamped_notes must remain locked to Step 1 evidence until S10.9 validation projects safe notes. Coaching_drills as the schema allows. S10.8 technique-library commentary may link timestamp refs where available, but S10.9 owns first-class timestamped/time-banded commentary.
- Populate priority_fixes (2–5 prioritised fixes with kind tag) and next_take_plan (steps[] and optionally groups[]) when the evidence supports them. Do not duplicate improvements verbatim unless that is the clearest formulation.
- Populate category_rationale[<key>] for every category whose score is < 100: what_works, why_not_full_score, close_gap. For scores >= 90 also write standout_delta. Discipline-specific language; never generic praise; reserve 98–100 for near-flawless evidence; high scores must NOT reduce feedback volume; a 95 still gets a marginal improvement pathway.
- Discipline depth: DANCE — cite movement evidence (rhythm/timing, control, spatial pathway, dynamics, performance intention); never invent style/subtype; never claim foot/leg cropping without timestamped evidence; no MT-role/employer language. MT — preserve Acting Scene + Song; cite acting-through-song with lyric/phrase/beat/transition; vocal distinguishes technique from story/style. Never use castability/recall/workshop/live-room/buyer overclaim.
- Return ONLY via the submit_audition_report tool.`;

export type RunReportPolishArgs = {
  apiKey: string;
  signal: AbortSignal;
  evidence: EvidencePass;
  briefBlock: string;
  extractedBlock: string;
  briefContext?: unknown;
  briefRequirements?: unknown[] | null;
  signalsBlock: string;
  levelBlock: string;
  auditionTitle: string;
  reportTool: unknown;
  model?: string;
  usageContext?: TakeAiUsageContext;
};

export type RunReportPolishResult =
  | {
      ok: true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      report: any;
      durationMs: number;
      model: string;
      httpStatus: number;
    }
  | {
      ok: false;
      httpStatus: number | null;
      error: string;
      safe_error_category: ProviderSafeErrorCategory;
      durationMs: number;
      model: string;
    };

/** Build the locked-evidence block sent to the polish model (text-only). */
export function buildEvidenceBlock(
  ev: EvidencePass,
  s10Brief?: { briefContext?: unknown; briefRequirements?: unknown[] | null },
): string {
  return `LOCKED EVIDENCE (Step 1 — authoritative, do not contradict):\n${JSON.stringify(
    {
      brief_context: s10Brief?.briefContext ?? null,
      brief_requirements: s10Brief?.briefRequirements ?? [],
      evidence_version: ev.evidence_version,
      audition_type: ev.audition_type,
      detected_components: ev.detected_components,
      observed_tape_sequence: ev.observed_tape_sequence ?? [],
      component_verifications: ev.component_verifications ?? [],
      media_observation_summary: ev.media_observation_summary ?? null,
      raw_scores: ev.raw_scores,
      core_strengths_evidence: ev.core_strengths_evidence,
      core_improvements_evidence: ev.core_improvements_evidence,
      fix_first_evidence: ev.fix_first_evidence,
      brief_adherence_evidence: ev.brief_adherence_evidence,
      category_notes_evidence: ev.category_notes_evidence,
      role_fit_evidence: ev.role_fit_evidence,
      role_fit_modifier_suggested: ev.role_fit_modifier_suggested,
      role_fit_confidence: ev.role_fit_confidence,
      presentation_evidence: ev.presentation_evidence,
      risk_evidence: ev.risk_evidence,
      timestamped_evidence: ev.timestamped_evidence,
      evidence_sufficiency: ev.evidence_sufficiency,
    },
    null,
    2,
  )}`;
}

export function buildReportPolishRequestBodyForProvider(input: {
  model: string;
  systemPrompt: string;
  userText: string;
  reportTool: unknown;
  providerContract?: ReportProviderContract;
}): Record<string, unknown> {
  const providerContract = input.providerContract ?? selectReportProviderContract(input.model);
  const base = {
    model: input.model,
    temperature: 0.2,
    top_p: 1,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          providerContract === "plain_json_report"
            ? `${input.systemPrompt}\n\n${buildPlainJsonReportInstruction()}`
            : input.systemPrompt,
      },
      { role: "user", content: input.userText },
    ],
  };

  if (providerContract === "plain_json_report") return base;

  const reportTool = buildProviderToolForModel(input.reportTool, input.model);
  return {
    ...base,
    tools: [reportTool],
    tool_choice: {
      type: "function",
      function: { name: "submit_audition_report" },
    },
  };
}

export async function runReportPolish(args: RunReportPolishArgs): Promise<RunReportPolishResult> {
  const model = args.model ?? DEFAULT_MODEL;
  const providerContract = selectReportProviderContract(model);
  const startedAt = Date.now();
  const recordUsage = async (input: {
    status: "success" | "failure" | "timeout";
    httpStatus?: number | null;
    failureReason?: string | null;
    tokenPayload?: unknown;
  }) => {
    if (!args.usageContext) return;
    await recordTakeAiUsage({
      ...args.usageContext,
      step: "report_polish",
      model,
      promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
      providerContract,
      status: input.status,
      httpStatus: input.httpStatus,
      failureReason: input.failureReason,
      latencyMs: Date.now() - startedAt,
      tokenUsage: extractAiTokenUsage(input.tokenPayload),
      metadata: {
        source_stage: "analysis_step_2_report_polish",
      },
    });
  };

  const evidenceBlock = buildEvidenceBlock(args.evidence, {
    briefContext: args.briefContext,
    briefRequirements: args.briefRequirements,
  });

  const userText = [
    `Audition title: ${args.auditionTitle}`,
    args.levelBlock,
    args.briefBlock,
    args.extractedBlock,
    args.signalsBlock,
    evidenceBlock,
    "Write the final structured report via submit_audition_report. Use the locked evidence as ground truth. Produce brief_achievement_matrix before scoring or recommending by comparing the S10 BriefRequirement list with observed_tape_sequence, component_verifications and media_observation_summary; then produce readiness_score_judgement with separate performance_quality_score, brief_completion_score and overall_submission_readiness_score; then produce s10_fix_hierarchy and s10_next_action_plan with matrix-before-fixes and readiness-before-action-plan; then produce s10_professional_critique with component verification before strengths; then produce s10_technique_commentary with verified component evidence before technique commentary; then produce s10_timestamped_commentary with verified component evidence before timestamped commentary. If the requirement list is missing while a supplied brief exists, extract explicit requirements first and do not score from generic material presence. Do not invent fake timestamps, risk flags, presentation notes, role-fit claims, generic fix copy, strengths for absent/unverified components, technique commentary for absent/unverified components, or timestamped notes for absent/unverified components. Respect evidence_sufficiency and mark unsupported modules as not assessable rather than filling with generic copy.",
  ].join("\n\n");

  let resp: Response | null = null;
  const fetchController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    fetchController.abort("report_polish_timeout");
  }, POLISH_AI_TIMEOUT_MS);
  const abortFromCaller = () => {
    fetchController.abort(args.signal.reason ?? "report_polish_aborted");
  };
  if (args.signal.aborted) abortFromCaller();
  else args.signal.addEventListener("abort", abortFromCaller, { once: true });

  try {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildReportPolishRequestBodyForProvider({
          model,
          systemPrompt: POLISH_SYSTEM_PROMPT,
          userText,
          reportTool: args.reportTool,
          providerContract,
        }),
      ),
      signal: fetchController.signal,
    });
  } catch (err) {
    const error = timedOut
      ? "report_polish_timeout"
      : err instanceof Error
        ? err.message
        : "network_error";
    await recordUsage({
      status: timedOut || args.signal.aborted ? "timeout" : "failure",
      httpStatus: null,
      failureReason: error,
    });
    return {
      ok: false,
      httpStatus: null,
      error,
      safe_error_category: classifyAiGatewayProviderError(null, error),
      durationMs: Date.now() - startedAt,
      model,
    };
  } finally {
    clearTimeout(timeoutId);
    args.signal.removeEventListener("abort", abortFromCaller);
  }

  if (!resp.ok) {
    let body = "";
    try {
      body = await resp.text();
    } catch {
      /* ignore */
    }
    await recordUsage({
      status: "failure",
      httpStatus: resp.status,
      failureReason: `report_polish_http_${resp.status}`,
    });
    return {
      ok: false,
      httpStatus: resp.status,
      error: `report_polish_http_${resp.status}: ${body.slice(0, 1000)}`,
      safe_error_category: classifyAiGatewayProviderError(resp.status, body),
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  let tokenPayload: unknown = null;
  try {
    const json = await resp.json();
    tokenPayload = json;
    const choice = json.choices?.[0];
    if (providerContract === "plain_json_report") {
      const report = parseProviderJsonObjectContent(choice?.message?.content);
      await recordUsage({
        status: "success",
        httpStatus: resp.status,
        tokenPayload,
      });
      return {
        ok: true,
        report,
        durationMs: Date.now() - startedAt,
        model,
        httpStatus: resp.status,
      };
    }

    const tc = choice?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      await recordUsage({
        status: "failure",
        httpStatus: resp.status,
        failureReason: "report_polish_no_tool_call",
        tokenPayload,
      });
      return {
        ok: false,
        httpStatus: resp.status,
        error: "report_polish_no_tool_call",
        safe_error_category: classifyAiGatewayProviderError(
          resp.status,
          "report_polish_no_tool_call",
        ),
        durationMs: Date.now() - startedAt,
        model,
      };
    }
    const report = JSON.parse(tc.function.arguments);
    await recordUsage({
      status: "success",
      httpStatus: resp.status,
      tokenPayload,
    });
    return {
      ok: true,
      report,
      durationMs: Date.now() - startedAt,
      model,
      httpStatus: resp.status,
    };
  } catch (err) {
    await recordUsage({
      status: "failure",
      httpStatus: resp.status,
      failureReason: err instanceof Error ? err.message : "report_polish_parse_error",
      tokenPayload,
    });
    return {
      ok: false,
      httpStatus: resp.status,
      error: err instanceof Error ? err.message : "report_polish_parse_error",
      safe_error_category: classifyAiGatewayProviderError(resp.status, err),
      durationMs: Date.now() - startedAt,
      model,
    };
  }
}

// ---------- Locked-field enforcement (PRIMARY safeguard) ----------

/**
 * Overwrite locked fields on the polished report from Step 1 evidence.
 * The orchestrator will still run its existing recompute / caps /
 * material-policy passes after this.
 *
 * Public timestamped_notes shape stays { timestamp, note }. We construct
 * the public note as `observation + " — " + why_it_matters`, allowing the
 * polish pass to slightly rephrase as long as it preserves the timestamp.
 */
export function enforceLockedFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  evidence: EvidencePass,
): { overwrites: number } {
  let overwrites = 0;
  const set = (key: string, value: unknown) => {
    if (JSON.stringify(report[key]) !== JSON.stringify(value)) {
      report[key] = value;
      overwrites += 1;
    }
  };

  set("audition_type", evidence.audition_type);
  set("detected_components", evidence.detected_components);
  set("scores", { ...evidence.raw_scores });

  // Build public timestamped_notes from locked evidence, preserving any
  // polish rephrasing on a per-timestamp basis.
  const allowed = new Map<string, string>();
  for (const t of evidence.timestamped_evidence) {
    if (!isValidTimestamp(t.timestamp)) continue;
    const obs = (t.observation ?? "").trim();
    const why = (t.why_it_matters ?? "").trim();
    if (!obs || !why) continue;
    // Merge if observation and why are essentially the same idea.
    const publicNote =
      obs.toLowerCase() === why.toLowerCase() || why.toLowerCase().includes(obs.toLowerCase())
        ? why
        : `${obs} — ${why}`;
    allowed.set(t.timestamp, publicNote);
  }
  const polishedNotes: Array<{ timestamp: string; note: string }> = Array.isArray(
    report.timestamped_notes,
  )
    ? report.timestamped_notes
    : [];
  const finalNotes: Array<{ timestamp: string; note: string }> = [];
  for (const [ts, evNote] of allowed.entries()) {
    const polished = polishedNotes.find(
      (n) => typeof n?.timestamp === "string" && n.timestamp === ts,
    );
    finalNotes.push({
      timestamp: ts,
      note:
        polished && typeof polished.note === "string" && polished.note.trim().length > 0
          ? polished.note
          : evNote,
    });
  }
  set("timestamped_notes", finalNotes.slice(0, 36));

  return { overwrites };
}

// ---------- Conservative unsupported-claim enforcement ----------

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "at",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "as",
  "from",
  "into",
  "over",
  "under",
  "than",
  "then",
  "so",
  "if",
  "when",
  "while",
  "very",
  "more",
  "less",
  "most",
  "least",
  "you",
  "your",
  "they",
  "their",
  "we",
  "our",
  "i",
  "my",
  "me",
]);

function tokenise(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function overlapScore(claim: string, evidenceCorpus: string[]): number {
  const claimTokens = new Set(tokenise(claim));
  if (claimTokens.size === 0) return 0;
  let hits = 0;
  for (const t of claimTokens) {
    if (evidenceCorpus.some((e) => e.includes(t))) hits += 1;
  }
  return hits / claimTokens.size;
}

function closestEvidence(claim: string, evidenceLines: string[]): string | null {
  let best: { line: string; score: number } | null = null;
  for (const line of evidenceLines) {
    const score = overlapScore(claim, [line.toLowerCase()]);
    if (!best || score > best.score) best = { line, score };
  }
  return best && best.score > 0 ? best.line : null;
}

/** Return all observation-grounded text lines from evidence. */
function evidenceCorpusLines(ev: EvidencePass): string[] {
  return [
    ...ev.core_strengths_evidence.map((s) => s.evidence ?? ""),
    ...ev.core_improvements_evidence.map((s) => s.evidence ?? ""),
    ev.fix_first_evidence ?? "",
    ...Object.values(ev.category_notes_evidence ?? {}),
    ...Object.values(ev.brief_adherence_evidence ?? {}).filter(
      (v): v is string => typeof v === "string",
    ),
    ev.role_fit_evidence ?? "",
    ...ev.presentation_evidence,
    ...ev.risk_evidence.map((r) => `${r.flag}. ${r.why}`),
    ...ev.timestamped_evidence.map((t) => `${t.observation} ${t.why_it_matters}`),
    ...ev.detected_components.map((c) => c.note ?? ""),
  ].filter((s) => typeof s === "string" && s.length > 0);
}

/**
 * Conservative unsupported-claim enforcement.
 *
 * Strict (drop new entries that don't appear in evidence):
 *   - submission_risk_flags
 *   - presentation_notes
 *   - role_fit_notes
 *   - (timestamped_notes already enforced via locked fields above)
 *
 * Soft (rewrite, never delete on overlap alone):
 *   - strengths
 *   - improvements
 *   Deleted ONLY if directly contradicted by evidence_sufficiency (e.g.
 *   praises vocal detail when audio_assessable=false).
 */
export function enforceUnsupportedClaims(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  evidence: EvidencePass,
): { removed: number; rewritten: number; per_field_removed: Record<string, number> } {
  let removed = 0;
  let rewritten = 0;
  const per_field_removed: Record<string, number> = {};
  const bumpRemoved = (field: string) => {
    per_field_removed[field] = (per_field_removed[field] ?? 0) + 1;
    removed += 1;
  };

  const corpusLower = evidenceCorpusLines(evidence).map((s) => s.toLowerCase());

  // ---- Strict: submission_risk_flags ----
  if (Array.isArray(report.submission_risk_flags)) {
    const riskCorpus = [
      ...evidence.risk_evidence.map((r) => `${r.flag} ${r.why}`.toLowerCase()),
      ...corpusLower,
    ];
    const filtered = report.submission_risk_flags.filter(
      (rf: { severity?: string; flag?: string }) => {
        if (!rf || typeof rf.flag !== "string") return false;
        const score = overlapScore(rf.flag, riskCorpus);
        const ok = score >= 0.4;
        if (!ok) bumpRemoved("submission_risk_flags");
        return ok;
      },
    );
    report.submission_risk_flags = filtered;
  }

  // ---- Strict: presentation_notes ----
  if (Array.isArray(report.presentation_notes)) {
    const presCorpus = [
      ...evidence.presentation_evidence.map((s) => s.toLowerCase()),
      ...corpusLower,
    ];
    const filtered = report.presentation_notes.filter((n: unknown) => {
      if (typeof n !== "string" || n.trim().length === 0) return false;
      const score = overlapScore(n, presCorpus);
      const ok = score >= 0.4;
      if (!ok) bumpRemoved("presentation_notes");
      return ok;
    });
    report.presentation_notes = filtered.slice(0, 6);
  }

  // ---- Strict-ish: role_fit_notes ----
  if (typeof report.role_fit_notes === "string" && report.role_fit_notes.trim().length > 0) {
    const roleAssessable =
      !!evidence.evidence_sufficiency?.role_fit_assessable &&
      !!evidence.evidence_sufficiency?.brief_assessable;
    const roleEvidence = (evidence.role_fit_evidence ?? "").trim();
    if (!roleAssessable || roleEvidence.length === 0) {
      if (report.role_fit_notes !== "") {
        report.role_fit_notes = "";
        bumpRemoved("role_fit_notes");
      }
    } else {
      const score = overlapScore(report.role_fit_notes, [roleEvidence.toLowerCase()]);
      if (score < 0.3) {
        const replacement = `Role fit, based on observable evidence: ${roleEvidence}`;
        if (report.role_fit_notes !== replacement) {
          report.role_fit_notes = replacement;
          rewritten += 1;
        }
      }
    }
  }

  // ---- Soft: strengths / improvements ----
  const suff = evidence.evidence_sufficiency;
  const sufficiencyContradicts = (claim: string): boolean => {
    const c = claim.toLowerCase();
    if (
      !suff?.audio_assessable &&
      /\b(audio|sound|clear voice|diction|projection|vocal detail|tone|pitch)\b/.test(c) &&
      /\b(strong|excellent|great|clear|good|crisp|rich|warm)\b/.test(c)
    ) {
      return true;
    }
    if (
      !suff?.video_assessable &&
      /\b(eye(line|s)?|expression|face|micro[- ]expressions?|stillness|presence)\b/.test(c) &&
      /\b(strong|excellent|great|good|clear|specific)\b/.test(c)
    ) {
      return true;
    }
    if (
      !suff?.movement_assessable &&
      /\b(movement|physicality|gesture|choreo|dance|body)\b/.test(c) &&
      /\b(strong|excellent|great|good|clear|specific)\b/.test(c)
    ) {
      return true;
    }
    if (
      !suff?.vocal_assessable &&
      /\b(vocal|sing(ing)?|tone|pitch|breath|support|riff)\b/.test(c) &&
      /\b(strong|excellent|great|clear|good)\b/.test(c)
    ) {
      return true;
    }
    return false;
  };

  const corpusForOverlap = corpusLower;
  const evidenceLines = evidenceCorpusLines(evidence);

  const softProcess = (arr: unknown, fieldName: string): string[] => {
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const raw of arr) {
      if (typeof raw !== "string" || raw.trim().length === 0) continue;
      if (sufficiencyContradicts(raw)) {
        bumpRemoved(fieldName);
        continue;
      }
      const score = overlapScore(raw, corpusForOverlap);
      if (score >= 0.3) {
        out.push(raw);
      } else {
        const closest = closestEvidence(raw, evidenceLines);
        if (closest) {
          out.push(closest);
          rewritten += 1;
        } else {
          out.push(raw);
        }
      }
    }
    return out;
  };

  if (Array.isArray(report.strengths)) {
    report.strengths = softProcess(report.strengths, "strengths").slice(0, 12);
  }
  if (Array.isArray(report.improvements)) {
    report.improvements = softProcess(report.improvements, "improvements").slice(0, 15);
  }

  return { removed, rewritten, per_field_removed };
}

// ---------- Score / verdict alignment ----------

export type VerdictLabel =
  | "Strong for this level"
  | "Ready to submit"
  | "Worth another take"
  | "Not ready yet";

/**
 * Adjust wording (NOT scores, NOT verdicts) so the report's tone aligns with
 * the locked final verdict.
 *
 * - Strong for this level: tone should be refinement-focused.
 * - Ready to submit: positive, but still has clear improvements.
 * - Worth another take: clearly explains why another take is useful.
 * - Not ready yet: direct, practical, not falsely encouraging.
 */
export function enforceScoreAlignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  verdict: VerdictLabel,
): { adjusted: boolean } {
  let adjusted = false;
  const ensureHeadline = (prefix: string) => {
    const cur = typeof report.casting_headline === "string" ? report.casting_headline : "";
    if (!cur.toLowerCase().startsWith(prefix.toLowerCase())) {
      report.casting_headline = `${prefix} ${cur}`.trim();
      adjusted = true;
    }
  };

  if (verdict === "Strong for this level") {
    // No false blockers in the headline.
    if (
      typeof report.casting_headline === "string" &&
      /\b(not ready|blocked|reject|fails?|cannot)\b/i.test(report.casting_headline)
    ) {
      report.casting_headline = "This tape is strong for the performer's level.";
      adjusted = true;
    }
  } else if (verdict === "Ready to submit") {
    if (
      typeof report.casting_headline === "string" &&
      /\b(not ready|blocked|reject|fails?)\b/i.test(report.casting_headline)
    ) {
      report.casting_headline = "This tape is ready to submit, with room for refinement.";
      adjusted = true;
    }
  } else if (verdict === "Worth another take") {
    ensureHeadline("Worth another take —");
  } else if (verdict === "Not ready yet") {
    if (
      typeof report.casting_headline === "string" &&
      /\b(strong|excellent|ready to submit)\b/i.test(report.casting_headline)
    ) {
      report.casting_headline = "Not ready yet — see the priority fix below.";
      adjusted = true;
    }
    if (
      typeof report.casting_insight === "string" &&
      /\b(highly castable|very castable|excellent)\b/i.test(report.casting_insight)
    ) {
      report.casting_insight = "Re-tape recommended before submitting.";
      adjusted = true;
    }
  }

  return { adjusted };
}

// ---------- Legacy deterministic failure renderer ----------

/**
 * Legacy emergency renderer for explicit AI-judgement-unavailable cases only.
 * S10 performer-facing analysis should fall through to the active single-pass
 * S10 prompt instead of using this as primary report content.
 */
export function renderFallbackReport(
  evidence: EvidencePass,
  mode: "brief" | "baseline",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const cn = evidence.category_notes_evidence ?? {
    technical: "",
    audio: "",
    vocal: "",
    acting: "",
    brief_adherence: "",
    professional_presentation: "",
  };
  const ba = evidence.brief_adherence_evidence;

  const strengths = evidence.core_strengths_evidence
    .map((s) => (s.area && s.evidence ? `${s.area}: ${s.evidence}` : s.evidence || s.area))
    .filter((x) => typeof x === "string" && x.length > 0)
    .slice(0, 12);

  const improvements = evidence.core_improvements_evidence
    .map((s) => (s.area && s.evidence ? `${s.area}: ${s.evidence}` : s.evidence || s.area))
    .filter((x) => typeof x === "string" && x.length > 0)
    .slice(0, 15);

  const fixFirst = (evidence.fix_first_evidence ?? "").trim() || improvements[0] || "";

  const timestamped_notes = evidence.timestamped_evidence
    .map((t) => {
      const obs = (t.observation ?? "").trim();
      const why = (t.why_it_matters ?? "").trim();
      if (!obs || !why) return null;
      const note =
        obs.toLowerCase() === why.toLowerCase() || why.toLowerCase().includes(obs.toLowerCase())
          ? why
          : `${obs} — ${why}`;
      return { timestamp: t.timestamp, note };
    })
    .filter((x): x is { timestamp: string; note: string } => x !== null)
    .slice(0, 36);

  const submission_risk_flags = evidence.risk_evidence.map((r) => ({
    severity: r.severity,
    flag: r.flag,
  }));
  const casting_risk_explanations = evidence.risk_evidence.map((r) => ({
    flag: r.flag,
    casting_impact: r.why,
    recall_impact: r.recall_impact,
  }));

  const role_fit_notes =
    mode === "brief" &&
    !!evidence.evidence_sufficiency?.role_fit_assessable &&
    (evidence.role_fit_evidence ?? "").trim().length > 0
      ? `Role fit observations: ${evidence.role_fit_evidence}`
      : "";

  return {
    mode,
    audition_type: evidence.audition_type,
    detected_components: evidence.detected_components,
    consistency_modifier: 0,
    confidence: 60,
    confidence_reason: "AI judgement unavailable; generated only from observation evidence.",
    overall_score:
      Math.round(
        ((evidence.raw_scores.technical ?? 0) +
          (evidence.raw_scores.audio ?? 0) +
          (evidence.raw_scores.acting ?? 0) +
          (evidence.raw_scores.brief_adherence ?? 0) +
          (evidence.raw_scores.professional_presentation ?? 0)) /
          5,
      ) || 0,
    casting_headline: "AI judgement unavailable for this report.",
    casting_insight: "Please retry the analysis to receive the full S10 report judgement.",
    scores: { ...evidence.raw_scores },
    brief_adherence_breakdown: {
      material_compliance: ba?.score_material ?? evidence.raw_scores.brief_adherence,
      technical_compliance: ba?.score_technical ?? evidence.raw_scores.brief_adherence,
      instruction_precision: ba?.score_instruction ?? evidence.raw_scores.brief_adherence,
      professionalism_signals: ba?.score_professional ?? evidence.raw_scores.brief_adherence,
      note:
        [
          ba?.material_compliance,
          ba?.technical_compliance,
          ba?.instruction_precision,
          ba?.professionalism_signals,
        ]
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .join(" ") || "Derived from evidence pass.",
    },
    category_notes: {
      technical: cn.technical ?? "",
      audio: cn.audio ?? "",
      vocal: cn.vocal ?? "",
      acting: cn.acting ?? "",
      brief_adherence: cn.brief_adherence ?? "",
      professional_presentation: cn.professional_presentation ?? "",
    },
    strengths:
      strengths.length > 0
        ? strengths
        : ["AI-authored strengths unavailable; retry the analysis for performer-facing judgement."],
    improvements:
      improvements.length > 0
        ? improvements
        : [
            "AI-authored improvements unavailable; retry the analysis for performer-facing judgement.",
          ],
    fix_first: fixFirst,
    timestamped_notes,
    coaching_drills: [
      "Retry the analysis before treating this report as performer-facing guidance.",
    ],
    submission_risk_flags,
    casting_risk_explanations,
    role_fit_notes,
    role_fit_modifier: 0,
    role_fit_confidence: evidence.role_fit_confidence ?? "low",
    presentation_notes: evidence.presentation_evidence.slice(0, 6),
    at_risk: evidence.raw_scores.brief_adherence < 40 && mode === "brief",
  };
}
