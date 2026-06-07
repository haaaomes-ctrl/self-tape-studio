// SERVER-ONLY (worker-shared): ARCH-Δ3 evidence-binding gate kill-switch.
//
// Same narrow-read design as report-view-config.server.ts and for the same
// reason: adding a column to getResolvedConfig()'s explicit select() would
// fail the whole config query while a migration lags a deploy, dropping
// every field to SAFE_DEFAULTS — including quota_enabled=true.
//
// Polarity differs deliberately: this protects report truthfulness, so
// EVERY failure path (missing row, missing column, query error) returns
// TRUE — the gate fails OPEN TO ON. Setting the column to false is the
// only way to disable it (instant, no deploy, via /api/public/admin-config).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getEvidenceBindingGateEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select("evidence_binding_gate_enabled")
      .eq("id", "singleton")
      .maybeSingle();
    if (error || !data) return true;
    const value = (data as Record<string, unknown>).evidence_binding_gate_enabled;
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
}
