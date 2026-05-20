import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runInternalComparisonOperatorTrigger, type CompletedTakeComparisonSource, type InternalComparisonOperatorTriggerInput } from "@/server/v3/qa-artifacts-wiring.server";
import { assertSafeSegment } from "@/server/v3/qa-artifacts.server";

const ADMIN_EMAIL = "o.halawi90@gmail.com";
const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? "";
const COMPLETED_ANALYSIS_STATUSES = new Set(["complete", "completed", "succeeded", "processed"]);
export const assertAdminEmail = (claims: { email?: string | null } | null | undefined) => {
  if (normalizeEmail(claims?.email) !== ADMIN_EMAIL) throw new Response("Forbidden", { status: 403 });
};
export function isExplicitCompletedAnalysisStatus(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return COMPLETED_ANALYSIS_STATUSES.has(normalized);
}

const InternalComparisonTriggerInput = z.object({
  root_take_id: z.string().min(1).max(256),
  compared_take_ids: z.array(z.string().min(1).max(256)).min(2).max(20),
  compared_analysis_run_ids: z.array(z.string().min(1).max(256)).max(20).optional(),
  comparison_run_id: z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/, "comparison_run_id contains unsafe characters").refine((value) => {
    try {
      assertSafeSegment(value, "comparison_run_id");
      return true;
    } catch {
      return false;
    }
  }, { message: "comparison_run_id must be a safe segment" }).optional(),
  comparison_reason: z.enum(["operator_validation", "qa_validation", "same_video_check", "route_variance_check"]).optional(),
});

export async function resolveCompletedTakeComparisonSourceByTakeId(takeId: string): Promise<CompletedTakeComparisonSource | null> {
  try {
    assertSafeSegment(takeId, "take_id");
  } catch {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("takes")
    .select("id, user_id, audition_id, mux_playback_id, mux_asset_id, mux_upload_id, mux_duration_seconds, signals, checklist, status")
    .eq("id", takeId)
    .maybeSingle();
  if (error || !data) return null;
  const analysisRunId = `take-${takeId}`;
  if (!analysisRunId) return null;
  try {
    assertSafeSegment(analysisRunId, "analysis_run_id");
  } catch {
    return null;
  }
  const completed = isExplicitCompletedAnalysisStatus((data as any).status);
  if (!completed) return null;
  return {
    take_id: String((data as any).id ?? takeId),
    analysis_run_id: analysisRunId,
    mux_playback_ref: typeof (data as any).mux_playback_id === "string" ? (data as any).mux_playback_id : null,
    mux_asset_or_upload_id_present: Boolean((data as any).mux_asset_id || (data as any).mux_upload_id),
    user_id: typeof (data as any).user_id === "string" ? (data as any).user_id : null,
    audition_id: typeof (data as any).audition_id === "string" ? (data as any).audition_id : null,
    video_duration_seconds: typeof (data as any).mux_duration_seconds === "number"
      ? (data as any).mux_duration_seconds
      : (typeof (data as any).signals?.duration === "number"
        ? (data as any).signals.duration
        : (typeof (data as any).checklist?.duration?.seconds === "number" ? (data as any).checklist.duration.seconds : null)),
    analysis_route: null,
    model_provider_family: null,
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
    if (process.env.INTERNAL_COMPARISON_TRIGGER_ENABLED !== "true") {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: data.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: data.compared_take_ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "internal_comparison_trigger_disabled",
        blocker_codes: ["internal_comparison_trigger_disabled"],
      };
    }
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
