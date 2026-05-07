// SERVER-ONLY: resolves the admin-managed app configuration with safe
// fallbacks. The config lives in public.app_config (singleton row, RLS
// deny-all). Only service-role server code can read or update it.
//
// All callers go through `getResolvedConfig()` so the safe-default logic
// lives in exactly one place. If the row is missing, malformed, or the
// query fails, we fall back to the documented safe defaults — the app
// must never crash because of a misconfigured row.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ResolvedConfig {
  quota_enabled: boolean;
  daily_submission_cap: number;
  max_takes_per_audition: number;
  // Future-state rollout flags (Phase 0 foundation). All default off.
  // - future_evidence_enabled: Step 1 emits component dimension evidence (Phase 1).
  // - future_report_enabled:   v2 component-first report schema + UI (Phase 3).
  // - future_qa_trace_enabled: persists QA-safe traces for admin review (Phase 4).
  future_evidence_enabled: boolean;
  future_report_enabled: boolean;
  future_qa_trace_enabled: boolean;
  source: "config" | "default";
}

export const SAFE_DEFAULTS: Omit<ResolvedConfig, "source"> = {
  quota_enabled: true,
  daily_submission_cap: 5,
  max_takes_per_audition: 3,
  future_evidence_enabled: false,
  future_report_enabled: false,
  future_qa_trace_enabled: false,
};

function sanitiseInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function sanitiseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

let lastLoggedSummary: string | null = null;

/**
 * Read the singleton config row, sanitise every field, and log a
 * `[quota] config_resolved` line on each unique resolution. The logger
 * deduplicates identical successive lines to keep the metric stream
 * readable under load.
 *
 * No PII, no user-identifying information is logged.
 */
export async function getResolvedConfig(): Promise<ResolvedConfig> {
  let resolved: ResolvedConfig;
  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select(
        "quota_enabled, daily_submission_cap, max_takes_per_audition, future_evidence_enabled, future_report_enabled, future_qa_trace_enabled",
      )
      .eq("id", "singleton")
      .maybeSingle();

    if (error || !data) {
      resolved = { ...SAFE_DEFAULTS, source: "default" };
    } else {
      const row = data as Record<string, unknown>;
      resolved = {
        quota_enabled: sanitiseBool(row.quota_enabled, SAFE_DEFAULTS.quota_enabled),
        daily_submission_cap: sanitiseInt(
          row.daily_submission_cap,
          SAFE_DEFAULTS.daily_submission_cap,
        ),
        max_takes_per_audition: sanitiseInt(
          row.max_takes_per_audition,
          SAFE_DEFAULTS.max_takes_per_audition,
        ),
        future_evidence_enabled: sanitiseBool(
          row.future_evidence_enabled,
          SAFE_DEFAULTS.future_evidence_enabled,
        ),
        future_report_enabled: sanitiseBool(
          row.future_report_enabled,
          SAFE_DEFAULTS.future_report_enabled,
        ),
        future_qa_trace_enabled: sanitiseBool(
          row.future_qa_trace_enabled,
          SAFE_DEFAULTS.future_qa_trace_enabled,
        ),
        source: "config",
      };
    }
  } catch (err) {
    console.warn("[quota] config_read_failed — falling back to defaults", err);
    resolved = { ...SAFE_DEFAULTS, source: "default" };
  }

  const summary = JSON.stringify({
    quota_enabled: resolved.quota_enabled,
    daily_submission_cap: resolved.daily_submission_cap,
    max_takes_per_audition: resolved.max_takes_per_audition,
    future_evidence_enabled: resolved.future_evidence_enabled,
    future_report_enabled: resolved.future_report_enabled,
    future_qa_trace_enabled: resolved.future_qa_trace_enabled,
    source: resolved.source,
  });
  if (summary !== lastLoggedSummary) {
    console.log(`[quota] config_resolved ${summary}`);
    lastLoggedSummary = summary;
  }
  return resolved;
}
