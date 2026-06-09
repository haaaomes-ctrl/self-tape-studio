---
name: tc-finance-snapshot
description: Generate a dated, read-only TapeCoach finance snapshot from the owned Supabase finance data and write it to the corpus finance area (knowledge/60-finance/). Reads the DS-16 AI-usage cost baseline and DS-17 CFO dashboard views (plus DS-04 credit-ledger summary, DS-06 partner-pool usage, DS-13 consumer revenue ledger) and emits cost/report (p50/p95), cost by partner/source/duration, monthly burn, free-credit subsidy exposure, unused-credit liability, and revenue vs the £100/£300/£1k/£2.5k milestones. SELECT-only; every figure cites its source query; missing/stale/synthetic data is flagged, never estimated. Use whenever the CFO role (or the operator) asks for a finance picture, snapshot, burn/runway/margin read, or unit-economics summary.
---

# TapeCoach finance snapshot (read-only)

Produces a point-in-time finance picture grounded entirely in the owned Supabase finance
data. It is **read-only and advisory** — it never moves money, changes pricing, or mutates
the database. It is the grounding anchor for the `cfo` agent: the verified view/column
names below are the contract the queries run against.

## Boundaries

- **Read-boundary:** owned Supabase only, **SELECT and views only**. No INSERT/UPDATE/
  DELETE, no DDL, no `apply_migration`, no edge-function deploy, no Stripe/config. The
  finance views are private by grant (SELECT to `postgres`/`service_role` only — not
  `anon`/`authenticated`); the CFO reads them through the `supabase-cfo-ro` MCP, which
  connects **as the `cfo_readonly` role** via a read-only DSN (env var
  `CFO_READONLY_DATABASE_URL`) and exposes the read-only `query` tool.
- **Write-boundary:** writes only under `knowledge/60-finance/`, as a `tc-vault-note`
  note. Never edits the spine, code, or any other corpus area.

> **Read-only and finance-scoping are both structural at the connection.** The CFO's DB path
> is the dedicated `supabase-cfo-ro` MCP — a Postgres-protocol MCP that connects **as the
> `cfo_readonly` role** via a read-only DSN (env var `CFO_READONLY_DATABASE_URL`). The role
> has **zero write grants** (any DML/DDL is rejected as `permission denied`, and the MCP also
> runs each query in a read-only transaction) and can **`SELECT` only the 20 finance
> relations** (DS-04/06/13/16/17) and nothing else. So both no-write and finance-scoping are
> **structural**, not a contract — there is no interim follow-up. See
> `knowledge/60-finance/finance-area-readme.md`.

## Grounded schema (verified against the live schema, 2026-06-08)

Use these names exactly. If a name is not listed, confirm it via an
`information_schema.columns` SELECT through the `query` tool **before** using it — never
invent a table/column/view.

**DS-16 — AI-usage cost baseline** (`public`):

- `ai_usage_cost_dashboard` (single row) — `report_count`, `estimated_total_cost_usd`,
  `average_report_cost_usd`, `p50_report_cost_usd`, `p95_report_cost_usd`, `ai_call_count`,
  `failed_call_count`, `fallback_call_count`, `repair_call_count`, `fallback_rate`,
  `repair_rate`, `p50_watch_threshold_usd`, `p95_watch_threshold_usd`,
  `planning_baseline_min_usd`, `planning_baseline_max_usd`.
- `ai_usage_cost_grouping_summary` — grouped by `credit_source_group`, `partner_id`,
  `partner_name`, `partner_type`, `duration_status`; `report_count`,
  `estimated_total_cost_usd`, `average_report_cost_usd`, `p50_report_cost_usd`,
  `p95_report_cost_usd`, `fallback_rate`, `repair_rate`.
- `ai_usage_model_cost_summary` — per `provider`/`model`/`step`/`status`: `call_count`,
  `estimated_cost_usd`, latency p50/p95, token totals.
- `take_ai_report_costs` — per-take base view (`take_id`, `report_estimated_cost_usd`,
  `report_cost_source`, `synthetic_usage`, `commercial_metrics_excluded`, `credit_source`,
  `partner_*`, `duration_status`, `last_ai_usage_at`).
- Base table `take_ai_usage` — `cost_source` enum: `planning_baseline`,
  `duration_baseline`, `token_usage_available`; `estimated_cost_usd`, `created_at`.

**DS-17 — CFO dashboards** (`public`, **not** a separate schema; private by grant):

- `cfo_monthly_burn_dashboard` — `month_start`, `report_count`, `free_report_count`,
  `partner_funded_report_count`, `user_paid_report_count`, `gross_revenue_gbp`,
  `net_revenue_gbp`, `ai_variable_cost_gbp`, `chatgpt_codex_monthly_cost_gbp`,
  `lovable_monthly_cost_gbp`, `planning_fixed_monthly_burn_gbp`, `total_monthly_burn_gbp`,
  `contribution_after_ai_cost_gbp`, `break_even_gap_gbp`.
- `cfo_revenue_milestone_dashboard` — `month_start`, `milestone_gbp` (100, 300, 1000,
  2500), `current_month_net_revenue_gbp`, `reached`, `remaining_gbp`, `progress_rate`.
- `cfo_report_cost_by_report_dashboard` — per-report cost (`take_id`, `month_start`,
  `funding_bucket`, `credit_source`, `partner_*`, `duration_status`,
  `commercial_metrics_excluded`, `estimated_ai_cost_usd`, `estimated_ai_cost_gbp`,
  `report_cost_source`).
- `cfo_report_funding_dashboard` — by `month_start` × `funding_bucket` × `credit_source` ×
  `partner_*` × `duration_status`: `report_count`, `estimated_ai_cost_usd/gbp`,
  `average_ai_cost_usd/gbp`.
- `cfo_free_report_subsidy_dashboard` — `month_start`, `credit_source`, `duration_status`,
  `free_report_count`, `estimated_subsidy_cost_usd`, `estimated_subsidy_cost_gbp`,
  `average_free_report_cost_gbp`, `cost_fx_source`.
- `cfo_paid_credit_liability_summary` — `product_sku`, `paid_credit_grant_count`,
  `original_paid_credits`, `unused_paid_credits`,
  `estimated_unused_paid_credit_liability_pence`,
  `estimated_unused_paid_credit_liability_gbp`, `liability_pricing_status`.
- `cfo_partner_margin_dashboard` — `partner_name`, `partner_type`,
  `partner_funded_report_count`, `estimated_ai_cost_gbp`, `partner_revenue_gbp`,
  `gross_margin_gbp`, `gross_margin_rate`, `paid_pack_margin_guardrail` (0.70),
  `gross_margin_guardrail_status`.
- `cfo_revenue_ledger_dashboard` — `month_start`, `revenue_stream`, `partner_*`,
  `gross_revenue_pence`, `refunds_or_disputes_pence`, `net_revenue_pence`,
  `transaction_count`.
- `cfo_partner_revenue_source_dashboard` — partner pool → revenue source detail.

**DS-04 — credit ledger** (`public`): `credit_source_finance_summary` (`source`,
`granted_credits`, `consumed_credits`, `admin_adjustment_credits`, `expired_credits`,
`net_credits`, `entry_count`, `latest_entry_at`). `credit_source` enum: `free_signup`,
`free_monthly`, `school_funded`, `coach_funded`, `agent_funded`, `platform_funded`,
`sponsor_campaign`, `user_paid`, `admin_grant`. Base tables `credit_grants`,
`credit_ledger_entries`.

**DS-06 — partner pools** (`public`): `partner_credit_pool_usage_summary` (`name`,
`status`, `total_credits`, `allocated_credits`, `consumed_credits`, `remaining_credits`,
`per_user_cap`, `allocated_usage_percent`).

**DS-13 — consumer revenue** (`public`): `consumer_credit_revenue_ledger_entries` (base;
`event_type`, `amount_pence`, `credit_delta`, `created_at`),
`consumer_credit_payment_reconciliation` (view). Surfaced for the CFO via
`cfo_revenue_ledger_dashboard`.

**Planning constants** (read from `cfo_monthly_burn_dashboard`; cross-referenced in
`src/server/cfo-dashboard.server.ts`): ChatGPT/Codex £200/mo, Lovable £22/mo, fixed burn
£275/mo, planning USD→GBP rate 0.8, paid-pack margin guardrail 0.70, milestones
£100/£300/£1k/£2.5k. These are **planning assumptions**, not measured spend — label them.

## Honesty rules (apply to every snapshot)

1. **Cite every figure** with its source view and the `SELECT` used.
2. **Downside first** — burn, break-even gap, subsidy, unused-credit liability, and any
   partner margin below the 0.70 guardrail lead the snapshot.
3. **Measured vs planning** — never present a planning constant as measured spend.
4. **Never estimate ungrounded** — empty/stale views are reported "not available",
   not guessed.
5. **Exclude/flag synthetic** — `synthetic_usage` / `commercial_metrics_excluded` mark
   canary/retest runs. If a figure may include them, say so; the aggregate
   `ai_usage_cost_dashboard` is **not** assumed to exclude synthetic unless verified.

## The query set (SELECT-only)

Run these (adjust the `limit`/window as the question needs). Keep each result paired with
its query for citation.

```sql
-- (1) Cost per report — p50 / p95 (overall). Source: DS-16 ai_usage_cost_dashboard
select report_count, estimated_total_cost_usd, average_report_cost_usd,
       p50_report_cost_usd, p95_report_cost_usd,
       p50_watch_threshold_usd, p95_watch_threshold_usd,
       fallback_rate, repair_rate, failed_call_count
from ai_usage_cost_dashboard;

-- (2) Cost by partner / source / duration. Source: DS-16 ai_usage_cost_grouping_summary
select credit_source_group, partner_name, partner_type, duration_status,
       report_count, estimated_total_cost_usd, average_report_cost_usd,
       p50_report_cost_usd, p95_report_cost_usd, fallback_rate, repair_rate
from ai_usage_cost_grouping_summary
order by estimated_total_cost_usd desc nulls last;

-- (3) Monthly burn (last 12 months). Source: DS-17 cfo_monthly_burn_dashboard
select month_start, report_count, free_report_count, partner_funded_report_count,
       user_paid_report_count, gross_revenue_gbp, net_revenue_gbp, ai_variable_cost_gbp,
       chatgpt_codex_monthly_cost_gbp, lovable_monthly_cost_gbp,
       planning_fixed_monthly_burn_gbp, total_monthly_burn_gbp,
       contribution_after_ai_cost_gbp, break_even_gap_gbp
from cfo_monthly_burn_dashboard
order by month_start desc
limit 12;

-- (4) Free-credit subsidy exposure. Source: DS-17 cfo_free_report_subsidy_dashboard
select month_start, credit_source, duration_status, free_report_count,
       estimated_subsidy_cost_usd, estimated_subsidy_cost_gbp,
       average_free_report_cost_gbp, cost_fx_source
from cfo_free_report_subsidy_dashboard
order by month_start desc, estimated_subsidy_cost_gbp desc nulls last;

-- (4b) Credit granted vs consumed by source (DS-04). Source: credit_source_finance_summary
select source, granted_credits, consumed_credits, admin_adjustment_credits,
       expired_credits, net_credits, entry_count, latest_entry_at
from credit_source_finance_summary
order by source;

-- (5) Unused (paid) credit liability. Source: DS-17 cfo_paid_credit_liability_summary
select product_sku, paid_credit_grant_count, original_paid_credits, unused_paid_credits,
       estimated_unused_paid_credit_liability_pence,
       estimated_unused_paid_credit_liability_gbp, liability_pricing_status
from cfo_paid_credit_liability_summary
order by estimated_unused_paid_credit_liability_gbp desc nulls last;

-- (6) Revenue vs milestones (£100/£300/£1k/£2.5k). Source: DS-17 cfo_revenue_milestone_dashboard
select month_start, milestone_gbp, current_month_net_revenue_gbp,
       reached, remaining_gbp, progress_rate
from cfo_revenue_milestone_dashboard
order by milestone_gbp;

-- (6b) Revenue ledger by stream (DS-13). Source: cfo_revenue_ledger_dashboard
select month_start, revenue_stream, partner_name,
       gross_revenue_pence, refunds_or_disputes_pence, net_revenue_pence, transaction_count
from cfo_revenue_ledger_dashboard
order by month_start desc, revenue_stream;

-- (7) Partner margins vs 0.70 guardrail. Source: DS-17 cfo_partner_margin_dashboard
select partner_name, partner_type, partner_funded_report_count,
       estimated_ai_cost_gbp, partner_revenue_gbp, gross_margin_gbp, gross_margin_rate,
       paid_pack_margin_guardrail, gross_margin_guardrail_status
from cfo_partner_margin_dashboard
order by gross_margin_rate asc nulls last;

-- (8) Partner pool usage (DS-06). Source: partner_credit_pool_usage_summary
select name, status, total_credits, allocated_credits, consumed_credits,
       remaining_credits, per_user_cap, allocated_usage_percent
from partner_credit_pool_usage_summary
order by allocated_usage_percent desc nulls last;

-- (9) Freshness / staleness check (flag stale or empty data)
select
  (select max(created_at) from take_ai_usage) as latest_ai_usage_at,
  (select max(created_at) from consumer_credit_revenue_ledger_entries) as latest_revenue_event_at,
  (select max(latest_entry_at) from credit_source_finance_summary) as latest_credit_ledger_at,
  (select count(*) from take_ai_usage) as ai_usage_rows;
```

## The snapshot note

Write to `knowledge/60-finance/<YYYY-MM-DD>-cfo-finance-snapshot.md` (use the real date;
if more than one in a day, suffix `-2`, `-3`). Front-matter follows `tc-vault-note`:

```yaml
---
id: cfo-finance-snapshot-<YYYY-MM-DD>
title: CFO finance snapshot — <YYYY-MM-DD>
tier: corpus
status: current # a snapshot is the best present finance read; below the spine
spine_anchor: ["ADR-0005", "AGENTS §Minimal env/config principle"]
decided_ref: null
supersedes: []
superseded_by: null
supersession_reason: null
source: claude-code
source_ref: tc-finance-snapshot
discipline: null
monday_ref: null
tags: [finance, cfo, snapshot, ds-16, ds-17]
confidence: medium # measured data; lower it if data is sparse/stale
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

Body sections (downside first):

- `## Summary` — headline: burn, break-even gap, subsidy, liability, any margin breach.
- `## Cost per report` — p50/p95 (query 1) + by partner/source/duration (query 2).
- `## Monthly burn` — query 3, with measured vs planning split called out.
- `## Subsidy exposure` — free-credit subsidy (query 4) + credit source summary (4b).
- `## Liability` — unused paid-credit liability (query 5).
- `## Revenue vs milestones` — query 6 + revenue ledger (6b).
- `## Partner margins` — query 7 (flag every row below 0.70) + pool usage (query 8).
- `## Data quality` — freshness (query 9), empty/stale views, synthetic-usage caveat.
- `## Recommendations` — proposed BA items for the SRO (what / why / evidence), never
  actions taken.
- `## Links` — `[[<prior-snapshot-id>]]` if one exists; `[[finance-area-readme]]` for the area.

Each figure line carries its source, e.g.
`Break-even gap: £275.00 (cfo_monthly_burn_dashboard.break_even_gap_gbp, 2026-06; planning-fixed component only)`.

## Report

State the snapshot path and the headline downside. Note the data-quality caveats
explicitly. If the picture implies a money/pricing change, surface it as a recommendation
for the SRO — never as an action. Recommend rerunning `tc-knowledge-index` after writing,
so the snapshot is wired into the spine→evidence map.
