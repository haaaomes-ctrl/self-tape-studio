// SERVER-ONLY. Step 2 of the two-step analysis pipeline.
//
// Text-only "polish" pass. Receives the locked Step 1 evidence (no video) and
// uses the existing REPORT_TOOL schema to produce a final structured report.
// Then runs locked-field enforcement (primary safeguard), conservative
// unsupported-claim handling, and a deterministic fallback renderer for
// total Step 2 failure.

import type { EvidencePass } from "./evidence-pass.server";
import { isValidTimestamp } from "./evidence-pass.server";

const DEFAULT_MODEL =
  process.env.REPORT_POLISH_MODEL ?? "google/gemini-3-flash-preview";

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
- Final array limits: strengths ≤3, improvements ≤3 (prioritised by impact), presentation_notes ≤3, timestamped_notes ≤8, coaching_drills as the existing schema allows.
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

export async function runReportPolish(
  args: RunReportPolishArgs,
): Promise<RunReportPolishResult> {
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
      error: `report_polish_http_${resp.status}: ${body.slice(0, 200)}`,
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
  "the","a","an","and","or","but","of","in","on","to","for","with","at","by","is","are","was","were","be","been","being","this","that","these","those","it","its","as","from","into","over","under","than","then","so","if","when","while","very","more","less","most","least","you","your","they","their","we","our","i","my","me",
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
      ...evidence.risk_evidence.map((r) =>
        `${r.flag} ${r.why}`.toLowerCase(),
      ),
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
  if (
    typeof report.role_fit_notes === "string" &&
    report.role_fit_notes.trim().length > 0
  ) {
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

/**
 * Build a minimal, valid report directly from Step 1 evidence when Step 2
 * fails. The orchestrator's existing post-process (recompute, caps, material
 * policy, verdict, block reasons) runs over this exactly as it would over a
 * polished report. Prefers the richer evidence fields over generic scraping.
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
    .map((s) =>
      s.area && s.evidence ? `${s.area}: ${s.evidence}` : s.evidence || s.area,
    )
    .filter((x) => typeof x === "string" && x.length > 0)
    .slice(0, 12);

  const improvements = evidence.core_improvements_evidence
    .map((s) =>
      s.area && s.evidence ? `${s.area}: ${s.evidence}` : s.evidence || s.area,
    )
    .filter((x) => typeof x === "string" && x.length > 0)
    .slice(0, 15);

  const fixFirst =
    (evidence.fix_first_evidence ?? "").trim() ||
    improvements[0] ||
    "";

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
    confidence_reason:
      "Generated from evidence pass (polish step unavailable).",
    overall_score:
      Math.round(
        ((evidence.raw_scores.technical ?? 0) +
          (evidence.raw_scores.audio ?? 0) +
          (evidence.raw_scores.acting ?? 0) +
          (evidence.raw_scores.brief_adherence ?? 0) +
          (evidence.raw_scores.professional_presentation ?? 0)) /
          5,
      ) || 0,
    casting_headline: "Report generated from observation evidence.",
    casting_insight:
      "Polish step unavailable — see strengths and improvements below.",
    scores: { ...evidence.raw_scores },
    brief_adherence_breakdown: {
      material_compliance: ba?.score_material ?? evidence.raw_scores.brief_adherence,
      technical_compliance: ba?.score_technical ?? evidence.raw_scores.brief_adherence,
      instruction_precision: ba?.score_instruction ?? evidence.raw_scores.brief_adherence,
      professionalism_signals:
        ba?.score_professional ?? evidence.raw_scores.brief_adherence,
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
      strengths.length > 0 ? strengths : ["Performance captured for review."],
    improvements:
      improvements.length > 0 ? improvements : ["Continue refining the take."],
    fix_first: fixFirst,
    timestamped_notes,
    coaching_drills: [
      "Re-run the take with sharper choices on the strongest moment.",
    ],
    submission_risk_flags,
    casting_risk_explanations,
    role_fit_notes,
    role_fit_modifier: 0,
    role_fit_confidence: evidence.role_fit_confidence ?? "low",
    presentation_notes: evidence.presentation_evidence.slice(0, 6),
    at_risk:
      evidence.raw_scores.brief_adherence < 40 && mode === "brief",
  };
}
