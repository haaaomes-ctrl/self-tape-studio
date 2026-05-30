import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { metric } from "@/server/metrics.server";
import { releaseReportCreditForTake } from "@/server/credit-ledger.server";

export const FINALISING_ORPHAN_SECONDS = 90;
export const FINALISING_ORPHAN_MS = FINALISING_ORPHAN_SECONDS * 1000;
export const ANALYSING_ORPHAN_SECONDS = 180;
export const ANALYSING_ORPHAN_MS = ANALYSING_ORPHAN_SECONDS * 1000;

export type FinalisingRecoveryResult =
  | "not_stale"
  | "recovered_complete"
  | "forced_error"
  | "recover_complete_failed"
  | "force_error_failed";

export type AnalysingRecoveryResult = FinalisingRecoveryResult;

export function isFinalisingHeartbeatStale(staleHeartbeatMs: number): boolean {
  return Number.isFinite(staleHeartbeatMs) && staleHeartbeatMs >= FINALISING_ORPHAN_MS;
}

export function finalisingOrphanCutoffIso(now = Date.now()): string {
  return new Date(now - FINALISING_ORPHAN_MS).toISOString();
}

export function isAnalysingHeartbeatStale(staleHeartbeatMs: number): boolean {
  return Number.isFinite(staleHeartbeatMs) && staleHeartbeatMs >= ANALYSING_ORPHAN_MS;
}

export function analysingOrphanCutoffIso(now = Date.now()): string {
  return new Date(now - ANALYSING_ORPHAN_MS).toISOString();
}

async function refundReportCreditAfterRecoveryForcedError(params: {
  takeId: string;
  source: string;
  processingPhase: string;
  failureCode: string;
}) {
  try {
    const result = await releaseReportCreditForTake({
      take_id: params.takeId,
      release_status: "refunded",
      release_reason: "reconciler_forced_error",
      failure_code: params.failureCode,
      metadata: {
        trigger: params.source,
        processing_phase: params.processingPhase,
        report_credit_restored_message:
          "A reserved TapeCoach credit was returned because report generation did not complete.",
      },
    });
    metric("report_credit_released", {
      take_id: params.takeId,
      reason: params.failureCode,
      release_status: "refunded",
      released: result.released,
    });
  } catch (err) {
    console.warn("[take-pipeline] recovery_forced_error_credit_refund_failed", {
      take_id: params.takeId,
      source: params.source,
      processing_phase: params.processingPhase,
      failure_code: params.failureCode,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function recoverFinalisingTake(params: {
  takeId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  report?: unknown;
  scores?: unknown;
  now?: number;
  source: string;
}): Promise<FinalisingRecoveryResult> {
  const now = params.now ?? Date.now();
  let row: {
    id: string;
    created_at: string | null;
    updated_at: string | null;
    processing_phase: string | null;
    status: string | null;
    report: unknown;
    scores: unknown;
  } | null = null;

  if (params.report !== undefined || params.scores !== undefined) {
    row = {
      id: params.takeId,
      created_at: params.createdAt ?? null,
      updated_at: params.updatedAt ?? null,
      processing_phase: "finalising",
      status: "processing",
      report: params.report,
      scores: params.scores,
    };
  } else {
    const { data, error } = await supabaseAdmin
      .from("takes")
      .select("id, created_at, updated_at, processing_phase, status, report, scores")
      .eq("id", params.takeId)
      .maybeSingle();
    if (error) {
      console.error("finalising_orphan_select_failed", {
        takeId: params.takeId,
        source: params.source,
        error,
      });
      return "force_error_failed";
    }
    row = data;
  }

  if (!row || row.status !== "processing" || row.processing_phase !== "finalising") {
    return "not_stale";
  }

  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const idleMs = updatedAt > 0 ? now - updatedAt : Number.POSITIVE_INFINITY;
  if (idleMs < FINALISING_ORPHAN_MS) return "not_stale";

  const createdAt = row.created_at ? new Date(row.created_at).getTime() : now;
  const ageSeconds = Math.max(0, Math.round((now - createdAt) / 1000));
  const idleSeconds = Math.max(0, Math.round(idleMs / 1000));
  const hasReport = row.report && typeof row.report === "object";
  const hasScores = row.scores && typeof row.scores === "object";

  if (hasReport && hasScores) {
    const { error } = await supabaseAdmin
      .from("takes")
      .update({
        status: "complete",
        processing_phase: "complete",
        error_message: null,
      })
      .eq("id", params.takeId)
      .eq("processing_phase", "finalising")
      .eq("status", "processing");
    if (error) {
      console.error("finalising_orphan_recover_complete_failed", {
        takeId: params.takeId,
        source: params.source,
        error,
      });
      metric("phase_transition_failure", {
        take_id: params.takeId,
        reason: "finalising_orphan_recover_complete_failed",
      });
      return "recover_complete_failed";
    }
    console.warn("[take-pipeline] finalising_orphan_recovered_complete", {
      take_id: params.takeId,
      source: params.source,
      age_seconds: ageSeconds,
      idle_seconds: idleSeconds,
    });
    metric("reconciler_recovered_complete", {
      take_id: params.takeId,
      processing_phase: "finalising",
      reason: "report_present",
      source: params.source,
    });
    return "recovered_complete";
  }

  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message:
        "[failure_code:finalising_orphan] We couldn't finish your report this time. Please try again.",
    })
    .eq("id", params.takeId)
    .eq("processing_phase", "finalising")
    .eq("status", "processing");
  if (error) {
    console.error("finalising_orphan_force_error_failed", {
      takeId: params.takeId,
      source: params.source,
      error,
    });
    metric("phase_transition_failure", {
      take_id: params.takeId,
      reason: "finalising_orphan_force_error_failed",
    });
    return "force_error_failed";
  }

  console.warn("[take-pipeline] finalising_orphan_forced_error", {
    take_id: params.takeId,
    source: params.source,
    age_seconds: ageSeconds,
    idle_seconds: idleSeconds,
    processing_phase: "finalising",
  });
  await refundReportCreditAfterRecoveryForcedError({
    takeId: params.takeId,
    source: params.source,
    processingPhase: "finalising",
    failureCode: "finalising_orphan",
  });
  metric("reconciler_forced_error", {
    take_id: params.takeId,
    processing_phase: "finalising",
    reason: "finalising_orphan",
    failure_code: "finalising_orphan",
    source: params.source,
  });
  metric("reconciler_forced_error_count", {
    take_id: params.takeId,
    processing_phase: "finalising",
    failure_code: "finalising_orphan",
    source: params.source,
  });
  metric("analysis_failed", {
    take_id: params.takeId,
    processing_phase: "finalising",
    reason: "finalising_orphan",
    failure_code: "finalising_orphan",
    source: params.source,
  });
  return "forced_error";
}

export async function recoverAnalysingTake(params: {
  takeId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  processingPhase?: string | null;
  report?: unknown;
  scores?: unknown;
  now?: number;
  source: string;
}): Promise<AnalysingRecoveryResult> {
  const now = params.now ?? Date.now();
  let row: {
    id: string;
    created_at: string | null;
    updated_at: string | null;
    processing_phase: string | null;
    status: string | null;
    report: unknown;
    scores: unknown;
  } | null = null;

  if (
    params.report !== undefined ||
    params.scores !== undefined ||
    params.status !== undefined ||
    params.processingPhase !== undefined
  ) {
    row = {
      id: params.takeId,
      created_at: params.createdAt ?? null,
      updated_at: params.updatedAt ?? null,
      processing_phase: params.processingPhase ?? null,
      status: params.status ?? null,
      report: params.report,
      scores: params.scores,
    };
  } else {
    const { data, error } = await supabaseAdmin
      .from("takes")
      .select("id, created_at, updated_at, processing_phase, status, report, scores")
      .eq("id", params.takeId)
      .maybeSingle();
    if (error) {
      console.error("analysing_orphan_select_failed", {
        takeId: params.takeId,
        source: params.source,
        error,
      });
      return "force_error_failed";
    }
    row = data;
  }

  if (
    !row ||
    !["pending", "processing"].includes(row.status ?? "") ||
    !["analysis_pending", "analysing"].includes(row.processing_phase ?? "")
  ) {
    return "not_stale";
  }

  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const idleMs = updatedAt > 0 ? now - updatedAt : Number.POSITIVE_INFINITY;
  if (idleMs < ANALYSING_ORPHAN_MS) return "not_stale";

  const createdAt = row.created_at ? new Date(row.created_at).getTime() : now;
  const ageSeconds = Math.max(0, Math.round((now - createdAt) / 1000));
  const idleSeconds = Math.max(0, Math.round(idleMs / 1000));
  const hasReport = row.report && typeof row.report === "object";
  const hasScores = row.scores && typeof row.scores === "object";

  if (hasReport && hasScores) {
    const { error } = await supabaseAdmin
      .from("takes")
      .update({
        status: "complete",
        processing_phase: "complete",
        error_message: null,
      })
      .eq("id", params.takeId)
      .in("processing_phase", ["analysis_pending", "analysing"])
      .in("status", ["pending", "processing"]);
    if (error) {
      console.error("analysing_orphan_recover_complete_failed", {
        takeId: params.takeId,
        source: params.source,
        error,
      });
      metric("phase_transition_failure", {
        take_id: params.takeId,
        reason: "analysing_orphan_recover_complete_failed",
      });
      return "recover_complete_failed";
    }
    console.warn("[take-pipeline] analysing_orphan_recovered_complete", {
      take_id: params.takeId,
      source: params.source,
      age_seconds: ageSeconds,
      idle_seconds: idleSeconds,
      processing_phase: row.processing_phase,
    });
    metric("reconciler_recovered_complete", {
      take_id: params.takeId,
      processing_phase: row.processing_phase,
      reason: "report_present",
      source: params.source,
    });
    return "recovered_complete";
  }

  const { error } = await supabaseAdmin
    .from("takes")
    .update({
      status: "error",
      processing_phase: "error",
      error_message:
        "[failure_code:analysing_orphan] We couldn't finish your report this time. Please try again.",
    })
    .eq("id", params.takeId)
    .in("processing_phase", ["analysis_pending", "analysing"])
    .in("status", ["pending", "processing"]);
  if (error) {
    console.error("analysing_orphan_force_error_failed", {
      takeId: params.takeId,
      source: params.source,
      error,
    });
    metric("phase_transition_failure", {
      take_id: params.takeId,
      reason: "analysing_orphan_force_error_failed",
    });
    return "force_error_failed";
  }

  console.warn("[take-pipeline] analysing_orphan_forced_error", {
    take_id: params.takeId,
    source: params.source,
    age_seconds: ageSeconds,
    idle_seconds: idleSeconds,
    processing_phase: row.processing_phase,
  });
  await refundReportCreditAfterRecoveryForcedError({
    takeId: params.takeId,
    source: params.source,
    processingPhase: row.processing_phase ?? "analysing",
    failureCode: "analysing_orphan",
  });
  metric("reconciler_forced_error", {
    take_id: params.takeId,
    processing_phase: row.processing_phase,
    reason: "analysing_orphan",
    failure_code: "analysing_orphan",
    source: params.source,
  });
  metric("reconciler_forced_error_count", {
    take_id: params.takeId,
    processing_phase: row.processing_phase,
    failure_code: "analysing_orphan",
    source: params.source,
  });
  metric("analysis_failed", {
    take_id: params.takeId,
    processing_phase: row.processing_phase,
    reason: "analysing_orphan",
    failure_code: "analysing_orphan",
    source: params.source,
  });
  return "forced_error";
}
