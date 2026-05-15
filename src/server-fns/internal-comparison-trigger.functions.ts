import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runInternalComparisonOperatorTrigger, type CompletedTakeComparisonSource, type InternalComparisonOperatorTriggerInput } from "@/server/v3/qa-artifacts-wiring.server";

const ADMIN_EMAIL = "o.halawi90@gmail.com";
const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? "";
const assertAdminEmail = (claims: { email?: string | null } | null | undefined) => {
  if (normalizeEmail(claims?.email) !== ADMIN_EMAIL) throw new Response("Forbidden", { status: 403 });
};

const InternalComparisonTriggerInput = z.object({
  root_take_id: z.string().min(1).max(256),
  compared_take_ids: z.array(z.string().min(1).max(256)).min(2).max(20),
  compared_analysis_run_ids: z.array(z.string().min(1).max(256)).max(20).optional(),
  comparison_run_id: z.string().min(1).max(256).optional(),
  comparison_reason: z.enum(["operator_validation", "qa_validation", "same_video_check", "route_variance_check"]).optional(),
});

export async function resolveCompletedTakeComparisonSourceByTakeId(takeId: string): Promise<CompletedTakeComparisonSource | null> {
  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("id, analysis_run_id, mux_playback_id, analysis_route, model_provider_family, analysis_status")
    .eq("id", takeId)
    .maybeSingle();
  if (error || !data) return null;
  const analysisRunId = typeof (data as any).analysis_run_id === "string" ? (data as any).analysis_run_id : null;
  const status = typeof (data as any).analysis_status === "string" ? String((data as any).analysis_status).toLowerCase() : "";
  const completed = Boolean(analysisRunId) && (status === "completed" || status === "succeeded" || status === "processed" || status === "");
  return {
    take_id: String((data as any).id ?? takeId),
    analysis_run_id: analysisRunId ?? "",
    mux_playback_ref: typeof (data as any).mux_playback_id === "string" ? (data as any).mux_playback_id : null,
    analysis_route: typeof (data as any).analysis_route === "string" ? (data as any).analysis_route : null,
    model_provider_family: typeof (data as any).model_provider_family === "string" ? (data as any).model_provider_family : null,
    completed,
    artefact_summaries: {},
  };
}

export async function runAdminInternalComparisonTriggerImpl(input: InternalComparisonOperatorTriggerInput, resolver = resolveCompletedTakeComparisonSourceByTakeId) {
  return runInternalComparisonOperatorTrigger(input, resolver);
}

export const runInternalComparisonOperatorTriggerFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => InternalComparisonTriggerInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdminEmail((context as { claims?: { email?: string | null } }).claims);
    return runAdminInternalComparisonTriggerImpl({
      root_take_id: data.root_take_id,
      compared_take_ids: data.compared_take_ids,
      compared_analysis_run_ids: data.compared_analysis_run_ids,
      comparison_run_id: data.comparison_run_id,
      source_module: "src/server-fns/internal-comparison-trigger.functions.ts",
      source_stage: `admin_internal_comparison_trigger:${data.comparison_reason ?? "operator_validation"}`,
      internal_qa_emit: true,
    });
  });
