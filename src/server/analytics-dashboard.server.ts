import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";

export const ANALYTICS_DASHBOARD_VERSION = "s10-1-ds-18-2026-05-27" as const;

export type AnalyticsFunnelRow = Tables<"analytics_funnel_dashboard">;
export type AnalyticsReportCompletionRow = Tables<"analytics_report_completion_dashboard">;
export type AnalyticsHabitRow = Tables<"analytics_habit_dashboard">;
export type AnalyticsAttributionRow = Tables<"analytics_attribution_dashboard">;
export type AnalyticsB2BLeadRow = Tables<"analytics_b2b_leads_dashboard">;

export type AnalyticsDashboardSnapshot = {
  version: typeof ANALYTICS_DASHBOARD_VERSION;
  generated_at: string;
  consent_model: {
    non_essential_browser_analytics: "consent_gated";
    essential_product_events: "first_party_service_events";
    third_party_analytics: "not_configured";
  };
  funnel: AnalyticsFunnelRow[];
  report_completion: AnalyticsReportCompletionRow[];
  habit: AnalyticsHabitRow[];
  attribution: AnalyticsAttributionRow[];
  b2b_leads: AnalyticsB2BLeadRow[];
};

type SupabaseError = { message?: string };

function throwAnalyticsDashboardError(operation: string, error: SupabaseError): never {
  console.error(`[analytics-dashboard] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

export function normaliseAnalyticsRate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4));
}

export function analyticsSourceLabel(row: {
  attribution_source?: string | null;
  utm_source?: string | null;
  creator_code?: string | null;
  partner_code_hint?: string | null;
}): string {
  if (row.utm_source) return row.utm_source;
  if (row.partner_code_hint) return "partner_code";
  if (row.creator_code) return "creator_code";
  return row.attribution_source || "direct_or_unknown";
}

export async function listAnalyticsFunnelRows(): Promise<AnalyticsFunnelRow[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_funnel_dashboard")
    .select("*")
    .order("event_day", { ascending: false, nullsFirst: false })
    .order("event_name", { ascending: true })
    .limit(150);

  if (error) throwAnalyticsDashboardError("list_funnel", error);
  return (data ?? []) as AnalyticsFunnelRow[];
}

export async function listAnalyticsReportCompletionRows(): Promise<AnalyticsReportCompletionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_report_completion_dashboard")
    .select("*")
    .order("month_start", { ascending: false, nullsFirst: false })
    .limit(24);

  if (error) throwAnalyticsDashboardError("list_report_completion", error);
  return (data ?? []) as AnalyticsReportCompletionRow[];
}

export async function listAnalyticsHabitRows(): Promise<AnalyticsHabitRow[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_habit_dashboard")
    .select("*")
    .order("cohort_month", { ascending: false, nullsFirst: false })
    .limit(24);

  if (error) throwAnalyticsDashboardError("list_habit", error);
  return (data ?? []) as AnalyticsHabitRow[];
}

export async function listAnalyticsAttributionRows(): Promise<AnalyticsAttributionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_attribution_dashboard")
    .select("*")
    .order("signup_count", { ascending: false, nullsFirst: false })
    .order("upload_count", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) throwAnalyticsDashboardError("list_attribution", error);
  return (data ?? []) as AnalyticsAttributionRow[];
}

export async function listAnalyticsB2BLeadRows(): Promise<AnalyticsB2BLeadRow[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_b2b_leads_dashboard")
    .select("*")
    .order("lead_day", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) throwAnalyticsDashboardError("list_b2b_leads", error);
  return (data ?? []) as AnalyticsB2BLeadRow[];
}

export async function getAnalyticsDashboardSnapshot(): Promise<AnalyticsDashboardSnapshot> {
  const [funnel, reportCompletion, habit, attribution, b2bLeads] = await Promise.all([
    listAnalyticsFunnelRows(),
    listAnalyticsReportCompletionRows(),
    listAnalyticsHabitRows(),
    listAnalyticsAttributionRows(),
    listAnalyticsB2BLeadRows(),
  ]);

  return {
    version: ANALYTICS_DASHBOARD_VERSION,
    generated_at: new Date().toISOString(),
    consent_model: {
      non_essential_browser_analytics: "consent_gated",
      essential_product_events: "first_party_service_events",
      third_party_analytics: "not_configured",
    },
    funnel,
    report_completion: reportCompletion,
    habit,
    attribution,
    b2b_leads: b2bLeads,
  };
}
