import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  takeId: z.string().uuid(),
});

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
        "at_risk",
      ],
    },
  },
};

function buildSystemPrompt(): string {
  return `You are a seasoned musical theatre casting director and vocal coach reviewing a self-tape audition.

Your role is JUDGEMENT, not measurement. Be a credible first-pass casting reader: encouraging, specific, prioritised, never harsh or vague.

You will receive:
- The video itself (multimodal) — watch and listen.
- An optional casting brief.
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

BRIEF ADHERENCE is now structured (all 0–100, then combined into the single brief_adherence score using 35/35/20/10 weights):
- Material Compliance (35%): right sides, right song type, nothing missing, nothing extra.
- Technical Compliance (35%): orientation, framing, single-file / naming rules.
- Instruction Precision (20%): accent, ordering, continuity, use of guides.
- Professionalism Signals (10%): slate clarity, submission cleanliness, audition etiquette.
In BASELINE mode treat these as professional-standards equivalents and do NOT penalise for unknown constraints.

Professional Presentation is SEPARATE from compliance — it covers slate clarity, pacing discipline, camera awareness, and single-take logic.

Hard rules:
- If audio clarity < 50, cap final overall at 65.
- If brief_adherence < 40 and mode is BRIEF, set at_risk=true.
- Don't penalise portrait orientation unless the brief required landscape.
- First 5 seconds matter: strong start +5, weak start −5 on acting.
- Treat technical signals as MODIFIERS, not dominant inputs. The video itself is your primary evidence.

Submission Risk Flags:
- Surface concrete casting-compliance risks that would cause rejection. Examples: "Portrait orientation but brief required landscape", "Song exceeds the 32-bar cut", "Missing slate/ident", "Uploaded as multiple clips — brief specified single file".
- Keep empty if none.

Confidence (0–100):
- 90+ when full brief and clean signals.
- 75–89 with partial brief or minor signal issues.
- 60–74 baseline with no brief.
- <60 if data is poor.

Output via the submit_audition_report tool. The casting_headline must be ONE plain-language sentence pinpointing the single most important thing the user should know. casting_insight is a one-line castability read. Keep all feedback constructive, specific, and actionable.`;
}

// Pick the video URL Gemini should analyse, based on how many attempts we've made.
// Tier 0 → Standard (Mux ~720p MP4)
// Tier 1 → High     (Mux ~1080p MP4)
// Tier 2 → Original (signed Supabase URL of the raw upload — last resort)
type Tier = "standard" | "high" | "original";

async function pickAnalysisSource(take: {
  id: string;
  video_path: string;
  attempt_count: number | null;
  mux_mp4_standard_url: string | null;
  mux_mp4_high_url: string | null;
  mux_status: string | null;
}): Promise<{ url: string; tier: Tier }> {
  const attempt = take.attempt_count ?? 0;

  // Tier order: Standard → High → Original
  if (attempt === 0 && take.mux_mp4_standard_url) {
    return { url: take.mux_mp4_standard_url, tier: "standard" };
  }
  if (attempt === 1 && take.mux_mp4_high_url) {
    return { url: take.mux_mp4_high_url, tier: "high" };
  }
  if (attempt >= 2 || (!take.mux_mp4_standard_url && !take.mux_mp4_high_url)) {
    // Fall back to the original file in Supabase storage via a short-lived signed URL.
    const { data: signed, error } = await supabaseAdmin.storage
      .from("audition-videos")
      .createSignedUrl(take.video_path, 60 * 60);
    if (error || !signed) throw new Error("Could not create signed URL for original video");
    return { url: signed.signedUrl, tier: "original" };
  }

  // Mux is still transcoding — bail and let the webhook re-trigger us when ready.
  throw new Error("Video is still being optimised — please try again in a moment.");
}

export const processTake = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { takeId } = data;

    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select(
        "id, user_id, audition_id, video_path, signals, checklist, status, attempt_count, mux_status, mux_mp4_standard_url, mux_mp4_high_url",
      )
      .eq("id", takeId)
      .single();

    if (takeErr || !take) {
      return { ok: false, error: "Take not found" };
    }
    if (take.status === "complete") {
      return { ok: true, alreadyDone: true };
    }

    const { data: audition, error: audErr } = await supabaseAdmin
      .from("auditions")
      .select("id, brief, brief_source, mode, title")
      .eq("id", take.audition_id)
      .single();

    if (audErr || !audition) {
      return { ok: false, error: "Audition not found" };
    }

    await supabaseAdmin
      .from("takes")
      .update({ status: "processing", error_message: null })
      .eq("id", takeId);

    try {
      const { url: videoUrl, tier } = await pickAnalysisSource(take);

      // Bump attempt counter + record which tier we tried, so a future retry
      // walks up the ladder (Standard → High → Original).
      await supabaseAdmin
        .from("takes")
        .update({
          attempt_count: (take.attempt_count ?? 0) + 1,
          analysis_tier: tier,
        })
        .eq("id", takeId);

      const briefBlock = audition.brief
        ? `CASTING BRIEF (${audition.brief_source}):\n${audition.brief}`
        : `NO BRIEF PROVIDED — apply BASELINE rubric. Do not invent constraints.`;

      const signalsBlock = `TECHNICAL SIGNALS (modifiers, not primary):\n${JSON.stringify(
        { signals: take.signals, checklist: take.checklist },
        null,
        2,
      )}`;

      const userText = [
        `Audition title: ${audition.title}`,
        briefBlock,
        signalsBlock,
        `Analysis tier: ${tier} rendition (the user's original performance is intact — only technical encoding was standardised).`,
        "Watch and listen to the attached self-tape, structure it (detect components), and submit a structured report via the submit_audition_report tool. Be specific, prioritised, and constructive.",
      ].join("\n\n");

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

      const callAI = (mediaPart: { type: "image_url"; image_url: { url: string } }) =>
        fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: buildSystemPrompt() },
              {
                role: "user",
                content: [{ type: "text", text: userText }, mediaPart],
              },
            ],
            tools: [REPORT_TOOL],
            tool_choice: { type: "function", function: { name: "submit_audition_report" } },
            max_tokens: 8192,
          }),
        });

      // First try: pass the public Mux URL (or signed-url fallback) directly.
      let aiResp = await callAI({ type: "image_url", image_url: { url: videoUrl } });

      // If the gateway rejects the URL (some gateways only accept inline media for
      // video), download the (already-compressed) rendition and inline it as base64.
      if (!aiResp.ok && aiResp.status === 400) {
        const errText = await aiResp.text();
        console.warn("AI gateway rejected URL; retrying with inline base64", errText.slice(0, 200));
        const dl = await fetch(videoUrl);
        if (!dl.ok) throw new Error(`Could not download rendition (${dl.status})`);
        const buf = new Uint8Array(await dl.arrayBuffer());
        // Safety: only inline if reasonably small (Mux 'medium' MP4s typically are).
        if (buf.byteLength > 120 * 1024 * 1024) {
          throw new Error(
            `Rendition is ${(buf.byteLength / 1024 / 1024).toFixed(0)}MB — too large to inline. Please retry; we'll try a smaller tier next.`,
          );
        }
        let bin = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < buf.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
        }
        const dataUrl = `data:video/mp4;base64,${btoa(bin)}`;
        aiResp = await callAI({ type: "image_url", image_url: { url: dataUrl } });
      }

      if (!aiResp.ok) {
        if (aiResp.status === 429) throw new Error("Rate limited — please try again in a minute.");
        if (aiResp.status === 402)
          throw new Error("AI credits exhausted on this workspace. Add funds to continue.");
        const t = await aiResp.text();
        console.error("AI gateway error", aiResp.status, t.slice(0, 500));
        throw new Error(`AI gateway error (${aiResp.status})`);
      }

      const json = await aiResp.json();
      const choice = json.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("AI did not return a structured report");
      }
      let report;
      try {
        report = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        if (choice?.finish_reason === "length") {
          throw new Error(
            "The AI response was cut off before it finished writing the report. Please retry — if it keeps failing, try a shorter take.",
          );
        }
        console.error("AI JSON parse failed", parseErr, toolCall.function.arguments?.slice(-300));
        throw new Error("The AI returned an incomplete report. Please retry.");
      }

      let overall = report.overall_score as number;
      const audioScore = report.scores?.audio ?? 100;
      if (audioScore < 50 && overall > 65) overall = 65;

      await supabaseAdmin
        .from("takes")
        .update({
          status: "complete",
          report,
          scores: report.scores,
          overall_score: overall,
          confidence: report.confidence,
          error_message: null,
        })
        .eq("id", takeId);

      await supabaseAdmin
        .from("auditions")
        .update({ mode: report.mode })
        .eq("id", audition.id);

      return { ok: true, tier };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown processing error";
      console.error("processTake failed", message);
      await supabaseAdmin
        .from("takes")
        .update({ status: "error", error_message: message })
        .eq("id", takeId);
      return { ok: false, error: message };
    }
  });

// Replace the video file for an existing take and re-run processing.
// Used to recover from failed or stuck takes without creating a new take row.
export const replaceTakeVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
        newVideoPath: z.string().min(1).max(500),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signals: z.any().optional(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklist: z.any().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { takeId, newVideoPath, signals, checklist } = data;

    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, video_path")
      .eq("id", takeId)
      .single();
    if (takeErr || !take) return { ok: false, error: "Take not found" };

    // Best-effort delete of the old file so we don't leak storage.
    if (take.video_path && take.video_path !== newVideoPath) {
      await supabaseAdmin.storage.from("audition-videos").remove([take.video_path]).catch(() => {});
    }

    await supabaseAdmin
      .from("takes")
      .update({
        video_path: newVideoPath,
        status: "pending",
        error_message: null,
        report: null,
        scores: null,
        overall_score: null,
        confidence: null,
        signals: signals ?? null,
        checklist: checklist ?? null,
        // Reset Mux + retry state so the new file walks the ladder fresh.
        attempt_count: 0,
        analysis_tier: null,
        mux_status: "none",
        mux_upload_id: null,
        mux_asset_id: null,
        mux_playback_id: null,
        mux_mp4_standard_url: null,
        mux_mp4_high_url: null,
      })
      .eq("id", takeId);

    // Caller should follow up with ingestTakeToMux() to kick off the Mux pipeline.
    return { ok: true };
  });

// Manually reset a stuck/errored take so the user can retry or replace it.
export const resetTake = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ takeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("takes")
      .update({ status: "error", error_message: "Cancelled by user — ready to replace." })
      .eq("id", data.takeId);
    return { ok: true };
  });
