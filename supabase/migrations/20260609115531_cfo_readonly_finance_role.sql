-- Dedicated finance-scoped READ-ONLY role for the CFO advisory path.
-- Least privilege: USAGE on schema public + SELECT on exactly the 20 finance relations
-- the tc-finance-snapshot query set reads (DS-04/06/13/16/17). NO write grants anywhere.
-- Created NOLOGIN: this is the privilege bundle. LOGIN + password (for a direct read-only
-- connection) is set by the operator out-of-band so no secret enters git.
-- Additive only — does NOT alter the shared/operational (postgres) path used by apply_migration.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cfo_readonly') then
    create role cfo_readonly nologin;
  end if;
end $$;

grant usage on schema public to cfo_readonly;

-- DS-16 — AI-usage cost baseline (4 views + 1 base table)
grant select on public.ai_usage_cost_dashboard          to cfo_readonly;
grant select on public.ai_usage_cost_grouping_summary    to cfo_readonly;
grant select on public.ai_usage_model_cost_summary       to cfo_readonly;
grant select on public.take_ai_report_costs              to cfo_readonly;
grant select on public.take_ai_usage                     to cfo_readonly;
-- DS-17 — CFO dashboards (9 views)
grant select on public.cfo_monthly_burn_dashboard        to cfo_readonly;
grant select on public.cfo_revenue_milestone_dashboard   to cfo_readonly;
grant select on public.cfo_report_cost_by_report_dashboard to cfo_readonly;
grant select on public.cfo_report_funding_dashboard      to cfo_readonly;
grant select on public.cfo_free_report_subsidy_dashboard to cfo_readonly;
grant select on public.cfo_paid_credit_liability_summary to cfo_readonly;
grant select on public.cfo_partner_margin_dashboard      to cfo_readonly;
grant select on public.cfo_revenue_ledger_dashboard      to cfo_readonly;
grant select on public.cfo_partner_revenue_source_dashboard to cfo_readonly;
-- DS-04 — credit ledger (1 view + 2 base tables)
grant select on public.credit_source_finance_summary     to cfo_readonly;
grant select on public.credit_grants                     to cfo_readonly;
grant select on public.credit_ledger_entries             to cfo_readonly;
-- DS-06 — partner pools (1 view)
grant select on public.partner_credit_pool_usage_summary to cfo_readonly;
-- DS-13 — consumer revenue (1 base table + 1 view)
grant select on public.consumer_credit_revenue_ledger_entries to cfo_readonly;
grant select on public.consumer_credit_payment_reconciliation to cfo_readonly;
