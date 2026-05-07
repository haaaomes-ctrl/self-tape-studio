// SERVER-ONLY. Phase 2 QA trace persistence.
//
// Writes structural-only summaries to `take_qa_traces` (RLS deny-all to
// ordinary clients; service-role only). Gated by `future_qa_trace_enabled`
// at call sites. No prose, quotes, or PII may be passed in.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { toQaTracePayload, type FutureShadowResult } from "./shadow-scoring.server";

export interface WriteQaTraceArgs {
  takeId: string;
  shadow: FutureShadowResult;
}

export async function writeQaTrace(
  args: WriteQaTraceArgs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const payload = toQaTracePayload(args.shadow);
    const { error } = await supabaseAdmin
      .from("take_qa_traces")
      .upsert(
        {
          take_id: args.takeId,
          schema_version: payload.schema_version,
          branch: payload.branch,
          components_summary: payload.components_summary as never,
          dimensions_summary: payload.dimensions_summary as never,
          sufficiency: payload.sufficiency as never,
          scrub_counters: payload.scrub_counters as never,
          shadow_divergence: payload.shadow_divergence as never,
        },
        { onConflict: "take_id" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
