import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  takeId: z.string().uuid(),
});

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
          description: "Inferred type: singing, acting, musical_theatre, dance, commercial, or unknown",
        },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        confidence_reason: { type: "string" },
        overall_score: { type: "integer", minimum: 0, maximum: 100 },
        casting_headline: {
          type: "string",
          description:
            "One plain-language sentence at the top of the report, e.g. 'This tape is strongest for voice.' or 'This tape is most weakened by unclear audio.'",
        },
        scores: {
          type: "object",
          properties: {
            technical: { type: "integer", minimum: 0, maximum: 100 },
            audio: { type: "integer", minimum: 0, maximum: 100 },
            vocal: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            acting: { type: "integer", minimum: 0, maximum: 100 },
            brief_adherence: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["technical", "audio", "acting", "brief_adherence"],
        },
        category_notes: {
          type: "object",
          properties: {
            technical: { type: "string" },
            audio: { type: "string" },
            vocal: { type: "string" },
            acting: { type: "string" },
            brief_adherence: { type: "string" },
          },
          required: ["technical", "audio", "acting", "brief_adherence"],
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
        at_risk: { type: "boolean" },
      },
      required: [
        "mode",
        "audition_type",
        "confidence",
        "overall_score",
        "casting_headline",
        "scores",
        "category_notes",
        "strengths",
        "improvements",
        "fix_first",
        "timestamped_notes",
        "coaching_drills",
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

Use TWO modes:
- BRIEF mode: when a casting brief is supplied, extract intent (audition type, constraints, priority skills) and weight scoring accordingly.
- BASELINE mode: when no brief is supplied, apply a balanced professional rubric. Do NOT penalise unknown constraints.

Scoring rubric (0–100 per category):
- Technical Setup, Audio Clarity, Vocal Performance (only when singing is present), Acting/Performance, Brief Adherence (Mode A) or Professional Standards (Mode B).

Hard rules:
- If audio quality is poor (clarity < 50), cap overall at 65.
- If brief explicitly required something missing, mark at_risk=true.
- Don't penalise portrait orientation unless the brief required landscape.
- First 5 seconds matter: strong start gives a small bonus, weak start a small penalty.
- Treat technical signals as MODIFIERS, not dominant inputs. The video itself is your primary evidence.

Confidence (0–100):
- 90+ when full brief and clean signals.
- 75–89 with partial brief or minor signal issues.
- 60–74 baseline with no brief.
- <60 if data is poor.

Output via the submit_audition_report tool. The casting_headline must be one plain-language sentence pinpointing the single most important thing the user should know — e.g. "This tape is strongest for voice." or "Weakened most by unclear audio." Keep all feedback constructive, specific, and actionable.`;
}

export const processTake = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { takeId } = data;

    // Fetch take + parent audition (admin client; we already validated takeId is a UUID).
    const { data: take, error: takeErr } = await supabaseAdmin
      .from("takes")
      .select("id, user_id, audition_id, video_path, signals, checklist, status")
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
      // Signed URL so Gemini can fetch the video.
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("audition-videos")
        .createSignedUrl(take.video_path, 60 * 30);
      if (signErr || !signed) throw new Error("Could not create signed URL for video");

      // Download the file and convert to base64 for inline_data — most reliable for Gemini through the gateway.
      const videoResp = await fetch(signed.signedUrl);
      if (!videoResp.ok) throw new Error(`Could not fetch video (${videoResp.status})`);
      const videoBuf = await videoResp.arrayBuffer();
      // Cap to ~20MB inline; bigger files we still try but warn.
      const sizeMb = videoBuf.byteLength / (1024 * 1024);
      if (sizeMb > 25) {
        throw new Error(
          `Video is ${sizeMb.toFixed(1)}MB. Please upload a clip under 25MB for now.`,
        );
      }
      const base64 = btoa(
        new Uint8Array(videoBuf).reduce((acc, b) => acc + String.fromCharCode(b), ""),
      );
      const mimeType = videoResp.headers.get("content-type") || "video/mp4";

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
        "Watch and listen to the attached self-tape, then submit a structured report via the submit_audition_report tool. Be specific and constructive.",
      ].join("\n\n");

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: [
                { type: "text", text: userText },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
              ],
            },
          ],
          tools: [REPORT_TOOL],
          tool_choice: { type: "function", function: { name: "submit_audition_report" } },
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          throw new Error("Rate limited — please try again in a minute.");
        }
        if (aiResp.status === 402) {
          throw new Error("AI credits exhausted on this workspace. Add funds to continue.");
        }
        const t = await aiResp.text();
        console.error("AI gateway error", aiResp.status, t.slice(0, 500));
        throw new Error(`AI gateway error (${aiResp.status})`);
      }

      const json = await aiResp.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("AI did not return a structured report");
      }
      let report;
      try {
        report = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error("AI returned malformed JSON");
      }

      // Apply hard arbitration rules
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
        })
        .eq("id", takeId);

      // Update audition mode if it was set to baseline but a brief was used in this run
      await supabaseAdmin
        .from("auditions")
        .update({ mode: report.mode })
        .eq("id", audition.id);

      return { ok: true };
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
