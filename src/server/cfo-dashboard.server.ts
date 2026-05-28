import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CFO_DASHBOARD_VERSION = "s10-1-ds-17-2026-05-27" as const;
export const CFO_CHATGPT_CODEX_MONTHLY_COST_GBP = 200;
export const CFO_LOVABLE_MONTHLY_COST_GBP = 22;
export const CFO_PLANNING_FIXED_MONTHLY_BURN_GBP = 275;
export const CFO_PAID_PACK_MARGIN_GUARDRAIL = 0.7;
export const CFO_PLANNING_USD_TO_GBP_RATE = 0.8;
export const CFO_REVENUE_MILESTONES_GBP = [100, 300, 1000, 2500] as const;

// NOTE: These CFO dashboard views are not yet in the generated Supabase
// types.ts (Tables<"..."> resolves to `never`). Until the types catch up,
// model them as permissive records.
type AnyRow = Record<string, any>;
export type CfoMonthlyBurnRow = AnyRow;
export type CfoRevenueMilestoneRow = AnyRow;
export type CfoReportFundingRow = AnyRow;
export type CfoReportCostByReportRow = AnyRow;
export type CfoPartnerMarginRow = AnyRow;
export type CfoFreeReportSubsidyRow = AnyRow;
export type CfoPaidCreditLiabilityRow = AnyRow;
export type CfoRevenueLedgerRow = AnyRow;
export type CfoPartnerRevenueSourceRow = AnyRow;
const db = supabaseAdmin as any;

export type CfoDashboardSnapshot = {
  version: typeof CFO_DASHBOARD_VERSION;
  generated_at: string;
  planning: {
    chatgpt_codex_monthly_cost_gbp: number;
    lovable_monthly_cost_gbp: number;
    fixed_monthly_burn_gbp: number;
    paid_pack_margin_guardrail: number;
    planning_usd_to_gbp_rate: number;
    revenue_milestones_gbp: readonly number[];
  };
  monthly_burn: CfoMonthlyBurnRow[];
  revenue_milestones: CfoRevenueMilestoneRow[];
  report_funding: CfoReportFundingRow[];
  report_costs_by_report: CfoReportCostByReportRow[];
  partner_margins: CfoPartnerMarginRow[];
  free_report_subsidy: CfoFreeReportSubsidyRow[];
  paid_credit_liability: CfoPaidCreditLiabilityRow[];
  revenue_ledger: CfoRevenueLedgerRow[];
  partner_revenue_sources: CfoPartnerRevenueSourceRow[];
};

type SupabaseError = { message?: string };

function throwCfoDashboardError(operation: string, error: SupabaseError): never {
  console.error(`[cfo-dashboard] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

export function normaliseCfoMoney(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

export function normaliseCfoRate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(4));
}

export function classifyMarginGuardrail(rate: number | null | undefined): string {
  const normalisedRate = normaliseCfoRate(rate);
  if (normalisedRate === null) return "revenue_not_recorded";
  return normalisedRate >= CFO_PAID_PACK_MARGIN_GUARDRAIL
    ? "meets_70_percent_guardrail"
    : "below_70_percent_guardrail";
}

export function getCfoPlanningConstants(): CfoDashboardSnapshot["planning"] {
  return {
    chatgpt_codex_monthly_cost_gbp: CFO_CHATGPT_CODEX_MONTHLY_COST_GBP,
    lovable_monthly_cost_gbp: CFO_LOVABLE_MONTHLY_COST_GBP,
    fixed_monthly_burn_gbp: CFO_PLANNING_FIXED_MONTHLY_BURN_GBP,
    paid_pack_margin_guardrail: CFO_PAID_PACK_MARGIN_GUARDRAIL,
    planning_usd_to_gbp_rate: CFO_PLANNING_USD_TO_GBP_RATE,
    revenue_milestones_gbp: CFO_REVENUE_MILESTONES_GBP,
  };
}

export async function listCfoMonthlyBurnRows(): Promise<CfoMonthlyBurnRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_monthly_burn_dashboard")
    .select("*")
    .order("month_start", { ascending: false, nullsFirst: false })
    .limit(12);

  if (error) throwCfoDashboardError("list_monthly_burn", error);
  return (data ?? []) as CfoMonthlyBurnRow[];
}

export async function listCfoRevenueMilestoneRows(): Promise<CfoRevenueMilestoneRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_revenue_milestone_dashboard")
    .select("*")
    .order("milestone_gbp", { ascending: true });

  if (error) throwCfoDashboardError("list_revenue_milestones", error);
  return (data ?? []) as CfoRevenueMilestoneRow[];
}

export async function listCfoReportFundingRows(): Promise<CfoReportFundingRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_report_funding_dashboard")
    .select("*")
    .order("month_start", { ascending: false, nullsFirst: false })
    .order("funding_bucket", { ascending: true })
    .order("credit_source", { ascending: true })
    .limit(100);

  if (error) throwCfoDashboardError("list_report_funding", error);
  return (data ?? []) as CfoReportFundingRow[];
}

export async function listCfoReportCostByReportRows(): Promise<CfoReportCostByReportRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_report_cost_by_report_dashboard")
    .select("*")
    .order("report_created_at", { ascending: false, nullsFirst: false })
    .limit(250);

  if (error) throwCfoDashboardError("list_report_cost_by_report", error);
  return (data ?? []) as CfoReportCostByReportRow[];
}

export async function listCfoPartnerMarginRows(): Promise<CfoPartnerMarginRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_partner_margin_dashboard")
    .select("*")
    .order("gross_margin_guardrail_status", { ascending: true })
    .order("partner_name", { ascending: true })
    .limit(100);

  if (error) throwCfoDashboardError("list_partner_margins", error);
  return (data ?? []) as CfoPartnerMarginRow[];
}

export async function listCfoFreeReportSubsidyRows(): Promise<CfoFreeReportSubsidyRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_free_report_subsidy_dashboard")
    .select("*")
    .order("month_start", { ascending: false, nullsFirst: false })
    .order("credit_source", { ascending: true })
    .limit(100);

  if (error) throwCfoDashboardError("list_free_report_subsidy", error);
  return (data ?? []) as CfoFreeReportSubsidyRow[];
}

export async function listCfoPaidCreditLiabilityRows(): Promise<CfoPaidCreditLiabilityRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_paid_credit_liability_summary")
    .select("*")
    .order("estimated_unused_paid_credit_liability_pence", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(100);

  if (error) throwCfoDashboardError("list_paid_credit_liability", error);
  return (data ?? []) as CfoPaidCreditLiabilityRow[];
}

export async function listCfoRevenueLedgerRows(): Promise<CfoRevenueLedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_revenue_ledger_dashboard")
    .select("*")
    .order("month_start", { ascending: false, nullsFirst: false })
    .order("revenue_stream", { ascending: true })
    .limit(100);

  if (error) throwCfoDashboardError("list_revenue_ledger", error);
  return (data ?? []) as CfoRevenueLedgerRow[];
}

export async function listCfoPartnerRevenueSourceRows(): Promise<CfoPartnerRevenueSourceRow[]> {
  const { data, error } = await supabaseAdmin
    .from("cfo_partner_revenue_source_dashboard")
    .select("*")
    .order("revenue_month", { ascending: false, nullsFirst: false })
    .order("partner_name", { ascending: true })
    .limit(100);

  if (error) throwCfoDashboardError("list_partner_revenue_sources", error);
  return (data ?? []) as CfoPartnerRevenueSourceRow[];
}

export async function getCfoDashboardSnapshot(): Promise<CfoDashboardSnapshot> {
  const [
    monthlyBurn,
    revenueMilestones,
    reportFunding,
    reportCostsByReport,
    partnerMargins,
    freeReportSubsidy,
    paidCreditLiability,
    revenueLedger,
    partnerRevenueSources,
  ] = await Promise.all([
    listCfoMonthlyBurnRows(),
    listCfoRevenueMilestoneRows(),
    listCfoReportFundingRows(),
    listCfoReportCostByReportRows(),
    listCfoPartnerMarginRows(),
    listCfoFreeReportSubsidyRows(),
    listCfoPaidCreditLiabilityRows(),
    listCfoRevenueLedgerRows(),
    listCfoPartnerRevenueSourceRows(),
  ]);

  return {
    version: CFO_DASHBOARD_VERSION,
    generated_at: new Date().toISOString(),
    planning: getCfoPlanningConstants(),
    monthly_burn: monthlyBurn,
    revenue_milestones: revenueMilestones,
    report_funding: reportFunding,
    report_costs_by_report: reportCostsByReport,
    partner_margins: partnerMargins,
    free_report_subsidy: freeReportSubsidy,
    paid_credit_liability: paidCreditLiability,
    revenue_ledger: revenueLedger,
    partner_revenue_sources: partnerRevenueSources,
  };
}
