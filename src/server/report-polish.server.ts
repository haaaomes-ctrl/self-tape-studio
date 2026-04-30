// SERVER-ONLY. Step 2 of the two-step analysis pipeline.
//
// Text-only "polish" pass. Receives the locked Step 1 evidence (no video) and
// uses the existing REPORT_TOOL schema to produce a final structured report.
// Then runs locked-field enforcement (primary safeguard) and conservative
// unsupported-claim handling. Includes a deterministic fallback renderer if
// Step 2 fails entirely.

import type { EvidencePass } from "./evidence-pass.server";
import { isValidTimestamp } from "./evidence-pass.server";

const DEFAULT_MODEL =
  process.env.REPORT_POLISH_MODEL ?? "google/gemini-3-flash-preview";

const POLISH_SYSTEM_PROMPT = `You are a UK casting director, agent and acting coach writing a self-tape audition report. You will NOT be given the video. You will be given a locked EVIDENCE block from a prior pass that did watch the tape.

Rules:
- Use ONLY the supplied evidence as factual ground truth. Do NOT invent observations the evidence does not support.
- Do NOT change any per-category numeric score. The orchestrator will overwrite scores from the evidence pass.
- Do NOT add new timestamped_notes that are not in evidence.timestamps. You may rephrase the note text for an existing timestamp.
- Do NOT add new submission_risk_flags or presentation_notes that the evidence does not support.
- For role_fit_notes, only use the supplied role_fit_signals.
- Use British English throughout (recall not callback, casting brief, self-tape, analysing, prioritised, behaviour, centre, colour).
- Be specific, prioritised, supportive — the same voice as the existing single-pass report.
- Calibrate tone to the supplied performer level.
- NEVER comment on appearance, body, age, race, class, disability, mobility aids, medical devices, or socioeconomic status.
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

export async function runReportPolish(
  args: RunReportPolishArgs,
): Promise<RunReportPolishResult> {
  const model = args.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  // Serialise evidence compactly. No raw model output beyond what we already
  // captured in Step 1 (which is itself bounded and non-PII).
  const evidenceBlock = `LOCKED EVIDENCE (Step 1 — authoritative, do not contradict):\n${JSON.stringify(
    {
      audition_type: args.evidence.audition_type,
      detected_components: args.evidence.detected_components,
      raw_scores: args.evidence.raw_scores,
      sufficiency: args.evidence.sufficiency,
      observations: args.evidence.observations,
      timestamps: args.evidence.timestamps,
      risk_signals: args.evidence.risk_signals,
      role_fit_signals: args.evidence.role_fit_signals,
      presentation_signals: args.evidence.presentation_signals,
    },
    null,
    2,
  )}`;

  const userText = [
    `Audition title: ${args.auditionTitle}`,
    args.levelBlock,
    args.briefBlock,
    args.extractedBlock,
    args.signalsBlock,
    evidenceBlock,
    "Write the final structured report via submit_audition_report. Use the locked evidence as ground truth. Do not invent new timestamps, risk flags, or presentation notes.",
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
    return { ok: true, report, durationMs: Date.now() - startedAt, model, httpStatus: resp.status };
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

export type EnforceResult = {
  locked_field_overwrites: number;
  unsupported_claims_removed: number;
  unsupported_claims_rewritten: number;
};

/**
 * Overwrite locked fields on the polished report from Step 1 evidence.
 * The orchestrator will still run its existing recompute / caps /
 * material-policy passes after this.
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
  // Scores: trust Step 1 evidence raw_scores. Existing recompute downstream
  // takes these and applies weights/caps.
  set("scores", { ...evidence.raw_scores });

  // Replace timestamped_notes with the validated Step 1 set (allow polish
  // to rephrase the note text for an existing timestamp; never add new ones).
  const allowedTimestamps = new Map<string, string>();
  for (const t of evidence.timestamps) {
    if (isValidTimestamp(t.timestamp)) allowedTimestamps.set(t.timestamp, t.note);
  }
  const polishedNotes: Array<{ timestamp: string; note: string }> = Array.isArray(
    report.timestamped_notes,
  )
    ? report.timestamped_notes
    : [];
  const finalNotes: Array<{ timestamp: string; note: string }> = [];
  for (const [ts, evNote] of allowedTimestamps.entries()) {
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
  set("timestamped_notes", finalNotes);

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

/**
 * Conservative unsupported-claim enforcement.
 *
 * Strict (drop new entries that don't appear in evidence):
 *   - timestamped_notes (already enforced via locked fields above)
 *   - submission_risk_flags
 *   - presentation_notes
 *   - role_fit_notes (replaced with evidence-grounded text if unsupported)
 *
 * Soft (rewrite, never delete):
 *   - strengths
 *   - improvements
 *
 * Strengths/improvements are deleted ONLY if clearly contradicted by
 * sufficiency (e.g. claims strong audio when evidence.sufficiency.has_audio
 * is false).
 */
export function enforceUnsupportedClaims(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  evidence: EvidencePass,
): { removed: number; rewritten: number } {
  let removed = 0;
  let rewritten = 0;

  const evidenceCorpus: string[] = [
    ...evidence.observations,
    ...evidence.risk_signals,
    ...evidence.role_fit_signals,
    ...evidence.presentation_signals,
    ...evidence.timestamps.map((t) => t.note),
    ...evidence.detected_components.map((c) => c.note ?? ""),
  ]
    .filter((s) => typeof s === "string" && s.length > 0)
    .map((s) => s.toLowerCase());

  // ---- Strict: submission_risk_flags ----
  if (Array.isArray(report.submission_risk_flags)) {
    const riskCorpus = [
      ...evidence.risk_signals.map((s) => s.toLowerCase()),
      ...evidence.observations.map((s) => s.toLowerCase()),
    ];
    const filtered = report.submission_risk_flags.filter(
      (rf: { severity?: string; flag?: string }) => {
        if (!rf || typeof rf.flag !== "string") return false;
        const score = overlapScore(rf.flag, riskCorpus);
        const ok = score >= 0.4;
        if (!ok) removed += 1;
        return ok;
      },
    );
    report.submission_risk_flags = filtered;
  }

  // ---- Strict: presentation_notes ----
  if (Array.isArray(report.presentation_notes)) {
    const presCorpus = [
      ...evidence.presentation_signals.map((s) => s.toLowerCase()),
      ...evidence.observations.map((s) => s.toLowerCase()),
    ];
    const filtered = report.presentation_notes.filter((n: unknown) => {
      if (typeof n !== "string" || n.trim().length === 0) return false;
      const score = overlapScore(n, presCorpus);
      const ok = score >= 0.4;
      if (!ok) removed += 1;
      return ok;
    });
    report.presentation_notes = filtered;
  }

  // ---- Strict-ish: role_fit_notes ----
  if (typeof report.role_fit_notes === "string" && report.role_fit_notes.trim().length > 0) {
    const score = overlapScore(report.role_fit_notes, evidence.role_fit_signals.map((s) => s.toLowerCase()));
    if (evidence.role_fit_signals.length === 0) {
      // No role-fit signals captured — Step 1 didn't see enough. Blank it.
      if (report.role_fit_notes !== "") {
        report.role_fit_notes = "";
        removed += 1;
      }
    } else if (score < 0.3) {
      // Replace with evidence-grounded wording.
      const replacement = `Role fit, based on observable evidence: ${evidence.role_fit_signals.slice(0, 2).join("; ")}.`;
      if (report.role_fit_notes !== replacement) {
        report.role_fit_notes = replacement;
        rewritten += 1;
      }
    }
  }

  // ---- Soft: strengths / improvements ----
  const sufficiencyContradicts = (claim: string): boolean => {
    const c = claim.toLowerCase();
    if (!evidence.sufficiency.has_audio && /\b(audio|sound|clear voice|diction|projection)\b/.test(c) && /\b(strong|excellent|great|clear|good)\b/.test(c)) {
      return true;
    }
    if (!evidence.sufficiency.has_visible_face && /\b(eye(line|s)?|expression|face|micro[- ]expressions?)\b/.test(c) && /\b(strong|excellent|great|good|clear)\b/.test(c)) {
      return true;
    }
    return false;
  };

  const evidenceLines: string[] = [
    ...evidence.observations,
    ...evidence.timestamps.map((t) => t.note),
    ...evidence.detected_components.map((c) => c.note ?? ""),
  ].filter((s) => typeof s === "string" && s.length > 0);

  const softProcess = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const raw of arr) {
      if (typeof raw !== "string" || raw.trim().length === 0) continue;
      if (sufficiencyContradicts(raw)) {
        removed += 1;
        continue;
      }
      const score = overlapScore(raw, evidenceCorpus);
      if (score >= 0.3) {
        out.push(raw);
      } else {
        // Rewrite to align with closest evidence line, preserving the original
        // intent shape (strength vs improvement is a per-array concern, the
        // caller knows which array this is).
        const closest = closestEvidence(raw, evidenceLines);
        if (closest) {
          out.push(closest);
          rewritten += 1;
        } else {
          // No anchor available — keep original rather than delete.
          out.push(raw);
        }
      }
    }
    return out;
  };

  if (Array.isArray(report.strengths)) report.strengths = softProcess(report.strengths);
  if (Array.isArray(report.improvements)) report.improvements = softProcess(report.improvements);

  return { removed, rewritten };
}

// ---------- Deterministic fallback renderer ----------

/**
 * Build a minimal, valid report directly from Step 1 evidence when Step 2
 * fails. The orchestrator's existing post-process (recompute, caps, material
 * policy, verdict, block reasons) runs over this exactly as it would over a
 * polished report.
 */
export function renderFallbackReport(
  evidence: EvidencePass,
  mode: "brief" | "baseline",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const top = (arr: string[], n: number): string[] => arr.slice(0, n).filter((s) => s.length > 0);
  const obs = evidence.observations;
  const strengths = top(obs.filter((o) => /\b(strong|clear|good|consistent|grounded|connected|specific|truthful|present)\b/i.test(o)), 3);
  const improvements = top(
    [
      ...evidence.risk_signals,
      ...obs.filter((o) => /\b(unclear|weak|low|missing|inconsistent|drift|push|over)\b/i.test(o)),
    ],
    3,
  );

  return {
    mode,
    audition_type: evidence.audition_type,
    detected_components: evidence.detected_components,
    consistency_modifier: 0,
    confidence: 60,
    confidence_reason: "Generated from evidence pass (polish step unavailable).",
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
    casting_insight: "Polish step unavailable — see strengths and improvements below.",
    scores: { ...evidence.raw_scores },
    brief_adherence_breakdown: {
      material_compliance: evidence.raw_scores.brief_adherence,
      technical_compliance: evidence.raw_scores.brief_adherence,
      instruction_precision: evidence.raw_scores.brief_adherence,
      professionalism_signals: evidence.raw_scores.brief_adherence,
      note: "Derived from evidence pass.",
    },
    category_notes: {
      technical: obs.find((o) => /technical|frame|lighting|focus/i.test(o)) ?? "",
      audio: obs.find((o) => /audio|sound|voice|hear/i.test(o)) ?? "",
      vocal: obs.find((o) => /sing|vocal|pitch/i.test(o)) ?? "",
      acting: obs.find((o) => /acting|intention|connection/i.test(o)) ?? "",
      brief_adherence: obs.find((o) => /brief|instruction|requirement/i.test(o)) ?? "",
      professional_presentation: obs.find((o) => /slate|present|pace/i.test(o)) ?? "",
    },
    strengths: strengths.length > 0 ? strengths : ["Performance captured for review."],
    improvements: improvements.length > 0 ? improvements : ["Continue refining the take."],
    fix_first: improvements[0] ?? "",
    timestamped_notes: evidence.timestamps.map((t) => ({ timestamp: t.timestamp, note: t.note })),
    coaching_drills: ["Re-run the take with sharper choices on the strongest moment."],
    submission_risk_flags: evidence.risk_signals.map((r) => ({ severity: "low", flag: r })),
    casting_risk_explanations: [],
    role_fit_notes:
      mode === "brief" && evidence.role_fit_signals.length > 0
        ? `Role fit observations: ${evidence.role_fit_signals.slice(0, 2).join("; ")}.`
        : "",
    role_fit_modifier: 0,
    role_fit_confidence: "low",
    presentation_notes: evidence.presentation_signals.slice(0, 3),
    at_risk: evidence.raw_scores.brief_adherence < 40 && mode === "brief",
  };
}
