// SERVER-ONLY: Template 3 report-view kill-switch.
//
// Deliberately NOT part of getResolvedConfig(): adding a column to that
// resolver's explicit select() would make the whole config query fail while
// the migration lags a deploy, dropping EVERY field to SAFE_DEFAULTS —
// including quota_enabled=true, which would silently re-enable the dormant
// daily cap (ADR-0005 keeps it off). This narrow read fails open to the
// Template 3 view instead and touches nothing else.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns whether the Template 3 report view is enabled. Defaults to true
 * (Template 3 on) when the row, column, or query is unavailable — the
 * toggle exists only as an emergency lever back to the legacy view.
 */
export async function getTpl3ReportViewEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select("tpl3_report_view_enabled")
      .eq("id", "singleton")
      .maybeSingle();
    if (error || !data) return true;
    const value = (data as Record<string, unknown>).tpl3_report_view_enabled;
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
}
