// SERVER-ONLY. Step 2 of the two-step analysis pipeline.
//
// Text-only "polish" pass. Receives the locked Step 1 evidence (no video) and
// uses the existing REPORT_TOOL schema to produce a final structured report.
// Then runs locked-field enforcement (primary safeguard), conservative
// unsupported-claim handling, and a deterministic fallback renderer for
// total Step 2 failure.

import type { EvidencePass } from "./evidence-pass.server";
import { isValidTimestamp } from "./evidence-pass.server";
import {
  classifyFinalReportProviderError,
  type FinalReportProviderSafeErrorCategory,
} from "./final-report-provider-errors.server";

const DEFAULT_MODEL = process.env.REPORT_POLISH_MODEL ?? "google/gemini-3-flash-preview";

const POLISH_SYSTEM_PROMPT = `You are a UK casting director, agent and acting coach writing a self-tape audition report. You will NOT be given the video. You will be given a LOCKED EVIDENCE block from a prior pass that did watch the tape.

Rules:
- Use ONLY the supplied evidence as factual ground truth. Do NOT invent observations the evidence does not support.
- Improve WORDING only. Do NOT change scores, score meanings, verdicts, or score-derived conclusions. The orchestrator will overwrite scores from the evidence pass.
- Do NOT add new timestamped_notes that are not in evidence.timestamped_evidence. Do NOT change their timestamps. Keep timestamped_notes in CHRONOLOGICAL order.
- Do NOT add new submission_risk_flags that the evidence does not support.
- Do NOT add new presentation_notes that the evidence does not support. Visual claims about clothing, "top", "shirt", "your top provides contrast", "solid colour of your top", background colour, or any wardrobe/contrast claim must NOT appear unless that exact claim is locked in evidence.presentation_evidence. When in doubt, omit. Acceptable safe wording when there is no locked visual evidence: "the frame is clean and easy to read", "the background does not distract from the performance", "the performer remains visually clear throughout".
- Do NOT add new role_fit claims beyond the supplied role_fit_evidence.
- Do NOT introduce ANY new visual detail not present in evidence — including clothing colour. If a colour is not stated in the locked evidence, do not name a colour. Prefer colour-neutral wording: "the performer separates clearly from the background", "the framing is clean and easy to read", "the background keeps focus on the performance".
- Prefer TIMESTAMPS and neutral moment descriptions over page/line/"side" references in user-facing text. Even if the brief explicitly contains page references (e.g. "Side 1, pages 85–87"), the final report should prefer wording like "during the longer speech in the acting scene", "around 02:14", or "in the scene before the song" over "on page 86" or "in the side". Page references may be retained ONLY when they materially help the performer and ONLY when they are within the page range explicitly given in the brief. NEVER invent page or line numbers the brief does not provide.
- Replace unclear standalone "side" jargon with clearer wording for non-industry users: "the requested side" → "the requested Side 1 acting scene" (when the brief explicitly says Side 1) or "the requested acting scene"; "the side and the song" → "the acting scene and the song"; "in the side" → "in the acting section"; bare "the side" → "the acting scene". "Side 1" is acceptable when the brief explicitly uses it.
- If the brief requires head-and-shoulders, close-up, medium close-up, fixed/static framing, or any "self-tape framing" / "camera-led" instruction, do NOT recommend on-camera movement or staging that breaks the frame in the RECORDED take. Specifically forbidden as recorded-take advice: standing up to record/perform/sing, walking, moving around the room, packing a bag, crossing the room, holding an instrument or microphone or any prop on camera, using props, physical tasks, recording while moving, recording while standing, adding staging, adding blocking, adding business, or moving out of frame. These are allowed ONLY when explicitly framed as "rehearsal-only" or "off-camera rehearsal" exercises, and you MUST then also give a recorded-take alternative that preserves the required head-and-shoulders frame (use breath, stillness, eyeline changes, thought-shifts, intention shifts).
- Use British English throughout (recall not callback, casting brief, self-tape, analysing, prioritised, behaviour, centre, colour).
- Be specific, prioritised, supportive — the same voice as the existing single-pass report.
- Calibrate tone to the supplied performer level.
- NEVER comment on appearance, body, age, race, class, disability, mobility aids, medical devices, or socioeconomic status.
- Respect evidence_sufficiency. If audio_assessable=false, do not praise vocal detail. If video_assessable=false, do not praise micro-expression. If brief_assessable=false or role_fit_assessable=false, leave role_fit_notes empty.
- presentation_notes are OPTIONAL. Leave the array empty when there is nothing materially useful to say. Do not pad with generic praise such as "looks professional".
- "Fix this first" must be the SINGLE highest-impact actionable note from the evidence. "Top improvements" must be specific and grounded in evidence_lines.
- Volume targets (do NOT pad, do NOT artificially shorten when the evidence supports more): strengths 3–8 (max 12), improvements 3–10 (max 15), priority_fixes 2–5 (max 8), next_take_plan items 4–10 (max 15), presentation_notes max 6, timestamped_notes duration-scaled (<60s 3–5; 1–3m 6–10; 3–5m 8–14; 5–10m 12–24; 10m+ 18–36; absolute max 36). Coaching_drills as the schema allows.
- Populate priority_fixes (2–5 prioritised fixes with kind tag) and next_take_plan (steps[] and optionally groups[]) when the evidence supports them. Do not duplicate improvements verbatim unless that is the clearest formulation.
- Populate why_this_verdict, must_fix_before_submitting, should_improve_if_retaking, optional_polish, preserve, do_not_overfix, brief_achievement, brief_requirements and not_assessable when the locked evidence supports them. Keep must-fix, retake improvements and optional polish separate so the performer does not read every refinement as a reason to keep retaking.
- Not assessable is a limitation state, not criticism. Do not collapse not_assessable into not_achieved. Do not invent brief requirements.
- Populate category_rationale[<key>] for every category whose score is < 100: what_works, why_not_full_score, close_gap. For scores >= 90 also write standout_delta. Discipline-specific language; never generic praise; reserve 98–100 for near-flawless evidence; high scores must NOT reduce feedback volume; a 95 still gets a marginal improvement pathway.
- Discipline depth: DANCE — cite movement evidence (rhythm/timing, control, spatial pathway, dynamics, performance intention); never invent style/subtype; never claim foot/leg cropping without timestamped evidence; no MT-role/employer language. MT — preserve Acting Scene + Song; cite acting-through-song with lyric/phrase/beat/transition; vocal distinguishes technique from story/style. Never use castability/recall/workshop/live-room/buyer overclaim.
- Return ONLY via the submit_audition_report tool.`;

export type RunReportPolishArgs = {
  apiKey: string;
  signal: AbortSignal;
  evidence: EvidencePass;
  briefBlock: string;
  extractedBlock: string;
  signalsBlock: string;
  levelBlock: string;
  auditionTitle: string;
  reportTool: unknown;
  model?: string;
  takeId?: string;
  analysisRunId?: string;
};

type FallbackReportContext = {
  briefText?: string | null;
  extractedBrief?: Record<string, unknown> | null;
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
      safeErrorCategory: FinalReportProviderSafeErrorCategory;
      durationMs: number;
      model: string;
    };

/** Build the locked-evidence block sent to the polish model (text-only). */
function buildEvidenceBlock(ev: EvidencePass): string {
  return `LOCKED EVIDENCE (Step 1 — authoritative, do not contradict):\n${JSON.stringify(
    {
      evidence_version: ev.evidence_version,
      audition_type: ev.audition_type,
      detected_components: ev.detected_components,
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

export async function runReportPolish(args: RunReportPolishArgs): Promise<RunReportPolishResult> {
  const model = args.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  const evidenceBlock = buildEvidenceBlock(args.evidence);

  const userText = [
    `Audition title: ${args.auditionTitle}`,
    args.levelBlock,
    args.briefBlock,
    args.extractedBlock,
    args.signalsBlock,
    evidenceBlock,
    "Write the final structured report via submit_audition_report. Use the locked evidence as ground truth. Improve wording only. Do not invent new timestamps, risk flags, presentation notes, or role-fit claims. Respect evidence_sufficiency.",
  ].join("\n\n");

  let resp: Response | null = null;
  try {
    if (args.takeId) {
      console.log("[take-pipeline] final_ai_request_attempt", {
        take_id: args.takeId,
        analysis_run_id: args.analysisRunId ?? `take-${args.takeId}`,
        stage: "report_polish_step2",
        model,
        fallback_model: null,
        attempt_number: 1,
        selected_media_url_confirmed_fetchable: null,
        selected_url_kind: "none_text_only",
        request_contract_version: "step2_locked_evidence_tool_call_v1",
        response_schema_name: "submit_audition_report",
        content_part_summary: {
          text_parts: 1,
          file_url_parts: 0,
          tool_call_required: true,
        },
      });
    }
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        top_p: 1,
        max_tokens: 8192,
        messages: [
          { role: "system", content: POLISH_SYSTEM_PROMPT },
          { role: "user", content: userText },
        ],
        tools: [args.reportTool],
        tool_choice: {
          type: "function",
          function: { name: "submit_audition_report" },
        },
      }),
      signal: args.signal,
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      error: err instanceof Error ? err.name || "network_error" : "network_error",
      safeErrorCategory: "provider_network_error",
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
    const safeProviderError = classifyFinalReportProviderError({
      status: resp.status,
      body,
      mediaUrlConfirmedFetchable: true,
    });
    return {
      ok: false,
      httpStatus: resp.status,
      error: `report_polish_http_${resp.status}_${safeProviderError.category}`,
      safeErrorCategory: safeProviderError.category,
      durationMs: Date.now() - startedAt,
      model,
    };
  }

  try {
    const json = await resp.json();
    const choice = json.choices?.[0];
    const tc = choice?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      return {
        ok: false,
        httpStatus: resp.status,
        error: "report_polish_no_tool_call",
        safeErrorCategory: "provider_request_contract_invalid",
        durationMs: Date.now() - startedAt,
        model,
      };
    }
    const report = JSON.parse(tc.function.arguments);
    return {
      ok: true,
      report,
      durationMs: Date.now() - startedAt,
      model,
      httpStatus: resp.status,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: resp.status,
      error: err instanceof Error ? err.message : "report_polish_parse_error",
      safeErrorCategory: "provider_request_contract_invalid",
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

// ---------- Deterministic fallback renderer ----------

function fallbackText(value: unknown, maxLength = 260): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength).trim() : null;
}

function fallbackTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => fallbackText(item)).filter((item): item is string => item !== null);
}

function step1ObservationText(
  evidence: EvidencePass,
  predicate: (observation: NonNullable<EvidencePass["step1_observations"]>[number]) => boolean,
): string {
  return Array.isArray(evidence.step1_observations)
    ? evidence.step1_observations
        .filter((observation) => Boolean(observation) && predicate(observation))
        .map((observation) => fallbackText(observation.summary, 360))
        .filter((item): item is string => item !== null)
        .join(" ")
    : "";
}

function fallbackEvidenceText(evidence: EvidencePass): string {
  const brief = evidence.brief_adherence_evidence;
  const categories = evidence.category_notes_evidence;
  return [
    step1ObservationText(evidence, () => true),
    ...evidence.detected_components.map((component) => `${component.type} ${component.note}`),
    ...evidence.core_improvements_evidence.map((item) => `${item.area} ${item.evidence}`),
    evidence.fix_first_evidence,
    brief?.material_compliance,
    brief?.technical_compliance,
    brief?.instruction_precision,
    brief?.professionalism_signals,
    categories?.audio,
    categories?.acting,
    categories?.brief_adherence,
    ...evidence.risk_evidence.map((item) => `${item.flag} ${item.why}`),
    ...evidence.timestamped_evidence.map((item) => `${item.observation} ${item.why_it_matters}`),
  ]
    .map((item) => fallbackText(item, 500))
    .filter((item): item is string => item !== null)
    .join(" ");
}

function fallbackBriefText(context?: FallbackReportContext): string {
  const extracted = context?.extractedBrief;
  return [
    context?.briefText,
    extracted?.material_requested,
    extracted?.framing_required,
    extracted?.orientation_required,
    ...fallbackTextArray(extracted?.explicit_instructions),
  ]
    .map((item) => fallbackText(item, 500))
    .filter((item): item is string => item !== null)
    .join(" ");
}

function fallbackSourceText(briefText: string, kind: "side" | "song" | "continuous"): string {
  if (kind === "side") {
    return (
      fallbackText(
        briefText.match(/\bside\s*1\b[^.\n]*(?:pages?\s*\d+\s*(?:[-–]\s*\d+)?)?/i)?.[0],
      ) ?? "Tape the required Side 1 acting scene."
    );
  }
  if (kind === "song") {
    return (
      fallbackText(
        briefText.match(/\b(?:contemporary\s+legit\s+)?(?:MT\s+)?song\b[^.\n]*/i)?.[0],
      ) ?? "Tape the required song."
    );
  }
  return (
    fallbackText(
      briefText.match(/\b(?:one\s+continuous\s+video|one\s+file|single\s+file)\b[^.\n]*/i)?.[0],
    ) ?? "Submit the requested material as one continuous video."
  );
}

type FallbackBriefRequirement = {
  source_text: string;
  public_summary: string;
  category: "mandatory" | "material_instruction" | "admin_process" | "video_audio_setup";
  obligation: "mandatory";
  requirement_type: "scene" | "song" | "submission_process";
  achievement_status: "achieved" | "partly_achieved" | "not_achieved" | "not_assessable";
  readiness_impact: "supports_submission" | "material_gap" | "submission_blocker";
  public_evidence_summary?: string;
  assessability_limits: string[];
  next_take_action?: string;
};

function deriveFallbackBriefRequirements(
  evidence: EvidencePass,
  context: FallbackReportContext | undefined,
): FallbackBriefRequirement[] {
  const briefText = fallbackBriefText(context);
  if (!briefText) return [];
  const lowerBrief = briefText.toLowerCase();
  const observedMaterialText = step1ObservationText(
    evidence,
    (observation) =>
      observation.source_basis !== "supplied_context" &&
      (observation.family === "material_specific_performance" ||
        observation.family === "audio_observable" ||
        observation.family === "performance_observable"),
  ).toLowerCase();
  const allEvidence = fallbackEvidenceText(evidence).toLowerCase();
  const componentTypes = new Set(evidence.detected_components.map((component) => component.type));
  const requiresSide = /\b(?:side\s*1|sides?|pages?\s*\d+|acting\s+scene|scene)\b/.test(lowerBrief);
  const requiresSong = /\b(?:song|mt\s+song|musical\s+theatre\s+song|legit)\b/.test(lowerBrief);
  const requiresContinuous =
    /\b(?:one\s+continuous\s+video|one\s+file|single\s+file|do\s+not\s+upload\s+more\s+than\s+one\s+file)\b/.test(
      lowerBrief,
    );
  const observedScene =
    componentTypes.has("acting_scene") ||
    componentTypes.has("monologue") ||
    /\b(?:acting\s+scene|scene\s+section|side\s*1|dialogue|reader)\b/.test(observedMaterialText);
  const observedSong =
    componentTypes.has("song") ||
    /\b(?:song|singing|sung|music|musical\s+number|vocal)\b/.test(observedMaterialText);
  const explicitCompletionGap =
    /\b(?:partial|partly|incomplete|cut\s*off|cuts\s*off|abrupt|does\s+not\s+finish|did\s+not\s+finish|before\s+completion|ends?\s+early|completion\s+could\s+not\s+be\s+confirmed|package\s+(?:is\s+)?(?:incomplete|not\s+complete|needs\s+completion))\b/.test(
      allEvidence,
    );
  const explicitSongAbsence =
    /\b(?:no\s+(?:required\s+)?song|song\s+section\s+(?:missing|absent)|does\s+not\s+(?:include|contain)\s+(?:the\s+)?(?:required\s+)?song|available\s+evidence\s+does\s+not\s+identify\s+(?:a\s+)?song)\b/.test(
      allEvidence,
    );
  const missingRequiredScene =
    requiresSide &&
    !observedScene &&
    (observedSong ||
      observedMaterialText.length > 0 ||
      /\b(?:no\s+observed\s+side|side\s*1\s+(?:is\s+)?missing|required\s+acting\s+side\s+is\s+not\s+present|missing\s+(?:required\s+)?side|required\s+material\s+is\s+incomplete)\b/.test(
        allEvidence,
      ));
  const packageIncomplete =
    explicitCompletionGap ||
    missingRequiredScene ||
    /\b(?:required\s+material\s+is\s+incomplete|final\s+edit\s+needs\s+a\s+playback\s+check|package\s+completion\s+could\s+not\s+be\s+confirmed)\b/.test(
      allEvidence,
    );
  const songIncomplete = observedSong && explicitCompletionGap;
  const requirements: FallbackBriefRequirement[] = [];

  if (missingRequiredScene) {
    requirements.push({
      source_text: fallbackSourceText(briefText, "side"),
      public_summary: "Include the required Side 1 acting scene.",
      category: "mandatory",
      obligation: "mandatory",
      requirement_type: "scene",
      achievement_status: "not_achieved",
      readiness_impact: "submission_blocker",
      public_evidence_summary:
        "The supplied brief asks for Side 1, but the available evidence does not identify the required acting scene in the submitted tape.",
      assessability_limits: [],
      next_take_action: "Record and include the full required Side 1 acting scene.",
    });
  }

  if (requiresSong) {
    if (songIncomplete) {
      requirements.push({
        source_text: fallbackSourceText(briefText, "song"),
        public_summary: "Complete the required song section.",
        category: "mandatory",
        obligation: "mandatory",
        requirement_type: "song",
        achievement_status: "partly_achieved",
        readiness_impact: "material_gap",
        public_evidence_summary:
          "The tape contains a song section, but the evidence indicates it is incomplete or cuts off before completion.",
        assessability_limits: [],
        next_take_action:
          "Complete the song section or confirm the song runs through to the end before uploading.",
      });
    } else if (packageIncomplete) {
      requirements.push({
        source_text: fallbackSourceText(briefText, "song"),
        public_summary: "Complete or confirm the required song section.",
        category: "mandatory",
        obligation: "mandatory",
        requirement_type: "song",
        achievement_status: "partly_achieved",
        readiness_impact: "material_gap",
        public_evidence_summary:
          "The brief requires a song as part of the package, and the song/package completion could not be fully confirmed from the available evidence.",
        assessability_limits: [],
        next_take_action:
          "Complete the song section or confirm the song runs through to the end before uploading.",
      });
    } else if (explicitSongAbsence) {
      requirements.push({
        source_text: fallbackSourceText(briefText, "song"),
        public_summary: "Include the required song section.",
        category: "mandatory",
        obligation: "mandatory",
        requirement_type: "song",
        achievement_status: "not_achieved",
        readiness_impact: "material_gap",
        public_evidence_summary:
          "The available evidence explicitly indicates that the required song section is not present in the submitted tape.",
        assessability_limits: [],
        next_take_action: "Record and include the required song section.",
      });
    }
  }

  if (requiresContinuous && (requirements.length > 0 || songIncomplete)) {
    requirements.push({
      source_text: fallbackSourceText(briefText, "continuous"),
      public_summary: "Submit the required material in one continuous video.",
      category: "admin_process",
      obligation: "mandatory",
      requirement_type: "submission_process",
      achievement_status: requirements.some((item) => item.achievement_status === "not_achieved")
        ? "partly_achieved"
        : "not_assessable",
      readiness_impact: "material_gap",
      public_evidence_summary:
        "Because required material is missing or incomplete, the final edited package cannot yet be treated as complete.",
      assessability_limits: [],
      next_take_action:
        requiresSong && requiresSide
          ? "Check that the song and Side 1 are both present in the final continuous video."
          : "Check that the final edit contains the required material in one continuous video.",
    });
  }

  return requirements.slice(0, 6);
}

function fallbackScores(evidence: EvidencePass, requirements: FallbackBriefRequirement[]) {
  const raw = evidence.raw_scores ?? {};
  const allZero = ["technical", "audio", "acting", "brief_adherence", "professional_presentation"]
    .map((key) => raw[key as keyof typeof raw])
    .every((value) => typeof value !== "number" || value === 0);
  if (!allZero) return { ...raw };
  const hasBriefBlocker = requirements.some(
    (item) => item.readiness_impact === "submission_blocker",
  );
  const hasMaterialGap = requirements.some((item) => item.readiness_impact === "material_gap");
  return {
    technical: evidence.evidence_sufficiency?.video_assessable === false ? 25 : 72,
    audio: evidence.evidence_sufficiency?.audio_assessable === false ? 25 : 72,
    vocal: null,
    acting: hasBriefBlocker ? 35 : 62,
    brief_adherence: hasBriefBlocker ? 25 : hasMaterialGap ? 42 : 62,
    professional_presentation: 70,
  };
}

function fallbackPriorityFixes(
  requirements: FallbackBriefRequirement[],
  fixFirst: string,
): Array<{ headline: string; rationale: string; kind: string; category: string; action: string }> {
  const fromBrief = requirements
    .filter(
      (item) =>
        item.achievement_status === "not_achieved" || item.achievement_status === "partly_achieved",
    )
    .map((item) => ({
      headline: item.next_take_action ?? `Address the brief requirement: ${item.public_summary}.`,
      rationale:
        item.public_evidence_summary ??
        "This supplied brief requirement materially affects submission readiness.",
      kind:
        item.readiness_impact === "submission_blocker" ? "critical_gap" : "low_effort_high_impact",
      category: "brief_adherence",
      action: item.next_take_action ?? `Address the brief requirement: ${item.public_summary}.`,
    }));
  if (fromBrief.length > 0) return fromBrief.slice(0, 8);
  return fixFirst
    ? [
        {
          headline: fixFirst,
          rationale: "Highest-impact item available from the locked evidence.",
          kind: "critical_gap",
          category: "general",
          action: fixFirst,
        },
      ]
    : [];
}

function fallbackNextTakePlan(requirements: FallbackBriefRequirement[]): string[] {
  const steps = requirements
    .map((item) => item.next_take_action)
    .filter((item): item is string => typeof item === "string" && item.length > 0);
  if (steps.length === 0) return [];
  return [...steps, "Do a quick playback check before uploading to catch any cut-off."].slice(
    0,
    10,
  );
}

/**
 * Build a minimal, valid report directly from Step 1 evidence when Step 2
 * fails. The orchestrator's existing post-process (recompute, caps, material
 * policy, verdict, block reasons) runs over this exactly as it would over a
 * polished report. Prefers the richer evidence fields over generic scraping.
 */
export function renderFallbackReport(
  evidence: EvidencePass,
  mode: "brief" | "baseline",
  context?: FallbackReportContext,
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

  const derivedBriefRequirements =
    mode === "brief" ? deriveFallbackBriefRequirements(evidence, context) : [];
  const scores = fallbackScores(evidence, derivedBriefRequirements);
  const detectedComponents = evidence.detected_components;
  const fallbackFixFirst = (evidence.fix_first_evidence ?? "").trim() || improvements[0] || "";
  const priorityFixes = fallbackPriorityFixes(derivedBriefRequirements, fallbackFixFirst);
  const fixFirst = priorityFixes[0]?.headline ?? fallbackFixFirst;
  const nextTakePlanSteps = fallbackNextTakePlan(derivedBriefRequirements);
  const notAssessable = [
    ...(!evidence.evidence_sufficiency?.audio_assessable
      ? ["Audio limits how firmly vocal or spoken detail can be judged."]
      : []),
    ...(!evidence.evidence_sufficiency?.video_assessable
      ? ["Video or framing limits how firmly visual performance detail can be judged."]
      : []),
    ...(mode === "brief" && !evidence.evidence_sufficiency?.brief_assessable
      ? ["Brief achievement could not be fully assessed from the available evidence."]
      : []),
  ];
  const briefAchievement =
    derivedBriefRequirements.length > 0
      ? {
          overall_status: derivedBriefRequirements.some(
            (item) => item.achievement_status === "not_achieved",
          )
            ? "partly_achieved"
            : "mostly_achieved",
          summary: derivedBriefRequirements.some((item) =>
            /side\s*1|acting scene/i.test(item.public_summary),
          )
            ? "The brief is only partly achieved: the required Side 1 acting scene is missing, and the song package needs completion before submission."
            : "The brief is partly achieved, but the itemised material gaps need attention before submission.",
          mandatory_requirements_status: derivedBriefRequirements.some(
            (item) => item.readiness_impact === "submission_blocker",
          )
            ? "At least one assessable mandatory requirement is not achieved."
            : "At least one mandatory requirement has a material gap to review.",
          mandatory_status: derivedBriefRequirements.some(
            (item) => item.readiness_impact === "submission_blocker",
          )
            ? "blocked"
            : "some_gaps",
          readiness_impact: derivedBriefRequirements.some(
            (item) => item.readiness_impact === "submission_blocker",
          )
            ? "submission_blocker"
            : "material_gap",
          readiness_effect:
            "Retake with the missing or incomplete required material before treating this as a complete submission package.",
        }
      : mode === "brief"
        ? {
            overall_status: evidence.evidence_sufficiency?.brief_assessable
              ? "partly_achieved"
              : "not_assessable",
            summary: evidence.evidence_sufficiency?.brief_assessable
              ? "Brief achievement was derived from the available evidence pass."
              : "Brief achievement could not be fully assessed from the available evidence pass.",
            mandatory_requirements_status: evidence.evidence_sufficiency?.brief_assessable
              ? "Review the itemised brief evidence before submission."
              : "Mandatory brief requirements could not be confirmed.",
            mandatory_status: evidence.evidence_sufficiency?.brief_assessable
              ? "some_gaps"
              : "not_assessable",
            readiness_impact: evidence.evidence_sufficiency?.brief_assessable
              ? "material_gap"
              : "not_assessable",
            readiness_effect: evidence.evidence_sufficiency?.brief_assessable
              ? "Use the itemised brief checks to decide whether the gap needs a retake."
              : "Treat this as a brief-assessability limitation, not a performance failure.",
            ...(!evidence.evidence_sufficiency?.brief_assessable
              ? {
                  not_assessable_summary:
                    "Brief achievement could not be fully assessed from the available evidence.",
                }
              : {}),
          }
        : {
            overall_status: "not_applicable",
            summary: "No supplied brief was available to assess.",
            mandatory_requirements_status: "No mandatory brief requirements supplied.",
            mandatory_status: "not_applicable",
            readiness_impact: "supports_submission",
            readiness_effect:
              "The report uses general submission standards and observable tape evidence only.",
          };

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
    detected_components: detectedComponents,
    consistency_modifier: 0,
    confidence: 60,
    confidence_reason: "Generated from evidence pass (polish step unavailable).",
    overall_score:
      Math.round(
        ((scores.technical ?? 0) +
          (scores.audio ?? 0) +
          (scores.acting ?? 0) +
          (scores.brief_adherence ?? 0) +
          (scores.professional_presentation ?? 0)) /
          5,
      ) || 0,
    casting_headline: "Report generated from observation evidence.",
    casting_insight: "Polish step unavailable — see strengths and improvements below.",
    scores,
    brief_adherence_breakdown: {
      material_compliance: ba?.score_material ?? scores.brief_adherence,
      technical_compliance: ba?.score_technical ?? scores.brief_adherence,
      instruction_precision: ba?.score_instruction ?? scores.brief_adherence,
      professionalism_signals: ba?.score_professional ?? scores.brief_adherence,
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
    strengths: strengths.length > 0 ? strengths : ["Performance captured for review."],
    preserve:
      strengths.length > 0 ? strengths : ["Preserve the clearest choices already captured."],
    improvements: improvements.length > 0 ? improvements : [],
    fix_first: fixFirst,
    priority_fixes: priorityFixes,
    why_this_verdict: {
      summary:
        derivedBriefRequirements.length > 0
          ? "The supplied brief asks for specific material, and the available evidence shows that required material is missing or incomplete."
          : "Report polish was unavailable, so this recommendation is based on the locked observation evidence and should be reviewed with that limitation in mind.",
      main_reasons: [
        fixFirst || "No single public-safe priority fix was available from the evidence pass.",
      ],
    },
    must_fix_before_submitting:
      derivedBriefRequirements.length > 0
        ? derivedBriefRequirements
            .filter(
              (item) =>
                item.readiness_impact === "submission_blocker" ||
                item.readiness_impact === "material_gap",
            )
            .map((item) => item.next_take_action ?? item.public_summary)
        : submission_risk_flags.filter((flag) => flag.severity === "high").map((flag) => flag.flag),
    should_improve_if_retaking: [],
    optional_polish: [],
    do_not_overfix: [
      evidence.evidence_sufficiency?.audio_assessable !== false &&
      derivedBriefRequirements.length > 0
        ? "Do not spend the next take chasing audio changes if the recording is already clear enough; prioritise the missing required material."
        : "Do not keep retaking just to chase minor polish; re-record only for a clear priority fix.",
    ],
    brief_requirements: derivedBriefRequirements,
    brief_achievement: briefAchievement,
    not_assessable: notAssessable,
    timestamped_notes,
    coaching_drills:
      nextTakePlanSteps.length > 0
        ? nextTakePlanSteps
        : ["Re-run the take with sharper choices on the strongest moment."],
    next_take_plan: nextTakePlanSteps.length > 0 ? { steps: nextTakePlanSteps } : { steps: [] },
    submission_risk_flags,
    casting_risk_explanations,
    role_fit_notes,
    role_fit_modifier: 0,
    role_fit_confidence: evidence.role_fit_confidence ?? "low",
    presentation_notes: evidence.presentation_evidence.slice(0, 6),
    at_risk:
      (scores.brief_adherence ?? 0) < 40 ||
      derivedBriefRequirements.some((item) => item.readiness_impact === "submission_blocker"),
  };
}
